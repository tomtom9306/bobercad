#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  referenceGeometryImportCommandPlanDescriptor,
  referenceGeometryImportWorkspaceResponse,
  referenceGeometryImportWorkspaceResponseEnvelope
} from "../bobercad/app/ui/commands/data-surface-metadata.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const EXPECTED_REQUEST_ID = "referenceGeometryImportWorkspaceRequest";
const EXPECTED_REQUEST_KIND = "reference-geometry-import-workspace-command";
const EXPECTED_COMMAND_ID = "model.referenceGeometry.import";
const EXPECTED_IMPORTER = path.join(ROOT, "tools/reference-geometry/import_reference_geometry_asset.mjs");
const HOST_ID = "referenceGeometryImportWorkspaceCommandHost";
const HOST_VERSION = "0.1.0";
const DEFAULT_TIMEOUT_MS = 0;
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_BYTES = 1024 * 1024;
const EXPECTED_STAGE_IDS = new Set([
  "source-discovery",
  "adapter-preflight",
  "plan-only",
  "adapter-request",
  "dry-run",
  "import",
  "check-references"
]);
const STAGE_COMMAND_FLAGS = Object.freeze({
  "--describe-source": "source-discovery",
  "--check-adapters": "adapter-preflight",
  "--plan-only": "plan-only",
  "--write-adapter-request": "adapter-request",
  "--dry-run": "dry-run",
  "--check-references": "check-references"
});
const UNSUPPORTED_WORKSPACE_REQUEST_FLAGS = new Set([
  "--list-adapters",
  "--list-formats",
  "--list-format-groups",
  "--list-import-discovery",
  "--list-translation-discovery"
]);
let safeHostArgvFlagSet = null;

