import {
  applyTooltip,
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelRow,
  dataPanelSection
} from "../design-system/ui-elements.mjs";
import {
  REFERENCE_GEOMETRY_IMPORT_ACTION_TOKENS,
  REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTORS,
  REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER,
  REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES,
  referenceGeometryImportFilePickerDescriptor,
  referenceGeometryImportSessionState,
  referenceGeometryImportWorkspaceResponseEnvelope,
  referenceGeometryImportWorkspaceResponse
} from "../commands/data-surface-metadata.mjs";

const PANEL_SPEC = Object.freeze({
  title: "Reference Import",
  icon: "reference-plane",
  emptyMessage: "No source path.",
  projectPathLabel: "Project",
  sourcePathLabel: "Source",
  formatLabel: "Format",
  adapterConfigLabel: "Adapter Config",
  adapterNameLabel: "Adapter",
  adapterTimeoutLabel: "Adapter Timeout",
  pointCloudChunkSizeLabel: "Chunk Size",
  unitsLabel: "Units",
  requestPathLabel: "Request JSON",
  referencesDirLabel: "References Dir",
  assetIdLabel: "Asset ID",
  nameLabel: "Name",
  replaceExistingLabel: "Replace",
  visibleLabel: "Visible",
  snapEnabledLabel: "Snap",
  opacityLabel: "Opacity",
  colorLabel: "Color",
  edgeColorLabel: "Edge Color",
  pointSizeLabel: "Point Size",
  originLabel: "Origin",
  axisXLabel: "Axis X",
  axisYLabel: "Axis Y",
  axisZLabel: "Axis Z",
  scaleLabel: "Scale",
  stageLabel: "Stage",
  summaryOnlyLabel: "Summary",
  writeConfirmLabel: "Write",
  stageSectionLabel: "Workflow",
  requestSectionLabel: "Workspace Request",
  responseSectionLabel: "Host Response",
  responseJsonLabel: "Result JSON",
  responseJsonPlaceholder: "{ \"ok\": true, ... }",
  applyResponseActionLabel: "Apply Result",
  clearResponseActionLabel: "Clear Result",
  fieldsSectionLabel: "Inputs",
  copyActionLabel: "Copy Request",
  copyHostCommandActionLabel: "Copy Host Command",
  copyWorkflowCommandActionLabel: "Copy Workflow",
  resetActionLabel: "Reset"
});

const STAGE_OPTIONS = Object.freeze([
  { id: "", label: "Auto" },
  { id: "source-discovery", label: "Source" },
  { id: "plan-only", label: "Plan" },
  { id: "adapter-preflight", label: "Preflight" },
  { id: "adapter-request", label: "Request" },
  { id: "dry-run", label: "Dry Run" },
  { id: "import", label: "Import" },
  { id: "check-references", label: "Audit" }
]);

const OPTIONAL_BOOL_OPTIONS = Object.freeze([
  { id: "", label: "Default" },
  { id: "true", label: "True" },
  { id: "false", label: "False" }
]);
const WORKFLOW_RUN_STATUS_TOKENS = Object.freeze([
  "completed",
  "failed",
  "host-error",
  "running",
  "stopped"
]);
const WORKFLOW_RUN_BLOCKED_REASON_TOKENS = Object.freeze([
  "dry-run-required-before-import",
  "invalid-input-values",
  "missing-required-inputs",
  "request-not-submittable",
  "unknown-stage",
  "unsupported-source-or-stage",
  "write-confirmation-required"
]);
const WORKFLOW_RUN_STOP_REASON_TOKENS = Object.freeze([...new Set([
  "adapter-config-required",
  "host-error",
  "import-confirmation-required",
  "max-steps-exceeded",
  "missing-current-stage",
  "target-stage-complete",
  "workspace-response-failed",
  ...WORKFLOW_RUN_BLOCKED_REASON_TOKENS,
  ...REFERENCE_GEOMETRY_IMPORT_ACTION_TOKENS,
  ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES
])]);

