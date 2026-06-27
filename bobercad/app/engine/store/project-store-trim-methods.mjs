import { isPlainObject as plainObject, jsonClone as clone, mergeObjectPatch as mergePatch, uniqueTruthy as unique } from "../core/model.mjs";
import { addIndexedObject, nextObjectId } from "../api/project/objects.mjs";
import { TRIM_OPERATION_TYPES, trimJointOperations, trimJointParticipants, trimOperationMemberIds, trimOperationUsesMemberEnd } from "../api/project/trim-operations.mjs";
import {
  defaultTrimJointOperation,
  defaultTrimJointParticipant,
  ensureTrimJointParticipant,
  fail,
  memberById,
  nearestMemberEnd,
  normalizedTrimJointOperation,
  requiredStringList,
  trimJointReferencePoint,
  trimOperationTypeFromOptions,
  validateTrimJointOperation
} from "./project-store-model-helpers.mjs";

export function createTrimStoreMethods({ state, commitProject, replaceTrimJoint }) {
  const project = () => state.currentProject;

  return {
    createTrimJoint(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("trim joint options must be an object");
      const memberIds = unique(requiredStringList(options.memberIds, "trim joint memberIds"));
      for (const memberId of memberIds) memberById(project(), memberId);
      if (options.operationPatch !== undefined && !plainObject(options.operationPatch)) fail("trim joint operationPatch must be an object");
      if (options.operationPatches !== undefined) fail("trim joint operationPatches is no longer supported; use one operationPatch with memberAIds/memberBIds");
      const operationPatch = options.operationPatch === undefined ? {} : clone(options.operationPatch);
      const operationType = trimOperationTypeFromOptions(options, operationPatch);
      if (operationType !== "plane-trim" && memberIds.length < 2) fail("member-to-member trim requires two members");
      if (operationType === "plane-trim" && memberIds.length < 1) fail("plane trim requires one member");
      if (options.patch !== undefined && !plainObject(options.patch)) fail("trim joint patch must be an object");
      const trimJointType = operationType === "plane-trim" ? "member-trim" : "corner-trim";

      const next = clone(project());
      if (options.id !== undefined && (typeof options.id !== "string" || !options.id.trim())) fail("trim joint id must be a non-empty string");
      const id = nextObjectId(next, options.id === undefined ? `trim_${memberIds.join("_") || "joint"}` : options.id);
      const trimJoint = {
        id,
        type: trimJointType,
        gap: 0,
        participants: [],
        operations: [],
        ...(options.patch === undefined ? {} : clone(options.patch))
      };
      trimJoint.id = id;
      trimJoint.type = trimJointType;
      for (const memberId of memberIds) {
        trimJoint.participants.push(defaultTrimJointParticipant(next, trimJoint, memberId));
      }

      const operation = defaultTrimJointOperation(trimJoint, {
        type: operationType,
        memberAId: operationPatch.memberAId === undefined ? memberIds[0] : operationPatch.memberAId,
        memberBId: operationType === "plane-trim" ? undefined : operationPatch.memberBId === undefined ? memberIds[1] : operationPatch.memberBId,
        gap: 0,
        ...operationPatch
      });
      validateTrimJointOperation(next, id, trimJoint, operation);
      trimJoint.operations.push(operation);
      addIndexedObject(next, "trimJoints", trimJoint);
      const updated = commitProject("trimJoint.create", next, { changedObjectIds: [id] });
      return { project: updated, trimJointId: id, trimJoint: updated.model.trimJoints[id] };
    },

    updateTrimJoint(trimJointId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint patch must be an object");
      if ("id" in patch && patch.id !== trimJointId) fail("trim joint id cannot be changed");
      if ("type" in patch) fail("trim joint type cannot be changed");
      if ("jointPoint" in patch) fail("trim joint point is derived from participant member axes");
      return replaceTrimJoint(trimJointId, (trimJoint) => mergePatch(trimJoint, patch));
    },

    updateTrimJointParticipant(trimJointId, memberId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint participant patch must be an object");
      if ("memberId" in patch && patch.memberId !== memberId) fail("participant member cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = trimJointParticipants(trimJoint).map((participant) => (
          participant.memberId === memberId ? mergePatch(participant, patch) : participant
        ));
        if (!participants.some((participant) => participant.memberId === memberId)) fail(`${trimJointId}: participant not found: ${memberId}`);
        return { ...trimJoint, participants };
      });
    },

    addTrimJointParticipant(trimJointId, memberId, patch = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint participant patch must be an object");
      if ("memberId" in patch && patch.memberId !== memberId) fail("participant member cannot be changed");
      memberById(project(), memberId);
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        if (trimJointParticipants(trimJoint).some((participant) => participant.memberId === memberId)) {
          fail(`${trimJointId}: participant already exists: ${memberId}`);
        }
        return {
          ...trimJoint,
          participants: [
            ...trimJointParticipants(trimJoint),
            defaultTrimJointParticipant(project(), trimJoint, memberId, patch)
          ]
        };
      });
    },

    removeTrimJointParticipant(trimJointId, memberId) {
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = trimJointParticipants(trimJoint).filter((participant) => participant.memberId !== memberId);
        if (participants.length === trimJointParticipants(trimJoint).length) fail(`${trimJointId}: participant not found: ${memberId}`);
        if (!participants.length) fail(`${trimJointId}: trim requires at least one participant`);
        const operations = trimJointOperations(trimJoint).filter((operation) => (
          !trimOperationMemberIds(operation, "memberA").includes(memberId)
          && !trimOperationMemberIds(operation, "memberB").includes(memberId)
        ));
        return { ...trimJoint, participants, operations };
      });
    },

    addTrimJointOperation(trimJointId, patch = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint operation patch must be an object");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operation = defaultTrimJointOperation(trimJoint, patch);
        validateTrimJointOperation(project(), trimJointId, trimJoint, operation);
        if (trimJointOperations(trimJoint).some((item) => item.id === operation.id)) fail(`${trimJointId}: operation already exists: ${operation.id}`);
        return { ...trimJoint, operations: [...trimJointOperations(trimJoint), operation] };
      });
    },

    updateTrimJointOperation(trimJointId, operationId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint operation patch must be an object");
      if ("id" in patch && patch.id !== operationId) fail("trim joint operation id cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operations = trimJointOperations(trimJoint).map((operation) => {
          if (operation.id !== operationId) return operation;
          const next = normalizedTrimJointOperation(trimJoint, mergePatch(operation, patch));
          validateTrimJointOperation(project(), trimJointId, trimJoint, next);
          return next;
        });
        if (!operations.some((operation) => operation.id === operationId)) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...trimJoint, operations };
      });
    },

    setTrimJointOperationMember(trimJointId, operationId, role, memberId) {
      if (role !== "memberA" && role !== "memberB") fail("trim joint operation role must be memberA or memberB");
      memberById(project(), memberId);
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const nextTrimJoint = ensureTrimJointParticipant(project(), trimJoint, memberId);
        let found = false;
        const operations = trimJointOperations(nextTrimJoint).map((operation) => {
          if (operation.id !== operationId) return operation;
          found = true;
          const patch = role === "memberA" ? { memberAId: memberId } : { memberBId: memberId };
          if (operation.type === "profile-cope") {
            patch[`${role}Ids`] = [memberId];
            patch.removedRegionKeys = [];
          }
          if (!TRIM_OPERATION_TYPES.has(operation.type)) fail(`${trimJointId}: unsupported trim operation type ${operation.type}`);
          if (trimOperationUsesMemberEnd(operation.type, role)) {
            const referencePoint = trimJointReferencePoint(project(), nextTrimJoint);
            if (!referencePoint) fail(`${trimJointId}: trim joint has no member reference point`);
            patch[`${role}End`] = nearestMemberEnd(memberById(project(), memberId), referencePoint);
          }
          const next = normalizedTrimJointOperation(nextTrimJoint, mergePatch(operation, patch));
          validateTrimJointOperation(project(), trimJointId, nextTrimJoint, next);
          return next;
        });
        if (!found) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...nextTrimJoint, operations };
      });
    },

    removeTrimJointOperation(trimJointId, operationId) {
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operations = trimJointOperations(trimJoint).filter((operation) => operation.id !== operationId);
        if (operations.length === trimJointOperations(trimJoint).length) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...trimJoint, operations };
      });
    }
  };
}
