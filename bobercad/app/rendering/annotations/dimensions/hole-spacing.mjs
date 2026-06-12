import { combine, dimensionOffset, distance, featureBasis, finite, holePair, optionalPath, patternLayoutBasis, patternPositionsInBasis, positionPoint, roleObject, spacingDimension, spacingPairs } from "../dimension-context.mjs?v=unified-dimension-overlay-1";

export function holeSpacingDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.smartComponent, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const layoutPattern = pattern && sourceBasis && basis ? { ...pattern, positions: patternPositionsInBasis(pattern, sourceBasis, basis) } : null;
  const pairs = layoutPattern && basis ? spacingPairs(layoutPattern, spec.reference.axis) : [];
  const useCustomGaps = spec.reference.spacingModePath
    ? optionalPath(ctx.smartComponent.referenceParameters, spec.reference.spacingModePath, "equal") === "custom"
    : false;
  const existingValues = spec.reference.customParameter
    ? optionalPath(ctx.smartComponent.referenceParameters, spec.reference.customParameter, [])
    : [];
  const pairValues = pairs.map((pair) => distance(positionPoint(basis, pair[0]), positionPoint(basis, pair[1])));
  const editValues = pairValues.map((fallback, index) => {
    const value = Array.isArray(existingValues) ? existingValues[index] : null;
    return useCustomGaps && finite(value) ? value : fallback;
  });
  const modeSeed = spec.reference.customParameter && pairValues.length
    ? { when: "custom", path: spec.reference.customParameter, value: pairValues }
    : null;
  const modeSeedsForPair = (index) => {
    const seeds = [];
    if (modeSeed) seeds.push(modeSeed);
    if (spec.parameter && finite(pairValues[index])) {
      seeds.push({ when: "equal", path: spec.parameter, value: pairValues[index] });
    }
    return seeds.length ? seeds : null;
  };
  const pairDimensions = () => {
    return pairs.map((pair, index) => spacingDimension(ctx, {
      spec: {
        ...spec,
        id: `${spec.id}-${index + 1}`,
        parameter: useCustomGaps ? spec.reference.customParameter : spec.parameter,
        label: spec.reference.pairLabel || spec.label,
        reference: {
          ...spec.reference
        }
      },
      a: positionPoint(basis, pair[0]),
      b: positionPoint(basis, pair[1]),
      offset: dimensionOffset(ctx, basis, spec.reference.pairOffset || spec.reference.offset),
      measured: pairValues[index],
      editKind: useCustomGaps ? "numberListItem" : null,
      editPath: useCustomGaps ? spec.reference.customParameter : null,
      editIndex: useCustomGaps ? index : null,
      editValues: useCustomGaps ? editValues : null,
      modeSeed,
      modeSeeds: modeSeedsForPair(index)
    }));
  };
  const pair = layoutPattern && basis ? holePair(layoutPattern, spec.reference.axis) : null;
  if (!pair) return null;
  if (spec.reference.showPairSwitchers === true && spec.reference.customParameter && pairs.length) return combine(pairDimensions());
  const equalDimension = spacingDimension(ctx, {
    spec,
    a: positionPoint(basis, pair[0]),
    b: positionPoint(basis, pair[1]),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: distance(positionPoint(basis, pair[0]), positionPoint(basis, pair[1])),
    modeSeed
  });
  if (!pattern || !basis || !spec.reference.customParameter || !pairs.length) return equalDimension;
  if (useCustomGaps) return combine(pairDimensions());
  return equalDimension;
}
