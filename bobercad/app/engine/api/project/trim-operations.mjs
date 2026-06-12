import { arrayValues } from "../../core/model.mjs?v=array-values-dry-1";

export function trimOperationUsesMemberEnd(type, role) {
  if (type === "end-butt-1") return role === "memberA";
  if (type === "end-butt-2") return role === "memberB";
  if (type === "end-butt-both" || type === "end-miter") return true;
  return false;
}

export const trimOperationUsesMemberB = (type) => type !== "plane-trim";
export const trimOperationReferencePlaneIds = (operation) => arrayValues(operation?.referencePlaneIds);
export const trimOperationFirstReferencePlaneId = (operation) => trimOperationReferencePlaneIds(operation)[0] || null;

export function trimJointParticipants(trimJoint) {
  return arrayValues(trimJoint?.participants);
}

export function trimJointOperations(trimJoint) {
  return arrayValues(trimJoint?.operations);
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
