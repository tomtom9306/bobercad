import {
  catalogRef,
  defineConnection,
  enumValue,
  nonNegativeNumber,
  numberValue,
  positiveInteger,
  positiveNumber,
  textValue
} from "../schema.mjs";

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) {
    const length = v.len(a);
    return length ? v.mul(a, 1 / length) : [0, 0, 0];
  }
};

const EPSILON = 1e-9;

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function projectedAxis(axis, normal) {
  const projected = v.sub(axis, v.mul(normal, v.dot(axis, normal)));
  return v.len(projected) > EPSILON ? v.norm(projected) : null;
}

function endPlateAxes(mainInterface, secondaryInterface) {
  const normal = v.norm(mainInterface.normal);
  const secondaryZ = projectedAxis(secondaryInterface.localAxisZ, normal);
  let localAxisZ = secondaryZ || projectedAxis(mainInterface.localAxisZ, normal);
  if (!localAxisZ) localAxisZ = projectedAxis([0, 0, 1], normal) || projectedAxis([0, 1, 0], normal);
  const secondaryY = projectedAxis(secondaryInterface.localAxisY, normal);
  let localAxisY = v.norm(v.cross(localAxisZ, normal));
  if (secondaryY && v.dot(localAxisY, secondaryY) < 0) localAxisY = v.mul(localAxisY, -1);
  localAxisZ = v.norm(v.cross(normal, localAxisY));
  return { localAxisY, localAxisZ };
}

function checkGridFitsPlate(ctx, pattern, plateWidth, plateHeight) {
  const radius = pattern.holeDiameter / 2;
  const maxY = Math.max(...pattern.positions.map((point) => Math.abs(point[0])));
  const maxZ = Math.max(...pattern.positions.map((point) => Math.abs(point[1])));
  if (maxY + radius >= plateWidth / 2 || maxZ + radius >= plateHeight / 2) {
    ctx.error("moment-end-plate-hole-grid-outside-plate", "Bolt holes do not fit inside the end plate.", {
      objectRoles: ["endPlate", "holePattern", "plateHoles", "fasteners"],
      parameters: ["bolts.pitch", "bolts.gauge", "holes.diameter", "plate.width", "plate.height"]
    });
  }
}

function checkGridFitsMainInterface(ctx, pattern, mainInterface) {
  const radius = pattern.holeDiameter / 2;
  const allowedWidth = mainInterface.extents?.width;
  const allowedHeight = mainInterface.extents?.height;
  const outsideWidth = finitePositive(allowedWidth) && pattern.positions.some((point) => Math.abs(point[0]) + radius >= allowedWidth / 2);
  const outsideHeight = finitePositive(allowedHeight) && pattern.positions.some((point) => Math.abs(point[1]) + radius >= allowedHeight / 2);
  if (outsideWidth || outsideHeight) {
    ctx.error("moment-end-plate-hole-grid-outside-main-interface", "Bolt holes do not fit inside the main member connection face.", {
      objectRoles: ["holePattern", "memberHoles", "fasteners"],
      parameters: ["bolts.pitch", "bolts.gauge", "holes.diameter"]
    });
  }
}

