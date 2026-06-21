import functools
import http.server
import json
import queue
import sys
import threading
import time
from pathlib import Path

WATCH_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".mjs",
    ".svg",
}
WATCH_DIRS = (
    "bobercad/app",
    "bobercad/data",
    "tools/dev",
)
IGNORED_PARTS = {
    ".git",
    ".codex",
    "__pycache__",
    "artifacts",
    "node_modules",
    "qa-output",
    "stress-output",
}
LIVE_RELOAD_SNIPPET = """
<script>
(() => {
  if (window.__bobercadDevReload) return;
  window.__bobercadDevReload = true;
  let reloading = false;
  let lastVersion = null;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  const readVersion = async () => {
    const response = await fetch("/__bobercad_dev/version", { cache: "no-store" });
    if (!response.ok) throw new Error(`dev reload version failed: ${response.status}`);
    return response.json();
  };
  readVersion()
    .then((payload) => { lastVersion = payload.version; })
    .catch(() => {});
  try {
    const source = new EventSource("/__bobercad_dev/events");
    source.addEventListener("reload", reload);
  } catch (error) {
    console.warn(`Bobercad dev reload SSE unavailable: ${error?.message || error}`);
  }
  window.setInterval(() => {
    readVersion()
      .then((payload) => {
        if (lastVersion === null) {
          lastVersion = payload.version;
          return;
        }
        if (payload.version !== lastVersion) reload();
      })
      .catch(() => {});
  }, 1000);
})();
</script>
"""


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/__bobercad_dev/events":
            self.handle_reload_events()
            return
        if self.path.split("?", 1)[0] == "/__bobercad_dev/version":
            self.handle_reload_version()
            return
        if self.server.live_reload and self.serve_html_with_reload(head_only=False):
            return
        super().do_GET()

    def do_HEAD(self):
        if self.server.live_reload and self.serve_html_with_reload(head_only=True):
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def handle_reload_events(self):
        events = queue.Queue()
        with self.server.reload_clients_lock:
            self.server.reload_clients.add(events)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(b"event: ready\ndata: {}\n\n")
            self.wfile.flush()
            while True:
                payload = events.get()
                self.wfile.write(f"event: reload\ndata: {json.dumps(payload)}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with self.server.reload_clients_lock:
                self.server.reload_clients.discard(events)

    def handle_reload_version(self):
        payload = json.dumps({"version": self.server.reload_version}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def serve_html_with_reload(self, head_only=False):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / "index.html"
        if path.suffix.lower() not in {".html", ".htm"} or not path.is_file():
            return False

        body = path.read_text(encoding="utf-8")
        if "/__bobercad_dev/events" not in body:
            lower = body.lower()
            index = lower.rfind("</body>")
            body = body[:index] + LIVE_RELOAD_SNIPPET + body[index:] if index >= 0 else body + LIVE_RELOAD_SNIPPET
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if not head_only:
            self.wfile.write(encoded)
        return True


def main():
    args = parse_args(sys.argv[1:])
    port = args["port"]
    bind = args["bind"]
    directory = args["directory"]
    handler = functools.partial(NoCacheHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer((bind, port), handler)
    server.live_reload = args["live_reload"]
    server.reload_clients = set()
    server.reload_clients_lock = threading.Lock()
    server.reload_version = time.time_ns()
    if server.live_reload:
        threading.Thread(target=watch_files, args=(server, directory), daemon=True).start()
    reload_label = " and live reload" if server.live_reload else ""
    print(f"Serving {directory} on http://{bind}:{port} with no-cache headers{reload_label}", flush=True)
    server.serve_forever()


def parse_args(argv):
    live_reload = True
    values = []
    for arg in argv:
        if arg == "--no-reload":
            live_reload = False
        elif arg == "--reload":
            live_reload = True
        else:
            values.append(arg)
    return {
        "port": int(values[0]) if len(values) > 0 else 8000,
        "bind": values[1] if len(values) > 1 else "127.0.0.1",
        "directory": Path(values[2]) if len(values) > 2 else Path.cwd(),
        "live_reload": live_reload,
    }


def watch_files(server, directory):
    snapshot = scan_files(directory)
    while True:
        time.sleep(0.75)
        next_snapshot = scan_files(directory)
        changed = sorted(path for path, mtime in next_snapshot.items() if snapshot.get(path) != mtime)
        removed = sorted(path for path in snapshot if path not in next_snapshot)
        snapshot = next_snapshot
        paths = changed[:12] + removed[:12]
        if paths:
            notify_reload_clients(server, paths)


def notify_reload_clients(server, paths):
    server.reload_version = time.time_ns()
    payload = {"paths": paths, "time": time.time(), "version": server.reload_version}
    with server.reload_clients_lock:
        clients = list(server.reload_clients)
    for client in clients:
        client.put(payload)


def scan_files(directory):
    root = Path(directory).resolve()
    files = {}
    for watch_root in watch_roots(root):
        if not watch_root.exists():
            continue
        paths = [watch_root] if watch_root.is_file() else watch_root.rglob("*")
        for path in paths:
            if not should_watch(path):
                continue
            try:
                files[str(path.relative_to(root)).replace("\\", "/")] = path.stat().st_mtime_ns
            except OSError:
                pass
    return files


def watch_roots(root):
    roots = [root / path for path in WATCH_DIRS]
    roots.extend(path for path in [root / "index.html", root / "AGENTS.md"] if path.exists())
    return roots


def should_watch(path):
    if any(part in IGNORED_PARTS for part in path.parts):
        return False
    return path.is_file() and path.suffix.lower() in WATCH_EXTENSIONS


if __name__ == "__main__":
    main()
