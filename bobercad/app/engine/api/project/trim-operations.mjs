export const TRIM_OPERATION_TYPES = new Set(["end-butt-1", "end-butt-2", "end-butt-both", "end-miter", "profile-cope", "plane-trim"]);

function requireTrimOperationType(type) {
  if (!TRIM_OPERATION_TYPES.has(type)) throw new Error(`trim operations: unsupported trim operation type ${type || "missing"}`);
  return type;
}

export function trimOperationUsesMemberEnd(type, role) {
  requireTrimOperationType(type);
  if (role !== "memberA" && role !== "memberB") throw new Error(`trim operations: unsupported member role ${role || "missing"}`);
  if (type === "plane-trim") return role === "memberA";
  if (type === "end-butt-1") return role === "memberA";
  if (type === "end-butt-2") return role === "memberB";
  if (type === "end-butt-both" || type === "end-miter") return true;
  return false;
}

function optionalReferencePlaneIds(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`trim operations: ${label} must be a non-empty array of ids`);
  }
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`trim operations: ${label} must be an array`);
  return value;
}

export const trimOperationUsesMemberB = (type) => requireTrimOperationType(type) !== "plane-trim";

export function trimOperationReferencePlaneIds(operation) {
  const type = requireTrimOperationType(operation?.type);
  if (operation.referencePlaneIds === undefined) {
    if (type === "plane-trim") throw new Error("trim operations: plane-trim referencePlaneIds is required");
    return [];
  }
  return optionalReferencePlaneIds(operation.referencePlaneIds, "referencePlaneIds");
}

export const trimOperationFirstReferencePlaneId = (operation) => {
  const ids = trimOperationReferencePlaneIds(operation);
  return ids.length ? ids[0] : null;
};

export function trimJointParticipants(trimJoint) {
  return requiredArray(trimJoint?.participants, "participants");
}

export function trimJointOperations(trimJoint) {
  return requiredArray(trimJoint?.operations, "operations");
}

export function activeTrimJointParticipants(trimJoint) {
  return trimJointParticipants(trimJoint).filter((participant) => participant.enabled !== false);
}

export function activeTrimJointOperations(trimJoint) {
  return trimJointOperations(trimJoint).filter((operation) => operation.enabled !== false);
}

export function trimOperationById(trimJoint, operationId) {
  return operationId ? trimJointOperations(trimJoint).find((operation) => operation.id === operationId) || null : null;
}

export function trimPlaneOperationsForMember(trimJoint, memberId) {
  return trimJointOperations(trimJoint).filter((operation) => operation.type === "plane-trim" && operation.memberAId === memberId);
}

export function trimPlaneOperation(trimJoint) {
  return trimJointOperations(trimJoint).find((operation) => operation.type === "plane-trim" && trimOperationReferencePlaneIds(operation).length) || null;
}
