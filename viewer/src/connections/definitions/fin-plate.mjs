import {
  catalogRef,
  defineConnection,
  enumValue,
  nonNegativeNumber,
  positiveInteger,
  positiveNumber,
  textValue
} from "../schema.mjs";
import { memberFrame, sectionWebBounds } from "../../geometry/member-geometry.mjs?v=weld-fitting-1";

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) {
    const length = v.len(a);
    return length ? v.mul(a, 1 / length) : [0, 0, 0];
  }
};

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function projectPointToPlane(point, planeOrigin, normal) {
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, planeOrigin), normal)));
}

function secondaryBeamDirection(member, beamInterface) {
  const frame = memberFrame(member);
  if (beamInterface.memberEnd === "start") return frame.x;
  if (beamInterface.memberEnd === "end") return v.mul(frame.x, -1);
  return v.mul(v.norm(beamInterface.normal), -1);
}

function webHeight(profile) {
  const bounds = sectionWebBounds(profile);
  return bounds.maxZ - bounds.minZ;
}

function secondaryWebReference(member, profile, supportInterface, beamInterface, plateLength, plateThickness, edgeOffset) {
  const frame = memberFrame(member);
  const beamDirection = secondaryBeamDirection(member, beamInterface);
  const webBounds = sectionWebBounds(profile);
  const explicitWebSide = beamInterface.faceRef === "web-center-plane" || beamInterface.type === "member-web";
  const side = explicitWebSide && v.dot(beamInterface.normal, frame.y) < 0 ? -1 : 1;
  const webNormal = v.mul(frame.y, side);
  const supportEdge = v.add(supportInterface.origin, v.mul(supportInterface.normal, edgeOffset));
  const startOnWebCenter = projectPointToPlane(supportEdge, beamInterface.origin, frame.y);
  const startOnWebFace = v.add(startOnWebCenter, v.mul(frame.y, side > 0 ? webBounds.maxY : webBounds.minY));
  const webFaceOrigin = v.add(startOnWebFace, v.mul(beamDirection, plateLength / 2));
  return {
    origin: v.add(webFaceOrigin, v.mul(webNormal, plateThickness / 2)),
    webFaceOrigin,
    normal: webNormal,
    localAxisY: beamDirection,
    localAxisZ: frame.z,
    extents: {
      length: beamInterface.extents?.length || v.len(v.sub(member.end, member.start)),
      height: webHeight(profile)
    }
  };
}

function checkGridFitsPlate(ctx, pattern, plateLength, plateHeight) {
  const radius = pattern.holeDiameter / 2;
  const maxY = Math.max(...pattern.positions.map((point) => Math.abs(point[0])));
  const maxZ = Math.max(...pattern.positions.map((point) => Math.abs(point[1])));
  if (maxY + radius >= plateLength / 2 || maxZ + radius >= plateHeight / 2) {
    ctx.error("fin-plate-hole-grid-outside-plate", "Bolt holes do not fit inside the fin plate.", {
      objectRoles: ["finPlate", "holePattern", "plateHoles", "fasteners"],
      parameters: ["bolts.pitch", "bolts.gauge", "holes.diameter", "plate.length", "plate.height"]
    });
  }
}

function checkPlateFitsSecondaryInterface(ctx, beamInterface, plateLength, plateHeight, edgeOffset) {
  const allowedLength = beamInterface.extents?.length;
  const allowedHeight = beamInterface.extents?.height;
  if (finitePositive(allowedLength) && edgeOffset + plateLength > allowedLength) {
    ctx.error("fin-plate-length-outside-secondary-interface", `Fin plate extends ${edgeOffset + plateLength - allowedLength} mm past the secondary member connection zone.`, {
      objectRoles: ["finPlate"],
      parameters: ["plate.length", "plate.edgeOffset"]
    });
  }
  if (finitePositive(allowedHeight) && plateHeight > allowedHeight) {
    ctx.error("fin-plate-height-intersects-secondary-flanges", `Fin plate height ${plateHeight} mm exceeds the secondary web zone height ${allowedHeight} mm.`, {
      objectRoles: ["finPlate"],
      parameters: ["plate.height"]
    });
  }
}

function checkGridFitsSecondaryInterface(ctx, pattern, beamInterface, plateLength, edgeOffset) {
  const allowedLength = beamInterface.extents?.length;
  const allowedHeight = beamInterface.extents?.height;
  const radius = pattern.holeDiameter / 2;
  const centerStation = edgeOffset + plateLength / 2;
  const outsideLength = finitePositive(allowedLength) && pattern.positions.some((point) => {
    const station = centerStation + point[0];
    return station - radius < 0 || station + radius > allowedLength;
  });
  const outsideHeight = finitePositive(allowedHeight) && pattern.positions.some((point) => Math.abs(point[1]) + radius >= allowedHeight / 2);
  if (outsideLength || outsideHeight) {
    ctx.error("fin-plate-hole-grid-outside-secondary-interface", "Bolt holes do not fit inside the secondary member connection zone.", {
      objectRoles: ["holePattern", "memberHoles", "fasteners"],
      parameters: ["bolts.pitch", "bolts.gauge", "holes.diameter", "plate.length", "plate.edgeOffset"]
    });
  }
}

