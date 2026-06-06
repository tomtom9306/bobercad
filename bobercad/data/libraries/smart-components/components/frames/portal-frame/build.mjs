export function build(ctx) {
  const span = ctx.param("geometry.span");
  const eavesHeight = ctx.param("geometry.eavesHeight");
  const apexRise = ctx.param("geometry.apexRise");
  const columnProfile = ctx.param("members.columnProfile");
  const rafterProfile = ctx.param("members.rafterProfile");
  const origin = ctx.input("placement.origin", [0, 0, 0]);
  const leftX = -span / 2;
  const rightX = span / 2;
  const point = (x, y, z) => [origin[0] + x, origin[1] + y, origin[2] + z];
  const apex = point(0, 0, eavesHeight + apexRise);

  const leftColumn = ctx.member.column("leftColumn", {
    start: point(leftX, 0, 0),
    end: point(leftX, 0, eavesHeight),
    profile: columnProfile,
    memberType: "portal-column",
    source: "smart-component",
    bim: { name: "Left portal column" }
  });
  const rightColumn = ctx.member.column("rightColumn", {
    start: point(rightX, 0, 0),
    end: point(rightX, 0, eavesHeight),
    profile: columnProfile,
    memberType: "portal-column",
    source: "smart-component",
    bim: { name: "Right portal column" }
  });
  const leftRafter = ctx.member.beam("leftRafter", {
    start: point(leftX, 0, eavesHeight),
    end: apex,
    profile: rafterProfile,
    memberType: "portal-rafter",
    source: "smart-component",
    bim: { name: "Left portal rafter" }
  });
  const rightRafter = ctx.member.beam("rightRafter", {
    start: point(rightX, 0, eavesHeight),
    end: apex,
    profile: rafterProfile,
    memberType: "portal-rafter",
    source: "smart-component",
    bim: { name: "Right portal rafter" }
  });

  ctx.assembly.create("frameAssembly", {
    type: "portal-frame-assembly",
    name: "Portal frame",
    memberIds: [leftColumn.id, rightColumn.id, leftRafter.id, rightRafter.id]
  });
}