main().catch((error) => {
  const hostError = pathFreeFailureMessage(error, "Workspace command host failed.");
  const response = hostResponse({
    request: {},
    hostError
  }, {
    commandStarted: false,
    hostError
  });
  writeStdout(response);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const request = await readRequest(args);
  const validation = validateRequest(request);
  let response;
  if (!validation.ok) {
    response = hostResponse({
      request: plainObject(request) ? request : {},
      hostError: validation.error
    }, {
      commandStarted: false,
      hostError: validation.error,
      validationErrors: validation.errors,
      argvFlags: hostArgvFlags(request?.argv)
    }, {}, { includeRawResponse: args.includeRawResponse });
  } else if (validation.requestBlocked) {
    const blockedRequest = validation.request || request;
    response = hostResponse({ request: blockedRequest }, {
      commandStarted: false,
      requestBlocked: true,
      argvFlags: hostArgvFlags(blockedRequest.argv)
    }, {}, { includeRawResponse: args.includeRawResponse });
  } else {
    const commandResult = await runRequestArgv(request.argv, {
      timeoutMs: args.timeoutMs
    });
    const parsed = parseJsonStdout(commandResult.stdoutText);
    response = hostResponse({
      request,
      exitCode: commandResult.exitCode,
      resultJson: parsed.value,
      stdoutText: commandResult.stdoutText,
      stderrText: commandResult.stderrText,
      hostError: commandResult.hostError
    }, {
      commandStarted: commandResult.commandStarted,
      requestedCommand: request.argv[0],
      resolvedCommand: commandResult.resolvedCommand,
      cliEntrypoint: EXPECTED_IMPORTER,
      shell: false,
      cwd: ROOT,
      exitCode: commandResult.exitCode,
      signal: commandResult.signal,
      timedOut: commandResult.timedOut,
      stdoutBytes: commandResult.stdoutBytes,
      stderrBytes: commandResult.stderrBytes,
      stdoutTruncated: commandResult.stdoutTruncated,
      stderrTruncated: commandResult.stderrTruncated,
      jsonStdoutParsed: parsed.ok,
      jsonParseError: parsed.error,
      argvFlags: hostArgvFlags(request.argv)
    }, {
      resultJson: parsed.value,
      stdoutText: commandResult.stdoutText,
      stderrText: commandResult.stderrText
    }, { includeRawResponse: args.includeRawResponse });
  }
  if (args.outputPath) writeJsonAtomic(args.outputPath, response);
  writeStdout(response);
  process.exitCode = response.responseStatus === "host-error" || response.responseStatus === "missing-json-result" ? 1 : 0;
}

function parseArgs(argv) {
  const parsed = {
    requestPath: "",
    requestJsonBase64: "",
    outputPath: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    includeRawResponse: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--request") {
      parsed.requestPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--request-json-base64") {
      parsed.requestJsonBase64 = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = positiveInteger(requiredValue(argv, index, arg), arg, { allowZero: true });
      index += 1;
      continue;
    }
    if (arg === "--include-raw-response") {
      parsed.includeRawResponse = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

function usage() {
  return [
    "Usage: node scripts/run_reference_import_workspace_request.mjs [--request <request.json> | --request-json-base64 <base64>] [--output <response.json>] [--timeout-ms <ms>]",
    "",
    "Reads a referenceGeometryImportWorkspaceRequest JSON envelope, runs its whitelisted argv without a shell,",
    "parses JSON stdout, and prints a referenceGeometryImportWorkspaceResponse JSON envelope.",
    "Raw parsed result/stdout/stderr/debug paths require --include-raw-response.",
    "If --request is omitted, the request JSON is read from stdin.",
    ""
  ].join("\n");
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function positiveInteger(value, flag, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be ${allowZero ? "zero or " : ""}a positive integer`);
  }
  return number;
}

async function readRequest(args = {}) {
  if (args.requestPath && args.requestJsonBase64) {
    throw new Error("--request and --request-json-base64 are mutually exclusive");
  }
  let text = "";
  try {
    text = args.requestJsonBase64
      ? decodeBase64Utf8(args.requestJsonBase64)
      : args.requestPath
        ? fs.readFileSync(path.resolve(process.cwd(), args.requestPath), "utf8")
        : await readStdin();
  } catch {
    throw new Error("Request JSON must be readable.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request JSON must be valid JSON.");
  }
}

function decodeBase64Utf8(encoded = "") {
  try {
    return Buffer.from(cleanString(encoded), "base64").toString("utf8");
  } catch {
    throw new Error("--request-json-base64 must decode to UTF-8 JSON.");
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

function validateRequest(request) {
  const errors = [];
  if (!plainObject(request)) {
    return { ok: false, error: "Workspace request must be a JSON object.", errors: ["request-not-object"] };
  }
  if (request.id !== EXPECTED_REQUEST_ID) errors.push("unexpected-request-id");
  if (request.requestKind !== EXPECTED_REQUEST_KIND) errors.push("unexpected-request-kind");
  if (request.commandId !== EXPECTED_COMMAND_ID) errors.push("unexpected-command-id");
  if (request.shellStringAvailable === true) errors.push("shell-string-not-accepted");
  if (request.commandHostBoundary?.acceptsShellString === true) errors.push("shell-boundary-not-accepted");
  const promotedWriteBlockedRequest = blockedPromotedWriteRequest(request);
  if (promotedWriteBlockedRequest) {
    return {
      ok: errors.length === 0,
      requestBlocked: true,
      error: errors.join("; "),
      errors,
      request: promotedWriteBlockedRequest
    };
  }
  if (request.canSubmitToCommandHost === false || cleanString(request.blockedReason)) {
    return {
      ok: errors.length === 0,
      requestBlocked: true,
      error: errors.join("; "),
      errors
    };
  }
  if (!Array.isArray(request.argv) || request.argv.length < 2) {
    errors.push("argv-missing");
  } else {
    const argvCommand = typeof request.argv[0] === "string" ? request.argv[0] : "";
    const argvEntrypoint = typeof request.argv[1] === "string" ? request.argv[1] : "";
    if (!request.argv.every((item) => typeof item === "string" && item.length > 0)) errors.push("argv-items-must-be-strings");
    if (!nodeCommandAllowed(argvCommand)) errors.push("argv-command-not-node");
    if (path.resolve(ROOT, argvEntrypoint) !== EXPECTED_IMPORTER) errors.push("argv-entrypoint-not-importer");
    if (!request.argv.includes("--json")) errors.push("argv-missing-json-flag");
    const argvStage = classifyArgvStage(request.argv);
    const declaredStage = cleanString(request.stageId);
    if (!EXPECTED_STAGE_IDS.has(declaredStage)) errors.push("stage-id-unknown");
    if (argvStage === "ambiguous") errors.push("argv-stage-ambiguous");
    if (argvStage === "unsupported") errors.push("argv-stage-unsupported");
    if (EXPECTED_STAGE_IDS.has(declaredStage) && EXPECTED_STAGE_IDS.has(argvStage) && declaredStage !== argvStage) {
      errors.push("argv-stage-mismatch");
    }
  }
  return {
    ok: errors.length === 0,
    requestBlocked: false,
    error: errors.join("; "),
    errors
  };
}

function blockedPromotedWriteRequest(request = {}) {
  const promotesWrites = request.stageId === "import"
    || request.executionMode === "import"
    || request.promotedWriteStage === true
    || request.writesProjectJson === true
    || request.writesReferenceFiles === true
    || request.sideEffectClass === "promoted-project-and-reference-write"
    || argvLooksLikePromotedImport(request.argv);
  if (!promotesWrites || request.writeConfirmed === true) return null;
  return {
    ...request,
    ok: false,
    canSubmitToCommandHost: false,
    blockedReason: "write-confirmation-required",
    safeNextAction: "confirm-promoted-write",
    writeConfirmed: false
  };
}

function argvLooksLikePromotedImport(argv = []) {
  if (!Array.isArray(argv) || argv.length < 2) return false;
  if (path.resolve(ROOT, argv[1] || "") !== EXPECTED_IMPORTER) return false;
  const flags = argvFlags(argv.slice(2));
  const noPromotedWriteFlags = new Set([
    "--describe-source",
    "--plan-only",
    "--dry-run",
    "--write-adapter-request",
    "--check-references",
    "--check-adapters",
    "--list-adapters",
    "--list-formats",
    "--list-format-groups",
    "--list-import-discovery",
    "--list-translation-discovery"
  ]);
  return ![...flags].some((flag) => noPromotedWriteFlags.has(flag));
}

function classifyArgvStage(argv = []) {
  if (!Array.isArray(argv) || argv.length < 2) return "";
  if (path.resolve(ROOT, argv[1] || "") !== EXPECTED_IMPORTER) return "";
  const flags = argvFlags(argv.slice(2));
  const stages = new Set();
  for (const flag of flags) {
    if (STAGE_COMMAND_FLAGS[flag]) stages.add(STAGE_COMMAND_FLAGS[flag]);
  }
  if (stages.size > 1) return "ambiguous";
  if (stages.size === 1) return [...stages][0];
  for (const flag of flags) {
    if (UNSUPPORTED_WORKSPACE_REQUEST_FLAGS.has(flag)) return "unsupported";
  }
  return "import";
}

function argvFlags(argv = []) {
  const flags = new Set();
  for (const item of argv) {
    if (typeof item !== "string" || !item.startsWith("--")) continue;
    const equalsIndex = item.indexOf("=");
    flags.add(equalsIndex > 0 ? item.slice(0, equalsIndex) : item);
  }
  return flags;
}

function nodeCommandAllowed(command = "") {
  const normalized = cleanString(command).replace(/\\/g, "/").toLowerCase();
  if (normalized === "node" || normalized === "node.exe") return true;
  return path.resolve(command) === process.execPath;
}

function runRequestArgv(argv, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const childArgs = [EXPECTED_IMPORTER, ...argv.slice(2)];
    const child = spawn(process.execPath, childArgs, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = limitedBuffer(MAX_STDOUT_BYTES);
    const stderr = limitedBuffer(MAX_STDERR_BYTES);
    let settled = false;
    let timedOut = false;
    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }
    child.stdout.on("data", (chunk) => stdout.append(chunk));
    child.stderr.on("data", (chunk) => stderr.append(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        commandStarted: false,
        resolvedCommand: process.execPath,
        exitCode: null,
        signal: "",
        timedOut,
        hostError: pathFreeFailureMessage(error, "Failed to start child command."),
        ...stdout.snapshot("stdout"),
        ...stderr.snapshot("stderr")
      });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        commandStarted: true,
        resolvedCommand: process.execPath,
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal || "",
        timedOut,
        hostError: timedOut ? "Workspace command timed out." : "",
        ...stdout.snapshot("stdout"),
        ...stderr.snapshot("stderr")
      });
    });
  });
}

function limitedBuffer(limitBytes) {
  const chunks = [];
  let totalBytes = 0;
  let storedBytes = 0;
  let truncated = false;
  return {
    append(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buffer.byteLength;
      if (storedBytes >= limitBytes) {
        truncated = true;
        return;
      }
      const remaining = limitBytes - storedBytes;
      const stored = buffer.byteLength <= remaining ? buffer : buffer.subarray(0, remaining);
      chunks.push(stored);
      storedBytes += stored.byteLength;
      if (stored.byteLength < buffer.byteLength) truncated = true;
    },
    snapshot(prefix) {
      return {
        [`${prefix}Text`]: Buffer.concat(chunks).toString("utf8"),
        [`${prefix}Bytes`]: totalBytes,
        [`${prefix}Truncated`]: truncated
      };
    }
  };
}

function parseJsonStdout(stdoutText = "") {
  const text = cleanString(stdoutText);
  if (!text) return { ok: false, value: null, error: "stdout-empty" };
  try {
    const value = JSON.parse(text);
    if (!plainObject(value)) return { ok: false, value: null, error: "stdout-json-not-object" };
    return { ok: true, value, error: "" };
  } catch {
    return { ok: false, value: null, error: "stdout-json-parse-failed" };
  }
}

function hostResponse(input = {}, hostRunner = {}, extra = {}, { includeRawResponse = false } = {}) {
  const response = referenceGeometryImportWorkspaceResponse(input);
  const fullResponse = includeRawResponse === true ? { ...response, ...extra } : response;
  return {
    ...fullResponse,
    rawResponseIncluded: includeRawResponse === true,
    responseEnvelope: referenceGeometryImportWorkspaceResponseEnvelope(fullResponse),
    hostRunner: hostRunnerSummary(hostRunner, { includeRawResponse })
  };
}

function hostRunnerSummary(hostRunner = {}, { includeRawResponse = false } = {}) {
  const safe = {
    id: HOST_ID,
    version: HOST_VERSION,
    commandStarted: hostRunner.commandStarted === true,
    requestBlocked: hostRunner.requestBlocked === true,
    shell: false,
    parsesHumanOutput: false,
    parsesJsonStdout: true,
    exitCode: Number.isInteger(hostRunner.exitCode) ? hostRunner.exitCode : null,
    timedOut: hostRunner.timedOut === true,
    stdoutBytes: nonNegativeInteger(hostRunner.stdoutBytes),
    stderrBytes: nonNegativeInteger(hostRunner.stderrBytes),
    stdoutTruncated: hostRunner.stdoutTruncated === true,
    stderrTruncated: hostRunner.stderrTruncated === true,
    jsonStdoutParsed: hostRunner.jsonStdoutParsed === true,
    jsonParseError: cleanString(hostRunner.jsonParseError),
    argvFlags: safeStringArray(hostRunner.argvFlags)
  };
  if (Array.isArray(hostRunner.validationErrors)) {
    safe.validationErrors = hostRunner.validationErrors
      .map((entry) => cleanString(entry))
      .filter(Boolean);
  }
  if (includeRawResponse !== true) return safe;
  return {
    ...safe,
    cwd: ROOT,
    ...hostRunner
  };
}

function hostArgvFlags(argv = []) {
  const flags = [];
  const seen = new Set();
  const allowedFlags = hostAllowedArgvFlagSet();
  for (const item of Array.isArray(argv) ? argv : []) {
    if (typeof item !== "string" || !item.startsWith("--")) continue;
    const equalsIndex = item.indexOf("=");
    const flag = equalsIndex > 0 ? item.slice(0, equalsIndex) : item;
    if (!allowedFlags.has(flag)) continue;
    if (seen.has(flag)) continue;
    seen.add(flag);
    flags.push(flag);
  }
  return flags;
}

function hostAllowedArgvFlagSet() {
  if (safeHostArgvFlagSet) return safeHostArgvFlagSet;
  const descriptor = referenceGeometryImportCommandPlanDescriptor();
  const flags = new Set();
  for (const field of ["valueCliFlags", "noValueCliFlags"]) {
    for (const flag of descriptor?.[field] || []) {
      if (typeof flag === "string" && flag.startsWith("--")) flags.add(flag);
    }
  }
  for (const group of [
    descriptor?.stageRequiredCliFlags,
    descriptor?.stageOptionalCliFlags,
    descriptor?.stageCommandFlags
  ]) {
    for (const flagList of Object.values(group || {})) {
      for (const flag of flagList || []) {
        if (typeof flag === "string" && flag.startsWith("--")) flags.add(flag);
      }
    }
  }
  for (const flag of Object.values(descriptor?.cliFlagBindings || {})) {
    if (typeof flag === "string" && flag.startsWith("--")) flags.add(flag);
  }
  safeHostArgvFlagSet = flags;
  return safeHostArgvFlagSet;
}

function safeStringArray(value = []) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const item = cleanString(entry);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function pathFreeFailureMessage(error, fallback) {
  const code = cleanString(error?.code);
  if (code === "ENOENT") return "required file was not found";
  if (code === "EACCES" || code === "EPERM") return "filesystem permission denied";
  if (code === "ENOTDIR") return "expected directory path is not a directory";
  if (code === "EISDIR") return "expected file path is a directory";
  if (code === "EEXIST") return "filesystem target already exists";
  if (code) return `filesystem error: ${code}`;
  return cleanString(fallback) || "Workspace command host failed.";
}

function writeJsonAtomic(outputPath, value) {
  const target = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

function writeStdout(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value = "") {
  return typeof value === "string" ? value.trim() : "";
}
