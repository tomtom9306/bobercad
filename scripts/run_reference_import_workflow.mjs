#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  referenceGeometryImportCommandPlanDescriptor,
  referenceGeometryImportSessionState,
  referenceGeometryImportWorkspaceResponseEnvelope
} from "../bobercad/app/ui/commands/data-surface-metadata.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const HOST_RUNNER = path.join(ROOT, "scripts/run_reference_import_workspace_request.mjs");
const WORKFLOW_RUN_ID = "referenceGeometryImportWorkflowRun";
const WORKFLOW_RUN_VERSION = "0.1.0";
const DEFAULT_UNTIL_STAGE = "dry-run";
const DEFAULT_TIMEOUT_MS = 0;
const DEFAULT_MAX_STEPS = 8;
const STAGE_ORDER = Object.freeze([
  "source-discovery",
  "plan-only",
  "adapter-preflight",
  "adapter-request",
  "dry-run",
  "import",
  "check-references"
]);
let safeWorkflowArgvFlagSet = null;

main().catch((error) => {
  const result = workflowResult({
    ok: false,
    runStatus: "host-error",
    stopReason: pathFreeFailureMessage(error, "reference import workflow runner failed"),
    responses: [],
    options: {}
  });
  writeStdout(result);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const run = await runWorkflow(options);
  if (options.outputPath) writeJsonAtomic(options.outputPath, run);
  writeStdout(run);
  process.exitCode = run.ok ? 0 : 1;
}

function parseArgs(argv) {
  const parsed = {
    projectPath: "",
    inputPath: "",
    formatToken: "",
    adapterConfigPath: "",
    adapterName: "",
    adapterTimeoutMs: "",
    pointCloudChunkSize: "",
    units: "",
    requestPath: "",
    referencesDir: "",
    assetId: "",
    name: "",
    replaceExisting: false,
    visible: "",
    snapEnabled: "",
    opacity: "",
    color: "",
    edgeColor: "",
    pointSize: "",
    origin: "",
    axisX: "",
    axisY: "",
    axisZ: "",
    scale: "",
    startStage: "",
    untilStage: DEFAULT_UNTIL_STAGE,
    confirmImport: false,
    summaryOnly: false,
    outputPath: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxSteps: DEFAULT_MAX_STEPS,
    includeRawResponses: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--options-json-base64") {
      Object.assign(parsed, workflowOptionsFromBase64(requiredValue(argv, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--project") {
      parsed.projectPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--input") {
      parsed.inputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--format") {
      parsed.formatToken = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--adapter-config") {
      parsed.adapterConfigPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--adapter") {
      parsed.adapterName = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--adapter-timeout-ms") {
      parsed.adapterTimeoutMs = String(positiveInteger(requiredValue(argv, index, arg), arg));
      index += 1;
      continue;
    }
    if (arg === "--point-cloud-chunk-size") {
      parsed.pointCloudChunkSize = String(positiveInteger(requiredValue(argv, index, arg), arg));
      index += 1;
      continue;
    }
    if (arg === "--units") {
      parsed.units = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--request") {
      parsed.requestPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--references-dir") {
      parsed.referencesDir = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--asset-id") {
      parsed.assetId = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--name") {
      parsed.name = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--replace-existing") {
      parsed.replaceExisting = true;
      continue;
    }
    if (arg === "--visible") {
      parsed.visible = booleanToken(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--snap-enabled") {
      parsed.snapEnabled = booleanToken(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--opacity") {
      parsed.opacity = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--color") {
      parsed.color = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--edge-color") {
      parsed.edgeColor = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--point-size") {
      parsed.pointSize = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--origin") {
      parsed.origin = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--axis-x") {
      parsed.axisX = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--axis-y") {
      parsed.axisY = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--axis-z") {
      parsed.axisZ = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--scale") {
      parsed.scale = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--until") {
      parsed.untilStage = knownStage(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--start") {
      parsed.startStage = knownStage(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--confirm-import") {
      parsed.confirmImport = true;
      continue;
    }
    if (arg === "--summary-only") {
      parsed.summaryOnly = true;
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
    if (arg === "--max-steps") {
      parsed.maxSteps = positiveInteger(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--include-raw-responses") {
      parsed.includeRawResponses = true;
      continue;
    }
    throw new Error("Unknown option.");
  }
  parsed.untilStage = knownStage(parsed.untilStage, "--until");
  return parsed;
}

function usage() {
  return [
    "Usage: node scripts/run_reference_import_workflow.mjs --input <source> [--project <project.json>] [options]",
    "",
    "Runs the Reference Import workflow outside browser runtime through app-side session/request metadata",
    "and the trusted workspace command host. The default target is dry-run, which writes no project JSON",
    "or target reference manifest. Use --confirm-import with --until import before promoted writes",
    "are allowed. Use --until adapter-preflight without --input to check adapter dependencies,",
    "or --until check-references without --input to audit existing project references.",
    "",
    "Options:",
    "  --options-json-base64 <b64>  UTF-8 JSON workflow options, useful for UI copy/paste handoff.",
    "  --project <path>          Project JSON path for plan/dry-run/import/check stages.",
    "  --input <path>            Source DXF/DWG/STEP/IFC/E57/canonical JSON path.",
    "  --format <token>          Optional explicit source format token.",
    "  --adapter-config <path>   Optional external adapter config.",
    "  --adapter <name>          Optional adapter key from the adapter config.",
    "  --adapter-timeout-ms <ms> Optional external adapter timeout for importer stages.",
    "  --point-cloud-chunk-size <count> Optional E57-style point-cloud chunk size.",
    "  --units <mm|m|in|ft>      Optional source unit override.",
    "  --request <path>          Adapter-request output path for adapter-request stage.",
    "  --references-dir <path>   Optional reference directory for check-references.",
    "  --asset-id <id>           Optional project reference asset id.",
    "  --name <label>            Optional project reference display name.",
    "  --replace-existing        Refresh an existing reference asset with the same asset id.",
    "  --visible <true|false>    Optional project reference visibility override.",
    "  --snap-enabled <true|false> Optional project reference snap policy override.",
    "  --opacity <number>        Optional project reference opacity override.",
    "  --color <hex>             Optional project reference color override.",
    "  --edge-color <hex>        Optional project reference edge color override.",
    "  --point-size <number>     Optional project reference point size override.",
    "  --origin <x,y,z>          Optional project reference transform origin.",
    "  --axis-x <x,y,z>          Optional project reference transform X axis.",
    "  --axis-y <x,y,z>          Optional project reference transform Y axis.",
    "  --axis-z <x,y,z>          Optional project reference transform Z axis.",
    "  --scale <number>          Optional project reference transform scale.",
    "  --start <stage>           Optional first workflow stage for direct retry/preflight handoff.",
    "  --until <stage>           source-discovery, adapter-preflight, plan-only, adapter-request, dry-run, import, or check-references.",
    "  --confirm-import          Allows promoted import writes when the target reaches import.",
    "  --summary-only            Use bounded audit summary output for check-references.",
    "  --include-raw-responses   Include full host responses for CLI debugging; omitted by default.",
    "  --output <path>           Write the workflow JSON result to a file as well as stdout.",
    "  --timeout-ms <ms>         Per-command host timeout; 0 disables timeout.",
    ""
  ].join("\n");
}

function workflowOptionsFromBase64(encoded = "") {
  let value;
  try {
    value = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("--options-json-base64 must decode to valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("--options-json-base64 must decode to a JSON object");
  }
  const options = {};
  for (const field of ["projectPath", "inputPath", "formatToken", "adapterConfigPath", "adapterName", "units", "requestPath", "referencesDir", "assetId", "name", "opacity", "color", "edgeColor", "pointSize", "origin", "axisX", "axisY", "axisZ", "scale", "outputPath"]) {
    if (value[field] !== undefined && value[field] !== null) options[field] = String(value[field]);
  }
  if (value.replaceExisting !== undefined && value.replaceExisting !== null) {
    options.replaceExisting = booleanFlag(value.replaceExisting, "--options-json-base64.replaceExisting");
  }
  if (value.visible !== undefined && value.visible !== null) {
    options.visible = booleanToken(value.visible, "--options-json-base64.visible");
  }
  if (value.snapEnabled !== undefined && value.snapEnabled !== null) {
    options.snapEnabled = booleanToken(value.snapEnabled, "--options-json-base64.snapEnabled");
  }
  if (value.adapterTimeoutMs !== undefined && value.adapterTimeoutMs !== null) {
    options.adapterTimeoutMs = String(positiveInteger(String(value.adapterTimeoutMs), "--options-json-base64.adapterTimeoutMs"));
  }
  if (value.pointCloudChunkSize !== undefined && value.pointCloudChunkSize !== null) {
    options.pointCloudChunkSize = String(positiveInteger(String(value.pointCloudChunkSize), "--options-json-base64.pointCloudChunkSize"));
  }
  if (value.untilStage !== undefined && value.untilStage !== null) {
    options.untilStage = knownStage(String(value.untilStage), "--options-json-base64.untilStage");
  }
  if (value.startStage !== undefined && value.startStage !== null) {
    options.startStage = knownStage(String(value.startStage), "--options-json-base64.startStage");
  }
  if (value.confirmImport !== undefined && value.confirmImport !== null) {
    options.confirmImport = value.confirmImport === true;
  }
  if (value.summaryOnly !== undefined && value.summaryOnly !== null) {
    options.summaryOnly = value.summaryOnly === true;
  }
  if (value.timeoutMs !== undefined && value.timeoutMs !== null) {
    options.timeoutMs = positiveInteger(String(value.timeoutMs), "--options-json-base64.timeoutMs", { allowZero: true });
  }
  if (value.maxSteps !== undefined && value.maxSteps !== null) {
    options.maxSteps = positiveInteger(String(value.maxSteps), "--options-json-base64.maxSteps");
  }
  if (value.includeRawResponses !== undefined && value.includeRawResponses !== null) {
    options.includeRawResponses = booleanFlag(value.includeRawResponses, "--options-json-base64.includeRawResponses");
  }
  return options;
}

async function runWorkflow(options) {
  const responses = [];
  const requestEntries = [];
  let lastWorkspaceResponse = null;
  let requestedStageId = workflowStartStage(options);
  let stopReason = "";
  let runStatus = "running";
  let session = null;

  for (let step = 0; step < options.maxSteps; step += 1) {
    session = referenceGeometryImportSessionState(sessionInput(options, {
      requestedStageId,
      lastWorkspaceResponse
    }));
    requestedStageId = "";
    const currentStage = session.currentStageId || "";
    if (!currentStage) {
      stopReason = "missing-current-stage";
      runStatus = "stopped";
      break;
    }
    if (Array.isArray(session.completedWorkflowStages) && session.completedWorkflowStages.includes(options.untilStage)) {
      stopReason = "target-stage-complete";
      runStatus = "completed";
      break;
    }
    if (currentStage === "import" && options.confirmImport !== true) {
      stopReason = "import-confirmation-required";
      runStatus = "stopped";
      break;
    }
    const request = session.nextWorkspaceRequest;
    if (!request || session.canSubmitNextRequest !== true) {
      stopReason = workflowBlockedStopReason(session, request);
      runStatus = "stopped";
      break;
    }
    requestEntries.push(workflowRequestEntry(request, {
      includeRawRequest: options.includeRawResponses === true
    }));
    const response = await runHostRequest(request, {
      timeoutMs: options.timeoutMs,
      includeRawResponse: options.includeRawResponses === true
    });
    responses.push(response);
    lastWorkspaceResponse = response;
    if (response.responseStatus !== "succeeded") {
      stopReason = response.safeNextAction || response.responseStatus || "workspace-response-failed";
      runStatus = "failed";
      break;
    }
    if (currentStage === options.untilStage) {
      stopReason = "target-stage-complete";
      runStatus = "completed";
      break;
    }
    requestedStageId = workflowNextRequestedStage({ options, currentStage });
  }

  if (runStatus === "running") {
    stopReason = "max-steps-exceeded";
    runStatus = "stopped";
  }

  const finalResponse = responses[responses.length - 1] || null;
  const ok = runStatus === "completed" && (!finalResponse || finalResponse.responseStatus === "succeeded");
  return workflowResult({
    ok,
    runStatus,
    stopReason,
    responses,
    requestEntries,
    session,
    options
  });
}

function workflowStartStage(options = {}) {
  if (options.startStage) return options.startStage;
  if (options.untilStage === "adapter-preflight") return "adapter-preflight";
  if (options.untilStage === "check-references" && !options.inputPath) return "check-references";
  return "source-discovery";
}

function workflowNextRequestedStage({ options = {}, currentStage = "" } = {}) {
  if (options.untilStage === "adapter-request" && currentStage === "plan-only") return "adapter-request";
  return "";
}

function workflowBlockedStopReason(session = {}, request = null) {
  const missingInputs = Array.isArray(request?.missingInputDescriptorIds) ? request.missingInputDescriptorIds : [];
  if (session.currentStageId === "adapter-preflight" && missingInputs.includes("adapterConfigPath")) {
    return "adapter-config-required";
  }
  return session.blockedReason || request?.blockedReason || "request-not-submittable";
}

function sessionInput(options, { requestedStageId = "", lastWorkspaceResponse = null } = {}) {
  return {
    projectPath: options.projectPath,
    inputPath: options.inputPath,
    formatToken: options.formatToken,
    adapterConfigPath: options.adapterConfigPath,
    requestPath: options.requestPath,
    referencesDir: options.referencesDir,
    stageId: requestedStageId,
    writeConfirmed: options.confirmImport === true,
    lastWorkspaceResponse,
    importOptions: {
      assetId: options.assetId,
      name: options.name,
      adapterName: options.adapterName,
      adapterTimeoutMs: options.adapterTimeoutMs,
      pointCloudChunkSize: options.pointCloudChunkSize,
      units: options.units,
      replaceExisting: options.replaceExisting === true,
      visible: options.visible,
      snapEnabled: options.snapEnabled,
      opacity: options.opacity,
      color: options.color,
      edgeColor: options.edgeColor,
      pointSize: options.pointSize,
      origin: options.origin,
      axisX: options.axisX,
      axisY: options.axisY,
      axisZ: options.axisZ,
      scale: options.scale,
      summaryOnly: options.summaryOnly === true
    }
  };
}

async function runHostRequest(request, { timeoutMs = DEFAULT_TIMEOUT_MS, includeRawResponse = false } = {}) {
  const encoded = Buffer.from(JSON.stringify(request), "utf8").toString("base64");
  const args = [HOST_RUNNER, "--request-json-base64", encoded];
  if (timeoutMs > 0) args.push("--timeout-ms", String(timeoutMs));
  if (includeRawResponse === true) args.push("--include-raw-response");
  const result = await spawnJson(process.execPath, args);
  if (!result.json) {
    return {
      id: "referenceGeometryImportWorkspaceResponse",
      requestId: request.requestId || "",
      requestKind: request.requestKind || "",
      commandId: request.commandId || "",
      stageId: request.stageId || "",
      responseStatus: "host-error",
      ok: false,
      safeNextAction: "inspect-workflow-runner-result",
      hostRunner: {
        commandStarted: false,
        shell: false,
        workflowHostError: pathFreeFailureMessage(result.error, "workspace host did not return JSON"),
        stdoutBytes: utf8ByteLength(result.stdoutText),
        stderrBytes: utf8ByteLength(result.stderrText),
        exitCode: result.exitCode
      }
    };
  }
  return result.json;
}

function spawnJson(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdoutText = "";
    let stderrText = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutText += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderrText += chunk;
    });
    child.on("error", (error) => {
      resolve({
        json: null,
        stdoutText,
        stderrText,
        exitCode: null,
        error: pathFreeFailureMessage(error, "spawn failed")
      });
    });
    child.on("close", (code) => {
      try {
        resolve({
          json: JSON.parse(stdoutText),
          stdoutText,
          stderrText,
          exitCode: Number.isInteger(code) ? code : null,
          error: ""
        });
      } catch (error) {
        resolve({
          json: null,
          stdoutText,
          stderrText,
          exitCode: Number.isInteger(code) ? code : null,
          error: "JSON parse failed"
        });
      }
    });
  });
}

function workflowResult({
  ok = false,
  runStatus = "stopped",
  stopReason = "",
  responses = [],
  requestEntries = [],
  session = null,
  options = {}
} = {}) {
  const responseEntries = responses.map(workflowResponseEntry);
  const responseEnvelopes = responses
    .map((response) => referenceGeometryImportWorkspaceResponseEnvelope(response))
    .filter(Boolean);
  const blockedSummary = workflowBlockedSummary({ runStatus, session });
  const completedStages = responseEntries
    .filter((entry) => entry.responseStatus === "succeeded")
    .map((entry) => entry.stageId);
  const finalResponse = responses[responses.length - 1] || null;
  const finalWorkspaceResponseEnvelope = finalResponse
    ? referenceGeometryImportWorkspaceResponseEnvelope(finalResponse)
    : null;
  const finalFailureRouting = workflowFinalFailureRouting(finalWorkspaceResponseEnvelope);
  const result = {
    id: WORKFLOW_RUN_ID,
    version: WORKFLOW_RUN_VERSION,
    ok,
    runStatus,
    stopReason,
    startStage: options.startStage || "",
    targetStage: options.untilStage || "",
    confirmImport: options.confirmImport === true,
    promotedWritesAllowed: options.confirmImport === true,
    completedStages,
    finalStage: finalWorkspaceResponseEnvelope?.stageId || session?.currentStageId || "",
    finalResponseStatus: finalWorkspaceResponseEnvelope?.responseStatus || "",
    finalSafeNextAction: finalWorkspaceResponseEnvelope?.safeNextAction || "",
    finalFailedWorkflowStage: finalFailureRouting.failedWorkflowStage,
    finalRetryWorkflowStage: finalFailureRouting.retryWorkflowStage,
    finalFingerprintSummary: finalWorkspaceResponseEnvelope?.fingerprintSummary || {},
    blockedStage: blockedSummary.blockedStage,
    blockedReason: blockedSummary.blockedReason,
    blockedSafeNextAction: blockedSummary.blockedSafeNextAction,
    blockedMissingInputDescriptorIds: blockedSummary.blockedMissingInputDescriptorIds,
    responseCount: responses.length,
    rawResponsesIncluded: options.includeRawResponses === true,
    rawRequestsIncluded: options.includeRawResponses === true,
    requestEntries,
    responseEntries,
    responseEnvelopes,
    finalWorkspaceResponseEnvelope,
    runtimeBoundary: {
      browserRuntimeExecutesCli: false,
      browserRuntimeReadsSourceFiles: false,
      browserRuntimeWritesProjectJson: false,
      browserRuntimeWritesReferenceFiles: false,
      workflowRunnerUsesWorkspaceHost: true,
      workflowRunnerRunsShell: false
    }
  };
  if (options.includeRawResponses === true) {
    result.finalWorkspaceResponse = finalResponse;
    result.responses = responses;
  }
  return result;
}

function workflowFinalFailureRouting(envelope = null) {
  if (!envelope || envelope.responseStatus === "succeeded") {
    return {
      failedWorkflowStage: "",
      retryWorkflowStage: ""
    };
  }
  const failureDecision = envelope.failureDecision && typeof envelope.failureDecision === "object" && !Array.isArray(envelope.failureDecision)
    ? envelope.failureDecision
    : {};
  const failureSummary = envelope.referenceFailureSummary && typeof envelope.referenceFailureSummary === "object" && !Array.isArray(envelope.referenceFailureSummary)
    ? envelope.referenceFailureSummary
    : {};
  return {
    failedWorkflowStage: failureDecision.failedWorkflowStage || failureSummary.failedWorkflowStage || envelope.stageId || "",
    retryWorkflowStage: failureDecision.retryWorkflowStage || failureSummary.retryWorkflowStage || ""
  };
}

function workflowBlockedSummary({ runStatus = "", session = null } = {}) {
  if (runStatus !== "stopped" || !session || session.canSubmitNextRequest === true) {
    return {
      blockedStage: "",
      blockedReason: "",
      blockedSafeNextAction: "",
      blockedMissingInputDescriptorIds: []
    };
  }
  return {
    blockedStage: session.currentStageId || "",
    blockedReason: session.blockedReason || "",
    blockedSafeNextAction: session.nextActionToken || "",
    blockedMissingInputDescriptorIds: Array.isArray(session.nextWorkspaceRequest?.missingInputDescriptorIds)
      ? [...session.nextWorkspaceRequest.missingInputDescriptorIds]
      : []
  };
}

function workflowRequestEntry(request = {}, { includeRawRequest = false } = {}) {
  const argv = Array.isArray(request.argv) ? [...request.argv] : [];
  const entry = {
    requestId: request.requestId || "",
    stageId: request.stageId || "",
    executionMode: request.executionMode || null,
    sideEffectClass: request.sideEffectClass || "",
    canSubmitToCommandHost: request.canSubmitToCommandHost === true,
    requiresWriteConfirmation: request.requiresWriteConfirmation === true,
    writeConfirmed: request.writeConfirmed === true,
    argvFlags: workflowArgvFlags(argv)
  };
  if (includeRawRequest === true) entry.argv = argv;
  return entry;
}

function workflowArgvFlags(argv = []) {
  const flags = [];
  const seen = new Set();
  const allowedFlags = workflowAllowedArgvFlagSet();
  for (const item of argv) {
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

function workflowAllowedArgvFlagSet() {
  if (safeWorkflowArgvFlagSet) return safeWorkflowArgvFlagSet;
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
  safeWorkflowArgvFlagSet = flags;
  return safeWorkflowArgvFlagSet;
}

function workflowResponseEntry(response = {}) {
  const envelope = referenceGeometryImportWorkspaceResponseEnvelope(response) || {};
  const stageDecision = envelope.stageDecision && typeof envelope.stageDecision === "object" && !Array.isArray(envelope.stageDecision)
    ? envelope.stageDecision
    : {};
  const entry = {
    responseId: envelope.responseId || response.responseId || "",
    requestId: envelope.requestId || response.requestId || "",
    stageId: envelope.stageId || "",
    executionMode: envelope.executionMode || null,
    responseStatus: envelope.responseStatus || "",
    ok: envelope.ok === true,
    resultOk: envelope.resultOk === true,
    sourceFormat: stageDecision.sourceFormat || stageDecision.canonicalFormat || "",
    sourceRequestedFormat: stageDecision.sourceRequestedFormat || "",
    sourceRequestedFormatFamily: stageDecision.sourceRequestedFormatFamily || stageDecision.canonicalFormat || "",
    sourceRequestedFormatAliases: Array.isArray(stageDecision.sourceRequestedFormatAliases) ? [...stageDecision.sourceRequestedFormatAliases] : [],
    sourceRequestedFormatMatchesFamily: stageDecision.sourceRequestedFormatMatchesFamily ?? null,
    safeNextAction: envelope.safeNextAction || "",
    recommendedNextAction: envelope.recommendedNextAction || "",
    fingerprintSummary: envelope.fingerprintSummary || {},
    shell: response.hostRunner?.shell === true,
    commandStarted: response.hostRunner?.commandStarted === true,
    jsonStdoutParsed: response.hostRunner?.jsonStdoutParsed === true
  };
  for (const field of [
    "referenceSourceSummary",
    "adapterPreflightSummary",
    "referencePlanSummary",
    "referenceAdapterRequestSummary",
    "referenceOutputSummary",
    "referencePromotionSummary",
    "referenceAuditSummary",
    "referenceFailureSummary"
  ]) {
    if (envelope[field]) entry[field] = envelope[field];
  }
  return entry;
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

function booleanToken(value, flag) {
  if (value === true) return "true";
  if (value === false) return "false";
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "false") return text;
  throw new Error(`${flag} must be true or false`);
}

function booleanFlag(value, flag) {
  if (value === true || value === false) return value;
  return booleanToken(value, flag) === "true";
}

function knownStage(value = "", flag = "--stage") {
  const stage = String(value || "").trim();
  if (!STAGE_ORDER.includes(stage)) {
    throw new Error(`${flag} must be one of: ${STAGE_ORDER.join(", ")}`);
  }
  return stage;
}

function writeJsonAtomic(outputPath, value) {
  const target = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

function pathFreeFailureMessage(error, fallback) {
  const code = String(error?.code || "").trim();
  if (/^[A-Z0-9_]+$/.test(code)) {
    if (code === "ENOENT") return "required file was not found";
    if (code === "EACCES" || code === "EPERM") return "filesystem permission denied";
    if (code === "ENOTDIR") return "expected directory path is not a directory";
    if (code === "EISDIR") return "expected file path is a directory";
    if (code === "EEXIST") return "filesystem target already exists";
    return `filesystem error: ${code}`;
  }
  const text = String(typeof error === "string" ? error : error?.message || "");
  if (
    !text
    || text.length > 160
    || /[\\/]/.test(text)
    || text.includes("..")
    || /[\u0000-\u001f]/.test(text)
  ) {
    return fallback;
  }
  return text;
}

function utf8ByteLength(value = "") {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function writeStdout(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
