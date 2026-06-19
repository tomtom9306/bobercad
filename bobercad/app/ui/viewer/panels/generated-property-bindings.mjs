export function bindGeneratedPropertySections(sections = [], bindings = {}) {
  return normalizeSections(sections).map((section) => {
    const descriptor = sectionWithoutRawRows(section);
    return {
      ...descriptor,
      fields: Array.isArray(descriptor.fields)
        ? descriptor.fields.map((field) => bindGeneratedPropertyField(field, bindings))
        : descriptor.fields
    };
  });
}

export function bindGeneratedPropertyField(field, bindings = {}) {
  if (!field || typeof field !== "object") return field;
  const bound = {
    ...field,
    actions: bindGeneratedPropertyActions(field.actions, bindings),
    actionGroups: bindGeneratedPropertyActionGroups(field.actionGroups, bindings),
    cancelAction: bindGeneratedPropertyAction(field.cancelAction, bindings),
    confirmAction: bindGeneratedPropertyAction(field.confirmAction, bindings),
    customAction: bindGeneratedPropertyAction(field.customAction, bindings),
    groups: bindGeneratedPropertyGroups(field.groups, bindings),
    fields: bindGeneratedPropertyFields(field.fields, bindings),
    increment: bindGeneratedPropertyValueControl(field.increment, bindings),
    items: bindGeneratedPropertyFields(field.items, bindings),
    rows: bindGeneratedPropertyRows(field.rows, bindings)
  };
  if (bound.commit && typeof bound.onChange !== "function") {
    bound.onChange = (value) => runCommit(bound.commit, value, bound, bindings);
  }
  if (bound.commandId && typeof bound.onClick !== "function") {
    bound.onClick = () => runCommand(bound.commandId, bound, bindings);
  }
  if (bound.action && bound.type === "action" && typeof bound.onClick !== "function") {
    bound.onClick = () => runAction(bound.action, bound, bindings);
  }
  if (bound.customAction && typeof bound.onCustom !== "function") {
    bound.onCustom = () => bound.customAction.onClick?.();
  }
  return bound;
}

function bindGeneratedPropertyFields(fields, bindings = {}) {
  return Array.isArray(fields)
    ? fields.map((field) => bindGeneratedPropertyField(field, bindings))
    : fields;
}

function bindGeneratedPropertyRows(rows, bindings = {}) {
  return Array.isArray(rows)
    ? rows.map((row) => bindGeneratedPropertyRow(row, bindings))
    : rows;
}

function bindGeneratedPropertyRow(row, bindings = {}) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    actions: bindGeneratedPropertyActions(row.actions, bindings),
    delta: bindGeneratedPropertyValueControl(row.delta, bindings),
    result: bindGeneratedPropertyValueControl(row.result, bindings),
    fields: bindGeneratedPropertyFields(row.fields, bindings),
    items: bindGeneratedPropertyFields(row.items, bindings)
  };
}

function bindGeneratedPropertyValueControl(control, bindings = {}) {
  if (!control || typeof control !== "object") return control;
  const bound = {
    ...control,
    actions: bindGeneratedPropertyActions(control.actions, bindings)
  };
  if (bound.commit && typeof bound.onChange !== "function") {
    bound.onChange = (value) => runCommit(bound.commit, value, bound, bindings);
  }
  return bound;
}

export function generatedPropertyDescriptorsContainFunctions(value) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(generatedPropertyDescriptorsContainFunctions);
  return Object.values(value).some(generatedPropertyDescriptorsContainFunctions);
}

function bindGeneratedPropertyActions(actions, bindings = {}) {
  return Array.isArray(actions)
    ? actions.map((action) => bindGeneratedPropertyAction(action, bindings))
    : actions;
}

function bindGeneratedPropertyActionGroups(groups, bindings = {}) {
  return Array.isArray(groups)
    ? groups.map((group) => group && typeof group === "object"
      ? { ...group, actions: bindGeneratedPropertyActions(group.actions, bindings) }
      : group)
    : groups;
}

function bindGeneratedPropertyGroups(groups, bindings = {}) {
  return Array.isArray(groups)
    ? groups.map((group) => group && typeof group === "object"
      ? {
        ...group,
        actions: bindGeneratedPropertyActions(group.actions, bindings),
        rows: Array.isArray(group.rows)
          ? group.rows.map((row) => row && typeof row === "object"
            ? { ...row, actions: bindGeneratedPropertyActions(row.actions, bindings) }
            : row)
          : group.rows
      }
      : group)
    : groups;
}

function bindGeneratedPropertyAction(action, bindings = {}) {
  if (!action || typeof action !== "object") return action;
  const bound = { ...action };
  if (bound.commandId && typeof bound.onClick !== "function") {
    bound.onClick = () => runCommand(bound.commandId, bound, bindings);
  }
  if (bound.action && typeof bound.onClick !== "function") {
    bound.onClick = () => runAction(bound.action, bound, bindings);
  }
  return bound;
}

function runCommit(commit, value, field, bindings = {}) {
  const action = typeof commit === "string" ? commit : commit?.action;
  return bindings.commits?.[action]?.(value, commit, field);
}

function runCommand(commandId, field, bindings = {}) {
  return bindings.runCommand?.(commandId, field);
}

function runAction(action, field, bindings = {}) {
  return bindings.actions?.[action]?.(field);
}

function normalizeSections(sections) {
  return Array.isArray(sections) ? sections.filter(Boolean) : [];
}

function sectionWithoutRawRows(section = {}) {
  return Object.fromEntries(Object.entries(section).filter(([key]) => key !== "rows"));
}
