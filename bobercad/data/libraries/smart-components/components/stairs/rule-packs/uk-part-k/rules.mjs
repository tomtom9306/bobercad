import { createRulePack, runRulePack } from "../../../../../../../app/engine/api/model/compliance.mjs";

const LIMITS = {
  private: { riseMin: 150, riseMax: 220, goingMin: 220, goingMax: 300, pitchMax: 42 },
  utility: { riseMin: 150, riseMax: 190, goingMin: 250, goingMax: 400 },
  "general-access": { riseMin: 150, riseMax: 170, goingMin: 250, goingMax: 400 },
  "assembly-gangway": { riseMin: 100, riseMax: 190, goingMin: 250, goingMax: 400, pitchMax: 35 }
};

function categoryLimits(category) {
  return LIMITS[category] || LIMITS.utility;
}

function rangeRule(id, label, measurementPath, min, max, parameterPath, clause, objectRoles = []) {
  return {
    id,
    type: "number-range",
    severity: "error",
    measurementPath,
    min,
    max,
    parameterPath,
    objectRoles,
    clause,
    message: `${label} is outside the selected UK Part K guidance range.`,
    resolve: [
      ...(typeof min === "number" ? [{ mode: "min", path: parameterPath, value: min }] : []),
      ...(typeof max === "number" ? [{ mode: "max", path: parameterPath, value: max }] : [])
    ]
  };
}

function partKRulesForCategory(category) {
  const limits = categoryLimits(category);
  return [
    rangeRule("uk-part-k-rise", "Rise", "rise", limits.riseMin, limits.riseMax, "geometry.maxStepHeight", "K1 1.3 Table 1.1", ["treadPattern"]),
    rangeRule("uk-part-k-going", "Going", "going", limits.goingMin, limits.goingMax, "geometry.going", "K1 1.3 Table 1.1", ["treadPattern"]),
    rangeRule("uk-part-k-step-formula", "2R + G", "twiceRisePlusGoing", 550, 700, "geometry.going", "K1 1.3 Table 1.1 note", ["treadPattern"]),
    {
      id: "uk-part-k-pitch",
      type: "number-range",
      severity: "error",
      measurementPath: "pitchDeg",
      max: limits.pitchMax || 90,
      parameterPath: "geometry.going",
      objectRoles: ["treadPattern"],
      clause: category === "assembly-gangway" ? "K1 1.4(a)" : "K1 1.3 Table 1.1 note 1",
      message: "Pitch is above the selected UK Part K guidance maximum.",
      resolve: [{ mode: "min", path: "geometry.going", value: Math.ceil(1 / Math.tan((limits.pitchMax || 42) * Math.PI / 180)) }]
    },
    {
      id: "uk-part-k-headroom",
      type: "number-range",
      severity: "warning",
      measurementPath: "headroom",
      min: 2000,
      parameterPath: "compliance.headroom",
      objectRoles: ["treadPattern"],
      clause: "K1 Headroom for stairs",
      message: "Headroom should be reviewed against UK Part K guidance."
    },
    {
      id: "uk-part-k-handrail-height",
      type: "number-range",
      severity: "warning",
      measurementPath: "handrailHeight",
      min: 900,
      max: 1100,
      parameterPath: "railings.height",
      objectRoles: ["railing"],
      clause: "K1 Handrails for stairs",
      message: "Handrail height should be reviewed against UK Part K guidance."
    }
  ];
}

export function createUkPartKRulePack(category = "utility") {
  return createRulePack({
    id: "uk-part-k",
    title: "UK Part K stair checks",
    jurisdiction: "England",
    edition: "2013",
    sourceReferences: [
      {
        title: "Approved Document K",
        url: "https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/996860/Approved_Document_K.pdf"
      }
    ],
    applicableComponentKinds: ["stair-system"],
    rules: partKRulesForCategory(category)
  });
}

export function runUkPartK(context = {}) {
  const category = context.parameters?.compliance?.category || context.category || "utility";
  return runRulePack(createUkPartKRulePack(category), {
    ...context,
    componentKind: "stair-system"
  });
}
