import functools
import http.server
import sys
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    directory = Path(sys.argv[3]) if len(sys.argv) > 3 else Path.cwd()
    handler = functools.partial(NoCacheHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer((bind, port), handler)
    print(f"Serving {directory} on http://{bind}:{port} with no-cache headers", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
