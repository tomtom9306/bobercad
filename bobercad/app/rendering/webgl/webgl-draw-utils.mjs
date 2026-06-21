export function createWebglDrawRuntime({ gl, canvas, initRenderer, initMemberInstanceRenderer }) {
  function clipFromScreen(x, y, depth = -1) {
    return [
      x / canvas.width * 2 - 1,
      1 - y / canvas.height * 2,
      depth
    ];
  }

  function pushVertex(positionData, colorData, point, rgba) {
    positionData.push(point[0], point[1], point[2]);
    colorData.push(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255);
  }

  function pushScreenLine(positionData, colorData, a, b, rgba, depth = -1) {
    pushVertex(positionData, colorData, clipFromScreen(a.x, a.y, depth), rgba);
    pushVertex(positionData, colorData, clipFromScreen(b.x, b.y, depth), rgba);
  }

  function pushScreenSquare(positionData, colorData, center, radius, rgba) {
    const left = center.x - radius;
    const right = center.x + radius;
    const top = center.y - radius;
    const bottom = center.y + radius;
    pushScreenLine(positionData, colorData, { x: left, y: center.y }, { x: right, y: center.y }, rgba);
    pushScreenLine(positionData, colorData, { x: center.x, y: top }, { x: center.x, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: left, y: top }, { x: right, y: top }, rgba);
    pushScreenLine(positionData, colorData, { x: right, y: top }, { x: right, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: right, y: bottom }, { x: left, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: left, y: bottom }, { x: left, y: top }, rgba);
  }

  function pushScreenDiamond(positionData, colorData, center, radius, rgba) {
    const top = { x: center.x, y: center.y - radius };
    const right = { x: center.x + radius, y: center.y };
    const bottom = { x: center.x, y: center.y + radius };
    const left = { x: center.x - radius, y: center.y };
    pushScreenLine(positionData, colorData, top, right, rgba);
    pushScreenLine(positionData, colorData, right, bottom, rgba);
    pushScreenLine(positionData, colorData, bottom, left, rgba);
    pushScreenLine(positionData, colorData, left, top, rgba);
  }

  function pushScreenCircle(positionData, colorData, center, radius, rgba) {
    const segments = 14;
    let previous = null;
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      const point = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      };
      if (previous) pushScreenLine(positionData, colorData, previous, point, rgba);
      previous = point;
    }
  }

  function uploadDynamicAttribute(buffer, location, size, data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  function resetInstancedAttribs(...locations) {
    const memberState = initMemberInstanceRenderer();
    if (!memberState?.instancing) return;
    for (const location of locations) {
      if (location >= 0) memberState.instancing.vertexAttribDivisorANGLE(location, 0);
    }
  }

  function drawArrays(mode, positionData, colorData) {
    if (!positionData.length) return;
    const state = initRenderer();
    gl.useProgram(state.program);
    resetInstancedAttribs(state.position, state.color);
    uploadDynamicAttribute(state.positionBuffer, state.position, 3, positionData);
    uploadDynamicAttribute(state.colorBuffer, state.color, 4, colorData);
    gl.drawArrays(mode, 0, positionData.length / 3);
  }

  function uploadBuffer(data, usage = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), usage);
    return buffer;
  }

  function deleteRenderGroup(group) {
    if (!group) return;
    if (group.positionBuffer) gl.deleteBuffer(group.positionBuffer);
    if (group.colorBuffer) gl.deleteBuffer(group.colorBuffer);
    if (group.pickColorBuffer) gl.deleteBuffer(group.pickColorBuffer);
  }

  return {
    drawArrays,
    uploadBuffer,
    uploadDynamicAttribute,
    resetInstancedAttribs,
    deleteRenderGroup,
    pushVertex,
    pushScreenLine,
    pushScreenSquare,
    pushScreenDiamond,
    pushScreenCircle
  };
}