export default defineConnection({
  type: "moment-end-plate",
  title: "Moment End Plate",
  version: 1,
  roles: {
    endPlate: "_end_plate",
    holePattern: "_bolt_grid",
    plateHoles: "_holes_plate",
    memberHoles: "_holes_main",
    fasteners: "_bolts",
    weld: "_beam_weld",
    beamFitting: "_beam_fitting"
  },
  parameters: {
    "plate.thickness": positiveNumber({ label: "Plate thickness", unit: "mm" }),
    "plate.width": positiveNumber({ label: "Plate width", unit: "mm" }),
    "plate.height": positiveNumber({ label: "Plate height", unit: "mm" }),
    "plate.offset": numberValue({ label: "Plate offset", unit: "mm" }),
    "bolts.fastenerRef": catalogRef("fasteners", { label: "Fastener", readOnly: true }),
    "bolts.rows": positiveInteger({ label: "Rows", unit: "pcs" }),
    "bolts.columns": positiveInteger({ label: "Columns", unit: "pcs" }),
    "bolts.pitch": nonNegativeNumber({ label: "Pitch", unit: "mm" }),
    "bolts.gauge": nonNegativeNumber({ label: "Gauge", unit: "mm" }),
    "holes.diameter": positiveNumber({ label: "Hole diameter", unit: "mm" }),
    "holes.memberDepth": positiveNumber({ label: "Member depth", unit: "mm" }),
    "holes.type": enumValue(["round", "slotted", "countersunk"], { label: "Hole type", readOnly: true }),
    "welds.beamWeb": positiveNumber({ label: "Web weld", unit: "mm" }),
    "welds.beamFlanges": positiveNumber({ label: "Flange weld", unit: "mm" }),
    "designAssumptions.standard": textValue({ label: "Standard", readOnly: true }),
    "designAssumptions.status": textValue({ label: "Calculation", readOnly: true }),
    "loads.status": textValue({ label: "Loads", readOnly: true })
  },
  ui: {
    tabs: [
      { id: "parts", label: "Parts", items: ["plate.thickness", "plate.width", "plate.height", { kind: "connectionPlates" }] },
      { id: "bolts", label: "Bolts", items: ["bolts.fastenerRef", "bolts.rows", "bolts.columns", "bolts.pitch", "bolts.gauge", "holes.diameter", "holes.memberDepth"] },
      { id: "welds", label: "Welds", items: ["welds.beamWeb", "welds.beamFlanges"] },
      { id: "design", label: "Design", items: ["designAssumptions.standard", "designAssumptions.status", "loads.status"] }
    ]
  },

  build(ctx) {
    const mainInterface = ctx.interface("main");
    const secondaryInterface = ctx.interface("secondary");
    const mainMember = ctx.member("main");
    const secondaryMember = ctx.member("secondary");
    if (!secondaryInterface.memberEnd) ctx.fail("secondary interface missing memberEnd");

    const plateThickness = ctx.param("plate.thickness");
    const plateWidth = ctx.param("plate.width");
    const plateHeight = ctx.param("plate.height");
    const plateOffset = ctx.param("plate.offset");
    const plateNormal = v.norm(mainInterface.normal);
    const beamDirection = v.mul(v.norm(secondaryInterface.normal), -1);
    const center = v.add(mainInterface.origin, v.mul(plateNormal, plateThickness / 2 + plateOffset));
    const beamFaceOrigin = v.add(mainInterface.origin, v.mul(plateNormal, plateThickness + plateOffset));
    const axes = endPlateAxes(mainInterface, secondaryInterface);

    if (v.dot(plateNormal, beamDirection) < 0.5) {
      ctx.error("moment-end-plate-secondary-end-not-facing-support", "The secondary member end is not facing the selected support interface.", {
        objectRoles: ["endPlate", "beamFitting", "weld"],
        parameters: ["plate.thickness", "plate.offset"]
      });
    }

    const endPlate = ctx.part.plate("endPlate", {
      type: "rectangular-plate",
      thickness: plateThickness,
      width: plateWidth,
      height: plateHeight,
      center,
      normal: plateNormal,
      localAxisY: axes.localAxisY,
      localAxisZ: axes.localAxisZ,
      assemblyId: ctx.connection.assemblyId,
      placementIntent: {
        role: "end-plate",
        host: { objectId: secondaryMember.id, end: secondaryInterface.memberEnd },
        references: [{ objectId: mainMember.id, interfaceId: mainInterface.id }],
        fit: "support-face-to-fitted-secondary-end"
      },
      display: { color: "#355a70" },
      fabrication: { partMark: "EP1" }
    });

    const beamFitting = ctx.feature.fitting("beamFitting", {
      ownerId: secondaryMember.id,
      plane: {
        origin: beamFaceOrigin,
        normal: plateNormal,
        axisX: axes.localAxisY,
        axisY: axes.localAxisZ
      },
      display: { visible: false },
      fabrication: { operation: "fit-to-end-plate" },
      placementIntent: {
        role: "fit-secondary-member-to-end-plate",
        host: { objectId: secondaryMember.id, end: secondaryInterface.memberEnd },
        references: [{ objectId: endPlate.id }],
        fit: "secondary-end-to-end-plate-outer-face"
      }
    });

    const boltGrid = ctx.pattern.rectangularGrid("holePattern", {
      rows: ctx.param("bolts.rows"),
      columns: ctx.param("bolts.columns"),
      pitch: ctx.param("bolts.rows") === 1 ? 0 : ctx.param("bolts.pitch"),
      gauge: ctx.param("bolts.columns") === 1 ? 0 : ctx.param("bolts.gauge"),
      holeDiameter: ctx.param("holes.diameter"),
      holeType: ctx.param("holes.type")
    });
    checkGridFitsPlate(ctx, boltGrid, plateWidth, plateHeight);
    checkGridFitsMainInterface(ctx, boltGrid, mainInterface);

    const plateHoles = ctx.feature.holePattern("plateHoles", {
      ownerId: endPlate.id,
      holePatternRef: boltGrid.id,
      reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: endPlate.localAxisY, localAxisZ: endPlate.localAxisZ },
      fabrication: { operation: "drill" }
    });

    const memberHoles = ctx.feature.holePattern("memberHoles", {
      ownerId: mainMember.id,
      holePatternRef: boltGrid.id,
      depth: ctx.param("holes.memberDepth"),
      reference: { kind: "member-face", interfaceRef: mainInterface.id, stationReferenceInterfaceRef: secondaryInterface.id },
      fabrication: { operation: "drill" }
    });

    ctx.fastener.group("fasteners", {
      fastenerRef: ctx.param("bolts.fastenerRef"),
      holePatternRef: boltGrid.id,
      participants: [endPlate.id, mainMember.id],
      through: { fromFeatureId: plateHoles.id, toFeatureId: memberHoles.id },
      orientation: { axis: plateNormal, headSide: "secondary-member-side" }
    });

    ctx.weld.fillet("weld", {
      size: ctx.param("welds.beamWeb"),
      participants: [secondaryMember.id, endPlate.id],
      reference: { kind: "member-end-profile", memberId: secondaryMember.id, end: secondaryInterface.memberEnd, fittingFeatureId: beamFitting.id }
    });
  }
});