export default defineConnection({
  type: "fin-plate",
  title: "Fin Plate",
  version: 1,
  roles: {
    finPlate: "_fin_plate",
    holePattern: "_bolt_grid",
    plateHoles: "_holes_plate",
    memberHoles: "_holes_secondary",
    fasteners: "_bolts",
    weld: "_support_weld"
  },
  requiredPlateRoles: ["finPlate"],
  parameters: {
    "plate.thickness": positiveNumber({ label: "Plate thickness", unit: "mm" }),
    "plate.length": positiveNumber({ label: "Plate length", unit: "mm" }),
    "plate.height": positiveNumber({ label: "Plate height", unit: "mm" }),
    "plate.edgeOffset": nonNegativeNumber({ label: "Support edge", unit: "mm" }),
    "bolts.fastenerRef": catalogRef("fasteners", { label: "Fastener", readOnly: true }),
    "bolts.rows": positiveInteger({ label: "Rows", unit: "pcs" }),
    "bolts.columns": positiveInteger({ label: "Columns", unit: "pcs" }),
    "bolts.pitch": nonNegativeNumber({ label: "Pitch", unit: "mm" }),
    "bolts.gauge": nonNegativeNumber({ label: "Gauge", unit: "mm" }),
    "holes.diameter": positiveNumber({ label: "Hole diameter", unit: "mm" }),
    "holes.memberDepth": positiveNumber({ label: "Member depth", unit: "mm" }),
    "holes.type": enumValue(["round", "slotted", "countersunk"], { label: "Hole type", readOnly: true }),
    "welds.support": positiveNumber({ label: "Support weld", unit: "mm" }),
    "designAssumptions.standard": textValue({ label: "Standard", readOnly: true }),
    "designAssumptions.status": textValue({ label: "Calculation", readOnly: true }),
    "loads.status": textValue({ label: "Loads", readOnly: true })
  },
  ui: {
    tabs: [
      { id: "parts", label: "Parts", items: ["plate.thickness", "plate.length", "plate.height", "plate.edgeOffset", { kind: "connectionPlates" }] },
      { id: "bolts", label: "Bolts", items: ["bolts.fastenerRef", "bolts.rows", "bolts.columns", "bolts.pitch", "bolts.gauge", "holes.diameter", "holes.memberDepth"] },
      { id: "welds", label: "Welds", items: ["welds.support"] },
      { id: "design", label: "Design", items: ["designAssumptions.standard", "designAssumptions.status", "loads.status"] }
    ]
  },

  build(ctx) {
    const supportInterface = ctx.interface("main");
    const beamInterface = ctx.interface("secondary");
    const supportMember = ctx.member("main");
    const supportedBeam = ctx.member("secondary");
    const supportedBeamProfile = ctx.profile("secondary");
    if (!beamInterface.memberEnd) ctx.fail("secondary interface missing memberEnd");

    const plateThickness = ctx.param("plate.thickness");
    const plateLength = ctx.param("plate.length");
    const plateHeight = ctx.param("plate.height");
    const edgeOffset = ctx.param("plate.edgeOffset");
    const webReference = secondaryWebReference(supportedBeam, supportedBeamProfile, supportInterface, beamInterface, plateLength, plateThickness, edgeOffset);
    checkPlateFitsSecondaryInterface(ctx, webReference, plateLength, plateHeight, edgeOffset);

    const finPlate = ctx.part.plate("finPlate", {
      type: "rectangular-plate",
      thickness: plateThickness,
      width: plateLength,
      height: plateHeight,
      center: webReference.origin,
      normal: webReference.normal,
      localAxisY: webReference.localAxisY,
      localAxisZ: webReference.localAxisZ,
      assemblyId: ctx.connection.assemblyId,
      placementIntent: {
        role: "fin-plate",
        host: { objectId: supportMember.id, interfaceId: supportInterface.id },
        references: [{ objectId: supportedBeam.id, end: beamInterface.memberEnd }],
        fit: "support-face-to-secondary-web"
      },
      display: { color: "#4f6f83" },
      fabrication: { partMark: "FP1" }
    });

    const boltGrid = ctx.pattern.rectangularGrid("holePattern", {
      rows: ctx.param("bolts.rows"),
      columns: ctx.param("bolts.columns"),
      pitch: ctx.param("bolts.rows") === 1 ? 0 : ctx.param("bolts.pitch"),
      gauge: ctx.param("bolts.columns") === 1 ? 0 : ctx.param("bolts.gauge"),
      holeDiameter: ctx.param("holes.diameter"),
      holeType: ctx.param("holes.type")
    });
    checkGridFitsPlate(ctx, boltGrid, plateLength, plateHeight);
    checkGridFitsSecondaryInterface(ctx, boltGrid, webReference, plateLength, edgeOffset);

    const plateHoles = ctx.feature.holePattern("plateHoles", {
      ownerId: finPlate.id,
      holePatternRef: boltGrid.id,
      reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: finPlate.localAxisY, localAxisZ: finPlate.localAxisZ },
      fabrication: { operation: "drill" }
    });

    const memberHoles = ctx.feature.holePattern("memberHoles", {
      ownerId: supportedBeam.id,
      holePatternRef: boltGrid.id,
      depth: ctx.param("holes.memberDepth"),
      reference: {
        kind: "member-web",
        origin: webReference.webFaceOrigin,
        normal: webReference.normal,
        localAxisY: webReference.localAxisY,
        localAxisZ: webReference.localAxisZ
      },
      fabrication: { operation: "drill" }
    });

    ctx.fastener.group("fasteners", {
      fastenerRef: ctx.param("bolts.fastenerRef"),
      holePatternRef: boltGrid.id,
      participants: [finPlate.id, supportedBeam.id],
      through: { fromFeatureId: plateHoles.id, toFeatureId: memberHoles.id },
      orientation: { axis: webReference.normal, headSide: "fin-plate-side" }
    });

    ctx.weld.fillet("weld", {
      size: ctx.param("welds.support"),
      participants: [supportMember.id, finPlate.id],
      reference: { kind: "plate-support-edge", plateId: finPlate.id, supportInterfaceId: supportInterface.id, stationReferenceInterfaceRef: beamInterface.id }
    });
  }
});
