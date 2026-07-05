#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { assertAdapterRequestContract, assertAdapterScratchPath, assertAdapterStagePath } from "./adapter_request_contract.mjs";
import { assertAdapterOutputContract } from "./adapter_output_contract.mjs";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../../..");
const TRANSLATOR = path.join(ROOT, "tools/reference-geometry/translate_reference_geometry.mjs");
const BRIDGE_TRANSLATOR = "bobercad-dwg-dxf-bridge-adapter";
const BRIDGE_VERSION = "0.1.0";
const LOG_STREAM_TEXT_LIMIT_BYTES = 4096;
const DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const SUPPORTED_REQUEST_FORMATS = {
  dwg: new Set(["dwg"]),
  dxf: new Set(["dxf"])
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--request") args.request = argv[++index];
    else if (arg.startsWith("--request=")) args.request = arg.slice("--request=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureString(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`Adapter request ${label} must be a non-empty string`);
  return value;
}

function safeStem(value) {
  const stem = String(value || "source").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "");
  return stem || "source";
}

function boolEnv(name) {
  const rawValue = String(process.env[name] || "").trim();
  if (!rawValue) return false;
  if (/\{[A-Za-z0-9_]+\}/.test(rawValue)) throw new Error(`${name} must not contain placeholders`);
  if (/^(1|true|yes|on)$/i.test(rawValue)) return true;
  if (/^(0|false|no|off)$/i.test(rawValue)) return false;
  throw new Error(`${name} must be one of 1, 0, true, false, yes, no, on, or off`);
}

function positiveIntegerEnv(name, fallback) {
  const rawValue = String(process.env[name] || "").trim();
  if (!rawValue) return fallback;
  if (/\{[A-Za-z0-9_]+\}/.test(rawValue)) throw new Error(`${name} must not contain placeholders`);
  if (!/^[1-9]\d*$/.test(rawValue)) throw new Error(`${name} must be a positive integer byte count`);
  return Number(rawValue);
}

function appendLog(request, text) {
  if (!request.adapterLogPath) return;
  fs.mkdirSync(path.dirname(request.adapterLogPath), { recursive: true });
  fs.appendFileSync(request.adapterLogPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function boundedText(text, limitBytes = LOG_STREAM_TEXT_LIMIT_BYTES) {
  const value = String(text ?? "");
  const sizeBytes = Buffer.byteLength(value, "utf8");
  if (sizeBytes <= limitBytes) return { text: value, sizeBytes, omittedBytes: 0 };
  const clipped = Buffer.from(value, "utf8").subarray(0, limitBytes).toString("utf8");
  return {
    text: clipped,
    sizeBytes,
    omittedBytes: Math.max(0, sizeBytes - Buffer.byteLength(clipped, "utf8"))
  };
}

function logStreamText(label, text) {
  if (!text) return `${label}: <empty>`;
  const bounded = boundedText(text);
  if (!bounded.omittedBytes) return `${label}:\n${bounded.text}`;
  return `${label} (${bounded.sizeBytes} byte(s), clipped to ${LOG_STREAM_TEXT_LIMIT_BYTES} byte(s), ${bounded.omittedBytes} byte(s) omitted):\n${bounded.text}`;
}

function processFailureDetail(stderr, stdout) {
  const detail = [stderr, stdout].filter(Boolean).join("\n").trim();
  if (!detail) return "";
  const bounded = boundedText(detail);
  const suffix = bounded.omittedBytes
    ? `\n<${bounded.omittedBytes} byte(s) omitted from process output>`
    : "";
  return `${bounded.text}${suffix}`;
}

function scalarReplacements(request, requestPath, convertedDxfPath) {
  const replacements = {
    request: requestPath,
    dxf: convertedDxfPath,
    convertedDxf: convertedDxfPath
  };
  for (const [key, value] of Object.entries(request || {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      replacements[key] = String(value);
    }
  }
  return replacements;
}

function expandTemplate(value, replacements) {
  return String(value).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    if (!Object.hasOwn(replacements, key)) throw new Error(`Unsupported DWG bridge placeholder ${match}`);
    return replacements[key];
  });
}

function resolveConvertedDxfOutput(rawOutput, defaultDxfPath, replacements) {
  if (/^(-|stdout)$/i.test(String(rawOutput || "").trim())) {
    return {
      convertedDxfPath: defaultDxfPath,
      useStdout: true
    };
  }
  return {
    convertedDxfPath: path.resolve(expandTemplate(rawOutput || defaultDxfPath, replacements)),
    useStdout: false
  };
}

function parseArgsString(raw, label) {
  const args = [];
  let current = "";
  let quote = null;
  const text = String(raw || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\\" && next !== undefined && (next === "\\" || next === "\"" || next === "'" || /\s/.test(next))) {
      current += next;
      index += 1;
    } else if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (quote) throw new Error(`${label} has an unterminated quoted argument`);
  if (current) args.push(current);
  if (!args.length) throw new Error(`${label} must contain at least one argument`);
  return args;
}

