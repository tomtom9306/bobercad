export function snapDiagnostic(result, data = {}) {
  return {
    accepted: Boolean(result.accepted),
    providerId: result.providerId || null,
    type: result.type || null,
    label: result.label || null,
    target: result.target || null,
    strength: result.strength || null,
    candidateCount: Array.isArray(result.candidates) ? result.candidates.length : 0,
    cycleIndex: data.cycleIndex || 0,
    cycleGroup: data.cycleGroup || null,
    scope: data.scope || {}
  };
}

export function candidateDiagnostic(candidate, status, reason) {
  return {
    candidateId: candidate?.candidateId || [
      candidate?.providerId || "provider",
      candidate?.type || candidate?.kind || "candidate",
      candidate?.target?.collection,
      candidate?.target?.objectId,
      candidate?.target?.subId,
      candidate?.objectId
    ].filter(Boolean).join(":"),
    status,
    reason,
    providerId: candidate?.providerId || null,
    type: candidate?.type || null,
    kind: candidate?.kind || null,
    label: candidate?.label || null,
    target: candidate?.target || null,
    priority: Number.isFinite(candidate?.priority) ? candidate.priority : null
  };
}
