import { memberAuthoringPoints } from "../../engine/api/project/members.mjs";

function memberById(project, memberId, draftMember = null) {
  return draftMember || project.model?.members?.[memberId] || null;
}

function line(points, color, objectId, kind) {
  return { points, color, objectId, collection: "authoring", kind };
}

function handle(memberId, kind, point, color, radius = 10) {
  return { memberId, kind, point, color, radius };
}

export function memberAuthoringOverlay(project, memberId, options = {}) {
  const member = memberById(project, memberId, options.member);
  if (!member) return { lines: [], handles: [] };
  const points = memberAuthoringPoints(member);
  const lines = [
    line([points.physicalStart, points.physicalEnd], "#22c55e", memberId, "physical-axis"),
    line([points.layoutStart, points.layoutEnd], "#f59e0b", memberId, "layout-axis")
  ];
  if (options.snap?.point) {
    lines.push(line([options.dragPoint || options.snap.point, options.snap.point], "#38bdf8", memberId, "snap-line"));
  }
  return {
    lines,
    handles: [
      handle(memberId, "move-member", points.center, "#0ea5e9", 12),
      handle(memberId, "physical-start", points.physicalStart, "#22c55e"),
      handle(memberId, "physical-end", points.physicalEnd, "#22c55e"),
      handle(memberId, "layout-start", points.layoutStart, "#f59e0b"),
      handle(memberId, "layout-end", points.layoutEnd, "#f59e0b")
    ]
  };
}