export function mountReferenceImportPanel({
  root,
  app = null,
  projectPath = "",
  onStatusChange = () => {}
} = {}) {
  if (!root) return null;
  const picker = referenceGeometryImportFilePickerDescriptor();
  const initialState = () => ({
    projectPath: projectPath || "",
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
    stageId: "",
    summaryOnly: false,
    writeConfirmed: false,
    responseJsonText: "",
    responseError: "",
    lastWorkflowRunSummary: null,
    lastWorkspaceResponse: null
  });
  const state = {
    ...initialState(),
    project: app?.project?.() || null
  };
  const unsubscribe = app?.subscribe?.((project) => {
    state.project = project || app?.project?.() || null;
    render();
  }) || (() => {});

  root.classList.add("bc-reference-import-panel", "bc-data-panel");
  render();

  return {
    refresh() {
      state.project = app?.project?.() || state.project;
      render();
    },
    focusSource() {
      const input = root.querySelector("[data-reference-import-field=\"inputPath\"]");
      input?.focus?.();
      input?.select?.();
      return Boolean(input);
    },
    destroy() {
      unsubscribe();
    }
  };

  function render(options = {}) {
    const session = currentSession();
    root.replaceChildren(
      header(session),
      form(session),
      responseSection(session),
      stageSection(session),
      requestSection(session)
    );
    if (options.focusField) {
      const input = root.querySelector(`[data-reference-import-field="${options.focusField}"]`);
      input?.focus?.();
      if (typeof input?.setSelectionRange === "function" && Number.isInteger(options.selectionStart)) {
        input.setSelectionRange(options.selectionStart, options.selectionEnd ?? options.selectionStart);
      }
    }
  }

  function currentSession() {
    return referenceGeometryImportSessionState({
      projectPath: state.projectPath,
      inputPath: state.inputPath,
      formatToken: state.formatToken,
      adapterConfigPath: state.adapterConfigPath,
      requestPath: state.requestPath,
      referencesDir: state.referencesDir,
      stageId: state.stageId,
      writeConfirmed: state.writeConfirmed,
      lastWorkspaceResponse: state.lastWorkspaceResponse,
      importOptions: {
        assetId: state.assetId,
        name: state.name,
        adapterName: state.adapterName,
        adapterTimeoutMs: state.adapterTimeoutMs,
        pointCloudChunkSize: state.pointCloudChunkSize,
        units: state.units,
        replaceExisting: state.replaceExisting === true,
        visible: state.visible,
        snapEnabled: state.snapEnabled,
        opacity: state.opacity,
        color: state.color,
        edgeColor: state.edgeColor,
        pointSize: state.pointSize,
        origin: state.origin,
        axisX: state.axisX,
        axisY: state.axisY,
        axisZ: state.axisZ,
        scale: state.scale,
        summaryOnly: state.summaryOnly === true
      }
    });
  }

  function header(session) {
    return dataPanelHeader({
      namespace: "bc-reference-import",
      icon: PANEL_SPEC.icon,
      title: PANEL_SPEC.title,
      meta: headerMeta(session)
    });
  }

  function form(session) {
    const section = document.createElement("section");
    section.className = "bc-reference-import-form bc-data-section";
    const title = document.createElement("div");
    title.className = "bc-reference-import-form-title bc-data-section-title";
    title.textContent = PANEL_SPEC.fieldsSectionLabel;
    section.append(title);
    section.append(
      textField(PANEL_SPEC.projectPathLabel, "projectPath", state.projectPath),
      textField(PANEL_SPEC.sourcePathLabel, "inputPath", state.inputPath),
      selectField(PANEL_SPEC.formatLabel, "formatToken", state.formatToken, formatOptions(picker)),
      textField(PANEL_SPEC.adapterConfigLabel, "adapterConfigPath", state.adapterConfigPath),
      textField(PANEL_SPEC.adapterNameLabel, "adapterName", state.adapterName),
      textField(PANEL_SPEC.adapterTimeoutLabel, "adapterTimeoutMs", state.adapterTimeoutMs),
      textField(PANEL_SPEC.pointCloudChunkSizeLabel, "pointCloudChunkSize", state.pointCloudChunkSize),
      textField(PANEL_SPEC.unitsLabel, "units", state.units),
      textField(PANEL_SPEC.requestPathLabel, "requestPath", state.requestPath),
      textField(PANEL_SPEC.referencesDirLabel, "referencesDir", state.referencesDir),
      textField(PANEL_SPEC.assetIdLabel, "assetId", state.assetId),
      textField(PANEL_SPEC.nameLabel, "name", state.name),
      replaceExistingField(),
      selectField(PANEL_SPEC.visibleLabel, "visible", state.visible, OPTIONAL_BOOL_OPTIONS),
      selectField(PANEL_SPEC.snapEnabledLabel, "snapEnabled", state.snapEnabled, OPTIONAL_BOOL_OPTIONS),
      textField(PANEL_SPEC.opacityLabel, "opacity", state.opacity),
      textField(PANEL_SPEC.colorLabel, "color", state.color),
      textField(PANEL_SPEC.edgeColorLabel, "edgeColor", state.edgeColor),
      textField(PANEL_SPEC.pointSizeLabel, "pointSize", state.pointSize),
      textField(PANEL_SPEC.originLabel, "origin", state.origin),
      textField(PANEL_SPEC.axisXLabel, "axisX", state.axisX),
      textField(PANEL_SPEC.axisYLabel, "axisY", state.axisY),
      textField(PANEL_SPEC.axisZLabel, "axisZ", state.axisZ),
      textField(PANEL_SPEC.scaleLabel, "scale", state.scale),
      selectField(PANEL_SPEC.stageLabel, "stageId", state.stageId, STAGE_OPTIONS),
      summaryOnlyField(session),
      writeConfirmField(session),
      actionBar(session)
    );
    return section;
  }

  function textField(label, field, value) {
    const wrapper = fieldShell(label, field);
    const input = document.createElement("input");
    input.className = "bc-reference-import-input";
    input.type = "text";
    input.value = value || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.referenceImportField = field;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      state[field] = input.value;
      render({ focusField: field, selectionStart, selectionEnd });
    });
    wrapper.append(input);
    return wrapper;
  }

  function selectField(label, field, value, options = []) {
    const wrapper = fieldShell(label, field);
    const select = document.createElement("select");
    select.className = "bc-reference-import-select";
    select.dataset.referenceImportField = field;
    select.setAttribute("aria-label", label);
    for (const optionSpec of options) {
      const option = document.createElement("option");
      option.value = optionSpec.id;
      option.textContent = optionSpec.label;
      select.append(option);
    }
    select.value = value || "";
    select.addEventListener("change", () => {
      state[field] = select.value;
      render();
    });
    wrapper.append(select);
    return wrapper;
  }

  function replaceExistingField() {
    const wrapper = fieldShell(PANEL_SPEC.replaceExistingLabel, "replaceExisting");
    const label = document.createElement("label");
    label.className = "bc-reference-import-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.replaceExisting === true;
    input.dataset.referenceImportField = "replaceExisting";
    input.addEventListener("change", () => {
      state.replaceExisting = input.checked;
      render();
    });
    const copy = document.createElement("span");
    copy.textContent = "Existing";
    label.append(input, copy);
    wrapper.append(label);
    return wrapper;
  }

  function summaryOnlyField(session) {
    const wrapper = fieldShell(PANEL_SPEC.summaryOnlyLabel, "summaryOnly");
    const label = document.createElement("label");
    label.className = "bc-reference-import-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.summaryOnly === true;
    input.disabled = session.currentStageId !== "check-references";
    input.dataset.referenceImportField = "summaryOnly";
    input.addEventListener("change", () => {
      state.summaryOnly = input.checked;
      render();
    });
    const copy = document.createElement("span");
    copy.textContent = "Only";
    label.append(input, copy);
    wrapper.append(label);
    return wrapper;
  }

  function writeConfirmField(session) {
    const wrapper = fieldShell(PANEL_SPEC.writeConfirmLabel, "writeConfirmed");
    const label = document.createElement("label");
    label.className = "bc-reference-import-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.writeConfirmed === true;
    input.disabled = session.currentStageId !== "import";
    input.dataset.referenceImportField = "writeConfirmed";
    input.addEventListener("change", () => {
      state.writeConfirmed = input.checked;
      render();
    });
    const copy = document.createElement("span");
    copy.textContent = "Confirm";
    label.append(input, copy);
    wrapper.append(label);
    return wrapper;
  }

  function fieldShell(label, field) {
    const wrapper = document.createElement("label");
    wrapper.className = "bc-reference-import-field";
    wrapper.dataset.referenceImportFieldShell = field;
    const copy = document.createElement("span");
    copy.className = "bc-reference-import-label";
    copy.textContent = label;
    wrapper.append(copy);
    return wrapper;
  }

  function actionBar(session) {
    const bar = document.createElement("div");
    bar.className = "bc-reference-import-actions";
    const copyButton = panelButton(PANEL_SPEC.copyActionLabel, () => copyRequest(session), {
      disabled: !session.nextWorkspaceRequest,
      title: "Copy workspace request JSON"
    });
    const hostCommandButton = panelButton(PANEL_SPEC.copyHostCommandActionLabel, () => copyHostCommand(session), {
      disabled: !session.nextWorkspaceRequest,
      title: "Copy command-host runner command"
    });
    const workflowCommandButton = panelButton(PANEL_SPEC.copyWorkflowCommandActionLabel, () => copyWorkflowCommand(session), {
      disabled: !workflowCommandAvailable(state, session),
      title: "Copy no-browser workflow runner command"
    });
    const resetButton = panelButton(PANEL_SPEC.resetActionLabel, () => {
      Object.assign(state, initialState());
      render();
      onStatusChange("Reference import reset.");
    }, { title: "Reset reference import session" });
    bar.append(copyButton, hostCommandButton, workflowCommandButton, resetButton);
    return bar;
  }

  function responseSection(session) {
    const section = document.createElement("section");
    section.className = "bc-reference-import-response bc-data-section";
    const title = document.createElement("div");
    title.className = "bc-reference-import-response-title bc-data-section-title";
    title.textContent = PANEL_SPEC.responseSectionLabel;
    section.append(title, responseTextArea(), responseActions(session), responseStatusRows(session));
    return section;
  }

  function responseTextArea() {
    const wrapper = fieldShell(PANEL_SPEC.responseJsonLabel, "responseJsonText");
    const textarea = document.createElement("textarea");
    textarea.className = "bc-reference-import-textarea";
    textarea.value = state.responseJsonText || "";
    textarea.placeholder = PANEL_SPEC.responseJsonPlaceholder;
    textarea.spellcheck = false;
    textarea.dataset.referenceImportField = "responseJsonText";
    textarea.setAttribute("aria-label", PANEL_SPEC.responseJsonLabel);
    textarea.addEventListener("input", () => {
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      state.responseJsonText = textarea.value;
      state.responseError = "";
      render({ focusField: "responseJsonText", selectionStart, selectionEnd });
    });
    wrapper.append(textarea);
    return wrapper;
  }

  function responseActions(session) {
    const bar = document.createElement("div");
    bar.className = "bc-reference-import-actions";
    bar.append(
      panelButton(PANEL_SPEC.applyResponseActionLabel, () => applyResponseJson(session), {
        disabled: !state.responseJsonText.trim(),
        title: "Apply parsed host result JSON"
      }),
      panelButton(PANEL_SPEC.clearResponseActionLabel, () => {
        state.responseJsonText = "";
        state.responseError = "";
        state.lastWorkflowRunSummary = null;
        state.lastWorkspaceResponse = null;
        render();
        onStatusChange("Reference import response cleared.");
      }, { title: "Clear host result JSON" })
    );
    return bar;
  }

  function responseStatusRows(session) {
    const rows = [];
    if (state.responseError) {
      rows.push(dataPanelRow({
        namespace: "bc-reference-import",
        icon: "cancel",
        label: "Response",
        value: "invalid",
        meta: state.responseError,
        state: "error"
      }));
    } else if (session.lastWorkspaceResponse || state.lastWorkflowRunSummary) {
      if (state.lastWorkflowRunSummary) {
        rows.push(dataPanelRow({
          namespace: "bc-reference-import",
          icon: state.lastWorkflowRunSummary.ok ? "check" : "cancel",
          label: "Workflow",
          value: state.lastWorkflowRunSummary.runStatus || "-",
          meta: workflowRunSummaryMeta(state.lastWorkflowRunSummary),
          state: state.lastWorkflowRunSummary.ok ? "created" : "warning"
        }));
      }
      if (session.lastWorkspaceResponse) {
        rows.push(dataPanelRow({
          namespace: "bc-reference-import",
          icon: session.lastWorkspaceResponse.ok ? "check" : "cancel",
          label: "Response",
          value: session.lastWorkspaceResponse.responseStatus || "-",
          meta: session.lastWorkspaceResponse.safeNextAction || "",
          state: session.lastWorkspaceResponse.ok ? "created" : "warning"
        }));
        if (session.lastWorkspaceResponse.referenceSourceSummary) {
          const summary = session.lastWorkspaceResponse.referenceSourceSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.externalAdapterRequired ? "settings" : "reference-plane",
            label: "Source",
            value: referenceSourceSummaryValue(summary),
            meta: referenceSourceSummaryMeta(summary),
            state: summary.sourceFileReadyForImport ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.adapterPreflightSummary) {
          const summary = session.lastWorkspaceResponse.adapterPreflightSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.adapterPreflightReady ? "check" : "warning",
            label: "Adapter",
            value: summary.adapterPreflightReady ? "ready" : "blocked",
            meta: adapterPreflightSummaryMeta(summary),
            state: summary.adapterPreflightReady ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referencePlanSummary) {
          const summary = session.lastWorkspaceResponse.referencePlanSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.projectPointerReady ? "check" : "warning",
            label: "Plan",
            value: referencePlanSummaryValue(summary),
            meta: referencePlanSummaryMeta(summary),
            state: summary.projectPointerReady ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referenceAdapterRequestSummary) {
          const summary = session.lastWorkspaceResponse.referenceAdapterRequestSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.adapterRequestReady ? "check" : "warning",
            label: "Request",
            value: referenceAdapterRequestSummaryValue(summary),
            meta: referenceAdapterRequestSummaryMeta(summary),
            state: summary.adapterRequestReady ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referenceOutputSummary) {
          const summary = session.lastWorkspaceResponse.referenceOutputSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: session.lastWorkspaceResponse.ok ? "reference-plane" : "warning",
            label: "Reference",
            value: referenceOutputSummaryValue(summary),
            meta: referenceOutputSummaryMeta(summary),
            state: session.lastWorkspaceResponse.ok ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referencePromotionSummary) {
          const summary = session.lastWorkspaceResponse.referencePromotionSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.projectJsonWritten ? "check" : "warning",
            label: "Import",
            value: referencePromotionSummaryValue(summary),
            meta: referencePromotionSummaryMeta(summary),
            state: summary.projectJsonWritten ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referenceAuditSummary) {
          const summary = session.lastWorkspaceResponse.referenceAuditSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: summary.referenceOverlayReady ? "check" : "warning",
            label: "Audit",
            value: referenceAuditSummaryValue(summary),
            meta: referenceAuditSummaryMeta(summary),
            state: summary.referenceOverlayReady ? "created" : "warning"
          }));
        }
        if (session.lastWorkspaceResponse.referenceFailureSummary) {
          const summary = session.lastWorkspaceResponse.referenceFailureSummary;
          rows.push(dataPanelRow({
            namespace: "bc-reference-import",
            icon: "warning",
            label: "Failure",
            value: referenceFailureSummaryValue(summary),
            meta: referenceFailureSummaryMeta(summary),
            state: "warning"
          }));
        }
      }
    } else {
      rows.push(dataPanelEmpty({
        namespace: "bc-reference-import",
        message: "Paste parsed command-host JSON after running the workspace request."
      }));
    }
    const box = document.createElement("div");
    box.className = "bc-reference-import-response-status";
    box.append(...rows.filter(Boolean));
    return box;
  }

  function applyResponseJson(session) {
    const parsed = parseResponseJson(state.responseJsonText);
    if (!parsed.ok) {
      state.responseError = parsed.error;
      state.lastWorkflowRunSummary = null;
      state.lastWorkspaceResponse = null;
      render();
      onStatusChange("Reference import response JSON is invalid.");
      return false;
    }
    const request = session.nextWorkspaceRequest;
    state.lastWorkflowRunSummary = normalizeWorkflowRunSummary(parsed.value);
    state.lastWorkspaceResponse = normalizePastedResponse(parsed.value, request);
    if (!state.lastWorkspaceResponse && !state.lastWorkflowRunSummary) {
      state.responseError = "Expected host response or workflow run JSON.";
      render();
      onStatusChange("Reference import response JSON is not a host response.");
      return false;
    }
    state.responseError = "";
    state.stageId = "";
    render();
    onStatusChange(state.lastWorkspaceResponse
      ? `Reference import response applied: ${state.lastWorkspaceResponse.responseStatus}.`
      : `Reference import workflow applied: ${state.lastWorkflowRunSummary.runStatus}.`);
    return true;
  }

  function stageSection(session) {
    const rows = (session.stageStates || []).map((stage) => dataPanelRow({
      namespace: "bc-reference-import",
      icon: stageIcon(stage),
      label: stage.label,
      value: stageValue(stage, session),
      meta: stageMeta(stage),
      state: stageState(stage, session),
      dataset: { referenceImportStage: stage.id }
    }));
    return dataPanelSection({
      namespace: "bc-reference-import",
      label: PANEL_SPEC.stageSectionLabel,
      children: rows,
      emptyMessage: "No workflow stages.",
      list: true
    });
  }

  function requestSection(session) {
    const request = session.nextWorkspaceRequest;
    const rows = [
      dataPanelRow({
        namespace: "bc-reference-import",
        icon: "reference-plane",
        label: "Current",
        value: session.currentStageId || "-",
        meta: session.nextActionToken || "-"
      }),
      retryRoutingRow(session),
      dataPanelRow({
        namespace: "bc-reference-import",
        icon: session.canSubmitNextRequest ? "check" : "cancel",
        label: "Submit",
        value: session.canSubmitNextRequest ? "ready" : "blocked",
        meta: requestStatusMeta(session, request)
      }),
      request ? commandPreviewRow(request) : dataPanelEmpty({
        namespace: "bc-reference-import",
        message: PANEL_SPEC.emptyMessage
      })
    ].filter(Boolean);
    return dataPanelSection({
      namespace: "bc-reference-import",
      label: PANEL_SPEC.requestSectionLabel,
      children: rows,
      list: false
    });
  }

  function retryRoutingRow(session) {
    if (!session || session.lastResponseStatus === "" || session.lastResponseStatus === "succeeded") return null;
    const retryStage = session.retryWorkflowStage || "";
    const failedStage = session.failedWorkflowStage || "";
    if (!retryStage && !failedStage) return null;
    const value = retryStage || failedStage || session.currentStageId || "-";
    const meta = [
      failedStage && failedStage !== value ? `failed ${failedStage}` : "",
      session.lastResponseSafeNextAction || session.nextActionToken || ""
    ].filter(Boolean).join(" | ");
    return dataPanelRow({
      namespace: "bc-reference-import",
      icon: retryStage ? "reference-plane" : "warning",
      label: "Retry",
      value,
      meta,
      state: retryStage ? "pick" : "warning"
    });
  }

  async function copyRequest(session) {
    const request = session.nextWorkspaceRequest;
    if (!request) return false;
    const text = JSON.stringify(request, null, 2);
    const copied = await copyToClipboard(text);
    onStatusChange(copied ? "Reference import request copied." : "Reference import request ready.");
    return copied;
  }

  async function copyHostCommand(session) {
    const request = session.nextWorkspaceRequest;
    if (!request) return false;
    const command = hostCommandForRequest(request);
    const copied = await copyToClipboard(command);
    onStatusChange(copied ? "Reference import host command copied." : "Reference import host command ready.");
    return copied;
  }

  async function copyWorkflowCommand(session) {
    if (!workflowCommandAvailable(state, session)) return false;
    const command = workflowCommandForState(state);
    const copied = await copyToClipboard(command);
    onStatusChange(copied ? "Reference import workflow command copied." : "Reference import workflow command ready.");
    return copied;
  }

  async function copyToClipboard(text = "") {
    try {
      if (typeof navigator.clipboard?.writeText !== "function") {
        return false;
      }
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

function hostCommandForRequest(request = {}) {
  const encoded = encodeBase64Utf8(JSON.stringify(request));
  return `node scripts/run_reference_import_workspace_request.mjs --request-json-base64 ${encoded}`;
}

function workflowCommandForState(state = {}) {
  const encoded = encodeBase64Utf8(JSON.stringify(referenceImportWorkflowOptions(state)));
  return `node scripts/run_reference_import_workflow.mjs --options-json-base64 ${encoded}`;
}

function referenceImportWorkflowOptions(state = {}) {
  const options = {
    untilStage: state.stageId || "dry-run"
  };
  if (state.stageId) options.startStage = state.stageId;
  if (state.inputPath) options.inputPath = state.inputPath;
  if (state.projectPath) options.projectPath = state.projectPath;
  if (state.formatToken) options.formatToken = state.formatToken;
  if (state.adapterConfigPath) options.adapterConfigPath = state.adapterConfigPath;
  if (state.adapterName) options.adapterName = state.adapterName;
  if (state.adapterTimeoutMs) options.adapterTimeoutMs = state.adapterTimeoutMs;
  if (state.pointCloudChunkSize) options.pointCloudChunkSize = state.pointCloudChunkSize;
  if (state.units) options.units = state.units;
  if (state.requestPath) options.requestPath = state.requestPath;
  if (state.referencesDir) options.referencesDir = state.referencesDir;
  if (state.assetId) options.assetId = state.assetId;
  if (state.name) options.name = state.name;
  if (state.replaceExisting === true) options.replaceExisting = true;
  if (state.visible) options.visible = state.visible;
  if (state.snapEnabled) options.snapEnabled = state.snapEnabled;
  if (state.opacity) options.opacity = state.opacity;
  if (state.color) options.color = state.color;
  if (state.edgeColor) options.edgeColor = state.edgeColor;
  if (state.pointSize) options.pointSize = state.pointSize;
  if (state.origin) options.origin = state.origin;
  if (state.axisX) options.axisX = state.axisX;
  if (state.axisY) options.axisY = state.axisY;
  if (state.axisZ) options.axisZ = state.axisZ;
  if (state.scale) options.scale = state.scale;
  if (state.stageId === "check-references" && state.summaryOnly === true) options.summaryOnly = true;
  if (state.writeConfirmed === true) options.confirmImport = true;
  return options;
}

function workflowCommandAvailable(state = {}, session = null) {
  if (session?.invalidImportOptionFields?.length || session?.invalidInputDescriptorIds?.length) return false;
  if (state.stageId === "adapter-preflight") return Boolean(state.adapterConfigPath);
  if (state.stageId === "check-references") return Boolean(state.projectPath);
  return Boolean(state.inputPath);
}

function requestStatusMeta(session = {}, request = null) {
  const invalidFields = [
    ...(session.invalidImportOptionFields || []),
    ...(request?.invalidImportOptionFields || [])
  ].filter(Boolean);
  const uniqueInvalidFields = [...new Set(invalidFields)];
  return [
    session.blockedReason || request?.blockedReason || "",
    uniqueInvalidFields.length ? `invalid ${uniqueInvalidFields.join(",")}` : ""
  ].filter(Boolean).join(" | ");
}

function encodeBase64Utf8(text = "") {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function parseResponseJson(text = "") {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Expected a JSON object." };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error?.message || "Invalid JSON." };
  }
}

function normalizeWorkflowRunSummary(value = {}) {
  const workflowRun = workflowRunObject(value);
  if (!workflowRun) return null;
  return Object.freeze({
    id: "referenceGeometryImportWorkflowRunSummary",
    ok: workflowRun.ok === true,
    runStatus: workflowSummaryRunStatus(workflowRun.runStatus),
    stopReason: workflowSummaryStopReason(workflowRun.stopReason),
    targetStage: workflowSummaryStageToken(workflowRun.targetStage),
    finalStage: workflowSummaryStageToken(workflowRun.finalStage),
    finalResponseStatus: workflowSummaryResponseStatus(workflowRun.finalResponseStatus),
    finalSafeNextAction: workflowSummaryActionToken(workflowRun.finalSafeNextAction),
    finalFailedWorkflowStage: workflowSummaryStageToken(workflowRun.finalFailedWorkflowStage),
    finalRetryWorkflowStage: workflowSummaryStageToken(workflowRun.finalRetryWorkflowStage),
    blockedStage: workflowSummaryStageToken(workflowRun.blockedStage),
    blockedReason: workflowSummaryBlockedReason(workflowRun.blockedReason),
    blockedSafeNextAction: workflowSummaryActionToken(workflowRun.blockedSafeNextAction),
    blockedMissingInputDescriptorIds: Object.freeze(workflowSummaryInputDescriptorIds(workflowRun.blockedMissingInputDescriptorIds))
  });
}

function workflowSummaryRunStatus(value = "") {
  const token = cleanPanelString(value);
  return WORKFLOW_RUN_STATUS_TOKENS.includes(token) ? token : "";
}

function workflowSummaryStopReason(value = "") {
  const token = cleanPanelString(value);
  return WORKFLOW_RUN_STOP_REASON_TOKENS.includes(token) ? token : "";
}

function workflowSummaryBlockedReason(value = "") {
  const token = cleanPanelString(value);
  return WORKFLOW_RUN_BLOCKED_REASON_TOKENS.includes(token) ? token : "";
}

function workflowSummaryStageToken(value = "") {
  const token = cleanPanelString(value);
  return REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER.includes(token) ? token : "";
}

function workflowSummaryResponseStatus(value = "") {
  const token = cleanPanelString(value);
  return REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES.includes(token) ? token : "";
}

function workflowSummaryActionToken(value = "") {
  const token = cleanPanelString(value);
  return REFERENCE_GEOMETRY_IMPORT_ACTION_TOKENS.includes(token) ? token : "";
}

function workflowSummaryInputDescriptorIds(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTORS.map((descriptor) => descriptor.id));
  const seen = new Set();
  return value
    .map((entry) => cleanPanelString(entry))
    .filter((entry) => allowed.has(entry))
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

function workflowRunSummaryMeta(summary = {}) {
  return [
    summary.stopReason,
    summary.finalFailedWorkflowStage ? `failed ${summary.finalFailedWorkflowStage}` : "",
    summary.finalRetryWorkflowStage ? `retry ${summary.finalRetryWorkflowStage}` : "",
    summary.blockedStage ? `blocked ${summary.blockedStage}` : "",
    summary.blockedMissingInputDescriptorIds?.length
      ? `missing ${summary.blockedMissingInputDescriptorIds.join(",")}`
      : "",
    summary.blockedSafeNextAction || summary.finalSafeNextAction
  ].filter(Boolean).join(" | ");
}

function adapterPreflightSummaryMeta(summary = {}) {
  const missing = [
    summary.missingRequiredCommandCount ? `${summary.missingRequiredCommandCount} command` : "",
    summary.missingRequiredFileCount ? `${summary.missingRequiredFileCount} file` : "",
    summary.missingRequiredDirectoryCount ? `${summary.missingRequiredDirectoryCount} dir` : "",
    summary.missingRequiredEnvCount ? `${summary.missingRequiredEnvCount} env` : ""
  ].filter(Boolean).join(", ");
  return [
    summary.requestedFormatToken || summary.requestedFormat,
    summary.likelyFixArea,
    missing,
    summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referenceSourceSummaryValue(summary = {}) {
  return summary.sourceRequestedFormat || summary.sourceFormat || summary.canonicalFormat || "source";
}

function referenceSourceSummaryMeta(summary = {}) {
  return [
    summary.importerTranslationMode,
    summary.externalAdapterRequired ? "adapter required" : "built-in",
    summary.adapterConfigProvided ? "adapter configured" : "",
    summary.safeFirstExecutionMode,
    summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referenceAdapterRequestSummaryValue(summary = {}) {
  if (summary.adapterRequestReady === true) return "ready";
  if (summary.adapterRequestReady === false) return "blocked";
  return summary.adapterKey || "request";
}

function referenceAdapterRequestSummaryMeta(summary = {}) {
  return [
    summary.adapterKey,
    summary.adapterOutputMode,
    summary.sourceRequestedFormat || summary.sourceFormat,
    summary.adapterRequestFingerprint ? "fingerprinted" : "",
    summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referencePlanSummaryValue(summary = {}) {
  if (summary.projectPointerReady === true) return "ready";
  if (summary.projectPointerReady === false) return "blocked";
  return summary.safeNextExecutionMode || "planned";
}

function referencePlanSummaryMeta(summary = {}) {
  return [
    summary.translationMode,
    summary.sourceRequestedFormat || summary.sourceFormat,
    summary.adapterConfigProvided ? "adapter configured" : "",
    summary.safeNextExecutionMode || summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referenceOutputSummaryValue(summary = {}) {
  if (Number.isInteger(summary.referenceObjectCount)) return `${summary.referenceObjectCount} objects`;
  if (Number.isInteger(summary.referencePointCloudPointCount)) return `${summary.referencePointCloudPointCount} points`;
  return summary.translationMode || "translated";
}

function referenceOutputSummaryMeta(summary = {}) {
  const primitives = [
    Number.isInteger(summary.referenceLineSegmentCount) ? `${summary.referenceLineSegmentCount} lines` : "",
    Number.isInteger(summary.referenceMeshFaceCount) ? `${summary.referenceMeshFaceCount} faces` : "",
    Number.isInteger(summary.referencePointCloudPointCount) ? `${summary.referencePointCloudPointCount} points` : "",
    Number.isInteger(summary.referenceChunkCount) && summary.referenceChunkCount > 0 ? `${summary.referenceChunkCount} chunks` : ""
  ].filter(Boolean).join(", ");
  return [
    summary.translationMode,
    summary.sourceRequestedFormat || summary.sourceFormat,
    referenceExternalSourceProvenanceMeta(summary),
    summary.referenceUnits,
    primitives
  ].filter(Boolean).join(" | ");
}

function referencePromotionSummaryValue(summary = {}) {
  if (summary.projectJsonWritten === true && summary.targetReferenceManifestWritten === true) return "promoted";
  if (summary.projectPointerReady === false || summary.promotedOutputFingerprintsReady === false) return "blocked";
  return summary.safeNextAction || "import";
}

function referencePromotionSummaryMeta(summary = {}) {
  const writes = [
    summary.projectPointerWritten ? "project pointer" : "",
    summary.targetReferenceManifestWritten ? "manifest" : "",
    summary.chunkSidecarsReady === true ? "chunks ready" : ""
  ].filter(Boolean).join(", ");
  return [
    summary.translationMode,
    summary.sourceRequestedFormat || summary.sourceFormat,
    referenceExternalSourceProvenanceMeta(summary),
    writes,
    summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referenceExternalSourceProvenanceMeta(summary = {}) {
  if (!summary.sourceAdapter) return "";
  return [
    summary.sourceTranslator,
    summary.sourceTranslatorVersion
  ].filter(Boolean).join(" ");
}

function referenceAuditSummaryValue(summary = {}) {
  const ready = Number.isInteger(summary.referenceReadyCount) ? summary.referenceReadyCount : 0;
  const needsAttention = Number.isInteger(summary.referenceNeedsAttentionCount) ? summary.referenceNeedsAttentionCount : 0;
  if (needsAttention > 0) return `${needsAttention} needs attention`;
  return `${ready} ready`;
}

function referenceAuditSummaryMeta(summary = {}) {
  const totals = [
    Number.isInteger(summary.objectCount) ? `${summary.objectCount} objects` : "",
    Number.isInteger(summary.lineSegmentCount) ? `${summary.lineSegmentCount} lines` : "",
    Number.isInteger(summary.meshFaceCount) ? `${summary.meshFaceCount} faces` : "",
    Number.isInteger(summary.pointCloudPointCount) ? `${summary.pointCloudPointCount} points` : ""
  ].filter(Boolean).join(", ");
  return [
    summary.referenceOverlayReady ? "overlay ready" : "review required",
    summary.likelyFixArea,
    summary.highestPriorityStatus,
    totals,
    summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function referenceFailureSummaryValue(summary = {}) {
  return summary.failureKind || summary.adapterErrorCode || summary.responseStatus || "failed";
}

function referenceFailureSummaryMeta(summary = {}) {
  return [
    summary.failedWorkflowStage || summary.stageId,
    summary.adapterErrorCode,
    summary.adapterOutputValidationKind,
    summary.likelyFixArea,
    summary.retryWorkflowStage ? `retry ${summary.retryWorkflowStage}` : "",
    summary.safeNextAction || summary.recommendedNextAction
  ].filter(Boolean).join(" | ");
}

function normalizePastedResponse(value = {}, request = null) {
  const workflowResponse = workflowRunFinalResponse(value);
  if (workflowResponse) {
    if (workflowResponse.id === "referenceGeometryImportWorkspaceResponse" || workflowResponse.responseStatus) {
      return referenceGeometryImportWorkspaceResponseEnvelope(workflowResponse);
    }
    return referenceGeometryImportWorkspaceResponse({
      resultJson: workflowResponse,
      exitCode: workflowResponse.ok === true ? 0 : 1,
      request
    });
  }
  if (plainJsonObject(value.responseEnvelope)) {
    return referenceGeometryImportWorkspaceResponseEnvelope(value.responseEnvelope);
  }
  if (value.id === "referenceGeometryImportWorkspaceResponse" || value.responseStatus) {
    return referenceGeometryImportWorkspaceResponseEnvelope(value);
  }
  const wrapped = value.resultJson || value.parsedJson || value.stdoutJson || value.jsonResult || value.hostResult
    ? value
    : {
        resultJson: value,
        exitCode: value.ok === true ? 0 : 1
      };
  return referenceGeometryImportWorkspaceResponse({
    ...wrapped,
    request
  });
}

function workflowRunFinalResponse(value = {}) {
  const workflowRun = workflowRunObject(value);
  if (!plainJsonObject(workflowRun)) return null;
  if (plainJsonObject(workflowRun.finalWorkspaceResponseEnvelope)) {
    return workflowRun.finalWorkspaceResponseEnvelope;
  }
  if (plainJsonObject(workflowRun.finalWorkspaceResponse)) {
    return workflowRun.finalWorkspaceResponse;
  }
  const responseEnvelopes = Array.isArray(workflowRun.responseEnvelopes) ? workflowRun.responseEnvelopes : [];
  for (let index = responseEnvelopes.length - 1; index >= 0; index -= 1) {
    if (plainJsonObject(responseEnvelopes[index])) return responseEnvelopes[index];
  }
  const responseEntries = Array.isArray(workflowRun.responseEntries) ? workflowRun.responseEntries : [];
  for (let index = responseEntries.length - 1; index >= 0; index -= 1) {
    if (plainJsonObject(responseEntries[index])) return responseEntries[index];
  }
  const responses = Array.isArray(workflowRun.responses) ? workflowRun.responses : [];
  for (let index = responses.length - 1; index >= 0; index -= 1) {
    if (plainJsonObject(responses[index])) return responses[index];
  }
  return null;
}

function workflowRunObject(value = {}) {
  if (value.id === "referenceGeometryImportWorkflowRun") return value;
  return plainJsonObject(value.workflowRun) ? value.workflowRun : value.workflowResult;
}

function plainJsonObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanPanelString(value = "") {
  return typeof value === "string" ? value.trim() : "";
}

function commandPreviewRow(request) {
  const wrapper = document.createElement("div");
  wrapper.className = "bc-reference-import-command";
  const label = document.createElement("div");
  label.className = "bc-reference-import-command-label";
  label.textContent = "argv";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(request.argv || [], null, 2);
  wrapper.append(label, pre);
  return wrapper;
}

function panelButton(label, onClick, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bc-button";
  button.textContent = label;
  button.disabled = options.disabled === true;
  if (options.title) applyTooltip(button, options.title);
  button.addEventListener("click", () => {
    if (button.disabled) return;
    onClick?.();
  });
  return button;
}

function formatOptions(picker = {}) {
  const tokens = (picker.sourceGroups || []).flatMap((group) => group.formatTokens || []);
  return [
    { id: "", label: "Auto" },
    ...tokens.map((token) => ({ id: token, label: token }))
  ];
}

function headerMeta(session) {
  const status = session.blockedReason || session.lastResponseStatus || session.nextActionToken || "ready";
  return `${session.currentStageId || "source-discovery"} - ${status}`;
}

function stageIcon(stage) {
  if (stage.failed) return "warning";
  if (stage.completed) return "check";
  if (stage.current) return "reference-plane";
  return "file";
}

function stageValue(stage, session) {
  if (stage.failed) return "failed";
  if (stage.completed) return "complete";
  if (stage.current && session.blockedReason) return "blocked";
  if (stage.current) return "current";
  return stage.actionState || stage.availability || "-";
}

function stageMeta(stage) {
  if (stage.invalidImportOptionFields?.length) return `invalid ${stage.invalidImportOptionFields.join(",")}`;
  return stage.missingInputDescriptorIds?.length
    ? stage.missingInputDescriptorIds.join(", ")
    : stage.actionToken || "";
}

function stageState(stage, session) {
  if (stage.failed) return "error";
  if (stage.completed) return "created";
  if (stage.current && session.blockedReason) return "warning";
  if (stage.current) return "pick";
  return "";
}
