import { clamp, distance2, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs?v=distance2-dry-1";
import { orderedSketchLoop, plateBends, plateOutline, sketchEdgePoints, sketchEdges, sketchVertexPointMap } from "../../engine/api/project/plates.mjs?v=plate-outline-relation-safety-1";
import { signedArea2d } from "../../engine/geometry/polygon.mjs?v=signed-area-1";

function bendTargetKey(target) {
  if (target?.parentBendId) return `bend:${target.parentBendId}:${target.parentEdge || "outer"}`;
  return `sketch:${target?.edgeId || target?.edge?.id || ""}`;
}

function reliefSize(bend, thickness) {
  if (!bend) return 0;
  const relief = bend.relief || {};
  if (relief.type === "none") return 0;
  if (finiteNumber(relief.radius)) return relief.radius;
  if (finiteNumber(relief.width)) return relief.width / 2;
  return Math.max(thickness, bend.radius || thickness);
}

function point2Add(a, b, distance) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = distance2(a, b);
  if (length <= 1e-6) return [...a];
  const capped = clamp(distance, 0, length * 0.45);
  return [a[0] + dx / length * capped, a[1] + dy / length * capped];
}

function reliefAdjustedOutline2d(plate) {
  const loop = orderedSketchLoop(plate.sketch);
  const bendByEdge = new Map(plateBends(plate).filter((bend) => !bend.parentBendId).map((bend) => [bend.edgeId, bend]));
  const outline = [];
  for (let index = 0; index < loop.length; index += 1) {
    const current = loop[index];
    const previous = loop[(index + loop.length - 1) % loop.length];
    const next = loop[(index + 1) % loop.length];
    const size = Math.max(reliefSize(bendByEdge.get(current.incomingEdgeId), plate.thickness), reliefSize(bendByEdge.get(current.outgoingEdgeId), plate.thickness));
    if (size <= 0) {
      outline.push(current.point);
      continue;
    }
    outline.push(point2Add(current.point, previous.point, size));
    outline.push(point2Add(current.point, next.point, size));
  }
  return outline;
}

function shrinkEdge(start, end, amount) {
  const tangent = v.sub(end, start);
  const length = v.len(tangent);
  if (length <= 1e-6) return null;
  const capped = clamp(amount, 0, length * 0.45);
  const axis = v.mul(tangent, 1 / length);
  return {
    start: v.add(start, v.mul(axis, capped)),
    end: v.add(end, v.mul(axis, -capped)),
    tangent: axis,
    length: length - capped * 2
  };
}

export function plateBendGeometry(plate) {
  const bends = plateBends(plate);
  const y = v.norm(plate.localAxisY);
  const z = v.norm(plate.localAxisZ);
  const n = v.norm(plate.normal);
  const outline = plateOutline(plate);
  const area = signedArea2d(outline);
  const toWorld = (point) => v.add(plate.center, v.add(v.mul(y, point[0]), v.mul(z, point[1])));
  const basePoints = reliefAdjustedOutline2d(plate).map(toWorld);
  const targetEdges = [];
  const panels = [];
  const vertexMap = sketchVertexPointMap(plate.sketch);

  for (const edge of sketchEdges(plate.sketch)) {
    const { a, b } = sketchEdgePoints(plate.sketch, edge, vertexMap);
    const edge2 = [b[0] - a[0], b[1] - a[1]];
    const edgeLength = distance2(a, b);
    if (edgeLength <= 1e-6) continue;
    const tangent2 = [edge2[0] / edgeLength, edge2[1] / edgeLength];
    const outward2 = area >= 0 ? [tangent2[1], -tangent2[0]] : [-tangent2[1], tangent2[0]];
    targetEdges.push({
      id: `sketch:${edge.id}`,
      edgeId: edge.id,
      edgeRole: "sketch",
      start: toWorld(a),
      end: toWorld(b),
      sourceNormal: n,
      outward: v.norm(v.add(v.mul(y, outward2[0]), v.mul(z, outward2[1])))
    });
  }

  const unresolved = [...bends];
  for (let guard = 0; unresolved.length && guard < bends.length + 5; guard += 1) {
    let progressed = false;
    for (let index = unresolved.length - 1; index >= 0; index -= 1) {
      const bend = unresolved[index];
      const target = targetEdges.find((edge) => edge.id === bendTargetKey(bend));
      if (!target) continue;
      const edge = shrinkEdge(target.start, target.end, reliefSize(bend, plate.thickness));
      if (!edge || edge.length <= 1e-6) {
        unresolved.splice(index, 1);
        progressed = true;
        continue;
      }
      const angle = Math.abs(finiteNumberOr(bend.angle, 90)) * Math.PI / 180;
      const direction = bend.direction === "down" ? -1 : 1;
      const flangeDir = v.norm(v.add(v.mul(target.outward, Math.cos(angle)), v.mul(target.sourceNormal, direction * Math.sin(angle))));
      const flangeNormal = v.norm(v.cross(edge.tangent, flangeDir));
      const flangeLength = finiteNumberOr(bend.flangeLength, 0);
      if (flangeLength <= 1e-6) {
        unresolved.splice(index, 1);
        progressed = true;
        continue;
      }
      const outerStart = v.add(edge.start, v.mul(flangeDir, flangeLength));
      const outerEnd = v.add(edge.end, v.mul(flangeDir, flangeLength));
      const panel = {
        bend,
        edgeStart: edge.start,
        edgeEnd: edge.end,
        edgeTangent: edge.tangent,
        flangeDir,
        normal: flangeNormal,
        points: [edge.start, edge.end, outerEnd, outerStart]
      };
      panels.push(panel);
      targetEdges.push({
        id: `bend:${bend.id}:outer`,
        parentBendId: bend.id,
        parentEdge: "outer",
        edgeRole: "bend-outer",
        start: outerStart,
        end: outerEnd,
        sourceNormal: flangeNormal,
        outward: flangeDir
      });
      unresolved.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  return { basePoints, panels, targetEdges, unresolved };
}