function parseArgsTemplate(rawJson, rawArgs, replacements) {
  const numberedArgs = Object.entries(process.env)
    .map(([key, value]) => {
      const match = /^BOBERCAD_DWG_TO_DXF_ARG_(\d+)$/.exec(key);
      return match ? [Number(match[1]), value] : null;
    })
    .filter(Boolean)
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => expandTemplate(value, replacements));
  if (numberedArgs.length) return numberedArgs;
  if (rawJson) {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (error) {
      throw new Error(`BOBERCAD_DWG_TO_DXF_ARGS_JSON must be a JSON string array: ${error.message}`);
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("BOBERCAD_DWG_TO_DXF_ARGS_JSON must be a JSON string array");
    }
    return parsed.map((value) => expandTemplate(value, replacements));
  }
  if (rawArgs) return parseArgsString(rawArgs, "BOBERCAD_DWG_TO_DXF_ARGS").map((value) => expandTemplate(value, replacements));
  return ["--input", "{input}", "--output", "{dxf}"].map((value) => expandTemplate(value, replacements));
}

function runProcess(label, command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env || process.env,
    shell: options.shell === true,
    timeout: options.timeoutMs,
    maxBuffer: options.streamMaxBufferBytes || DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES,
    windowsHide: true
  });
  if (result.error) {
    if (result.error.code === "ENOBUFS") {
      throw new Error(`${label} exceeded the ${options.streamMaxBufferBytes || DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES} byte process stream buffer`);
    }
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = processFailureDetail(result.stderr, result.stdout);
    throw new Error(`${label} failed with exit code ${result.status}${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function normalizeBridgeOutput(outputPath, request, { converted }) {
  const manifest = readJson(outputPath);
  if (!manifest.asset || typeof manifest.asset !== "object" || Array.isArray(manifest.asset)) manifest.asset = {};
  if (!manifest.asset.source || typeof manifest.asset.source !== "object" || Array.isArray(manifest.asset.source)) {
    manifest.asset.source = {};
  }
  manifest.asset.source.format = request.format;
  manifest.asset.source.requestedFormat = request.requestedFormat;
  if (request.sourceFileName) manifest.asset.source.fileName = request.sourceFileName;
  if (request.sourceFileExtension !== undefined) manifest.asset.source.fileExtension = request.sourceFileExtension;
  if (Number.isInteger(request.sourceFileSizeBytes)) manifest.asset.source.fileSizeBytes = request.sourceFileSizeBytes;
  if (request.sourceFileModifiedTime) manifest.asset.source.modifiedTime = request.sourceFileModifiedTime;
  if (request.sourceStatFingerprint) manifest.asset.source.statFingerprint = request.sourceStatFingerprint;
  if (request.adapterKey) manifest.asset.source.adapterKey = request.adapterKey;
  manifest.asset.source.translator = BRIDGE_TRANSLATOR;
  manifest.asset.source.translatorVersion = BRIDGE_VERSION;
  delete manifest.asset.source.checksum;
  if (!Array.isArray(manifest.diagnostics)) manifest.diagnostics = [];
  manifest.diagnostics.push({
    severity: "info",
    code: converted ? "dwg-dxf-bridge-converted" : "dwg-dxf-bridge-dxf-passthrough",
    message: converted
      ? "Converted source to staged DXF before canonical DXF translation."
      : "Translated DXF source through the DWG/DXF bridge adapter without conversion."
  });
  writeJson(outputPath, manifest);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestPath = path.resolve(ensureString(args.request, "path"));
  const request = readJson(requestPath);
  assertAdapterRequestContract(request, requestPath, {
    formatAliases: SUPPORTED_REQUEST_FORMATS,
    formatErrorMessage: "DWG bridge adapter expects a DWG or DXF request"
  });

  const output = path.resolve(ensureString(request.output, "output"));
  const input = path.resolve(ensureString(request.input, "input"));
  const stageDir = path.resolve(ensureString(request.stageDir, "stageDir"));
  const scratchDir = path.resolve(ensureString(request.scratchDir || request.stageDir, "scratchDir"));
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const timeoutMs = Number.isInteger(request.timeoutMs) ? request.timeoutMs : 120000;
  const streamMaxBufferBytes = positiveIntegerEnv("BOBERCAD_DWG_TO_DXF_STREAM_MAX_BUFFER_BYTES", DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES);
  const shouldConvertDwg = request.format === "dwg";
  let dxfInputPath = input;
  let convertedDxfPath = null;
  if (shouldConvertDwg) {
    const defaultDxfPath = path.join(scratchDir, `${safeStem(request.sourceFileStem)}.converted.dxf`);
    const preReplacements = scalarReplacements(request, requestPath, defaultDxfPath);
    const convertedDxfOutput = resolveConvertedDxfOutput(process.env.BOBERCAD_DWG_TO_DXF_OUTPUT, defaultDxfPath, preReplacements);
    convertedDxfPath = assertAdapterScratchPath(convertedDxfOutput.convertedDxfPath, scratchDir, "convertedDxfPath", requestPath);
    const replacements = scalarReplacements(request, requestPath, convertedDxfPath);
    fs.mkdirSync(path.dirname(convertedDxfPath), { recursive: true });
    dxfInputPath = convertedDxfPath;
    const converterCommand = process.env.BOBERCAD_DWG_TO_DXF_COMMAND;
    if (!converterCommand) {
      throw new Error("BOBERCAD_DWG_TO_DXF_COMMAND is required for DWG requests");
    }
    const converterArgs = parseArgsTemplate(process.env.BOBERCAD_DWG_TO_DXF_ARGS_JSON, process.env.BOBERCAD_DWG_TO_DXF_ARGS, replacements);
    const converterCwd = assertAdapterStagePath(
      path.resolve(expandTemplate(process.env.BOBERCAD_DWG_TO_DXF_CWD || stageDir, replacements)),
      stageDir,
      "converterCwd",
      requestPath
    );
    appendLog(request, `DWG bridge converter command: ${converterCommand}`);
    appendLog(request, `DWG bridge converter args: ${JSON.stringify(converterArgs)}`);
    const converter = runProcess("DWG to DXF converter", converterCommand, converterArgs, {
      cwd: converterCwd,
      shell: boolEnv("BOBERCAD_DWG_TO_DXF_SHELL"),
      timeoutMs,
      streamMaxBufferBytes
    });
    if (convertedDxfOutput.useStdout) {
      if (!converter.stdout?.trim()) throw new Error("DWG to DXF converter stdout did not contain DXF text");
      fs.writeFileSync(convertedDxfPath, converter.stdout, "utf8");
      appendLog(request, `DWG bridge converter stdout captured as DXF text: ${Buffer.byteLength(converter.stdout, "utf8")} byte(s)`);
    } else {
      appendLog(request, logStreamText("DWG bridge converter stdout", converter.stdout));
    }
    appendLog(request, logStreamText("DWG bridge converter stderr", converter.stderr));
    if (!fs.existsSync(convertedDxfPath)) {
      throw new Error(`DWG to DXF converter did not write expected DXF output: ${convertedDxfPath}`);
    }
  } else {
    appendLog(request, "DXF request received by DWG bridge adapter; using input DXF directly.");
  }
  const translated = runProcess("Canonical DXF translator", process.execPath, [
    TRANSLATOR,
    "--input",
    dxfInputPath,
    "--output",
    output,
    "--format",
    "dxf",
    "--asset-id",
    ensureString(request.assetId, "assetId"),
    "--name",
    ensureString(request.name, "name"),
    "--units",
    ensureString(request.units, "units"),
    "--point-cloud-chunk-size",
    String(request.pointCloudChunkSize || 50000),
    "--json"
  ], {
    cwd: ROOT,
    timeoutMs,
    streamMaxBufferBytes
  });
  appendLog(request, logStreamText("Canonical DXF translator stdout", translated.stdout));
  appendLog(request, logStreamText("Canonical DXF translator stderr", translated.stderr));
  normalizeBridgeOutput(output, request, { converted: shouldConvertDwg });
  assertAdapterOutputContract(output, request, requestPath);
  console.log(shouldConvertDwg
    ? `DWG bridge adapter converted ${path.basename(input)} through ${path.basename(convertedDxfPath)}`
    : `DWG bridge adapter translated DXF input ${path.basename(input)}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
