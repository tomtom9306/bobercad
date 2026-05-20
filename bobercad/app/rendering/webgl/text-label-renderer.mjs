import { v } from "../../engine/core/math.mjs";

const MAX_ATLAS_WIDTH = 2048;

function hexToRgb(hex, fallback = [51, 65, 85]) {
  if (typeof hex !== "string" || !hex.startsWith("#")) return fallback;
  const value = hex.replace("#", "");
  if (value.length !== 6) return fallback;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

function labelText(label) {
  return String(label.displayText || label.text || "");
}

function labelRotation(label, projectPoint) {
  const axis = Array.isArray(label.labelLine) && label.labelLine.length === 2
    ? v.sub(label.labelLine[1], label.labelLine[0])
    : label.labelAxis;
  if (!Array.isArray(axis)) return 0;
  const a = projectPoint(label.point);
  const b = projectPoint(v.add(label.point, axis));
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1) return 0;
  let angle = Math.atan2(dy, dx);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}

function textSettings(settings, label, scale, hovered) {
  const dimensions = settings.render.dimensions || {};
  const fontPx = (label.textHeight || dimensions.textHeight || 10) * scale;
  return {
    color: hovered ? "#2563eb" : label.color || "#334155",
    family: dimensions.fontFamily || "Arial, sans-serif",
    minSize: dimensions.minFontPx || 4,
    weight: dimensions.fontWeight || "400",
    fontPx
  };
}

function shouldDrawLabel(settings, label, screenScale, hovered) {
  if (label.active || label.editing) return false;
  const text = labelText(label);
  if (!text) return false;
  const font = textSettings(settings, label, screenScale, hovered);
  return label.issueSeverity || hovered || font.fontPx >= font.minSize;
}

function atlasKey(records) {
  return JSON.stringify(records.map((record) => [
    record.label.dimensionId,
    record.text,
    Math.round(record.fontPx * 10) / 10,
    record.weight,
    record.family,
    record.color
  ]));
}

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function createTextLabelRenderer(gl, canvas, settings) {
  const program = (() => {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const nextProgram = gl.createProgram();
    gl.attachShader(nextProgram, compile(gl.VERTEX_SHADER, `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = vec4(aPosition, 1.0);
        vTexCoord = aTexCoord;
      }
    `));
    gl.attachShader(nextProgram, compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D uTexture;
      varying vec2 vTexCoord;
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    `));
    gl.linkProgram(nextProgram);
    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(nextProgram));
    return nextProgram;
  })();

  const state = {
    position: gl.getAttribLocation(program, "aPosition"),
    texCoord: gl.getAttribLocation(program, "aTexCoord"),
    sampler: gl.getUniformLocation(program, "uTexture"),
    positionBuffer: gl.createBuffer(),
    texCoordBuffer: gl.createBuffer(),
    texture: gl.createTexture(),
    atlas: null,
    hitboxes: []
  };

  function createAtlas(records) {
    const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const measure = document.createElement("canvas").getContext("2d");
    const items = records.map((record, index) => {
      const textureFontPx = Math.max(1, record.fontPx * scale);
      const padding = Math.ceil(textureFontPx * 0.35);
      measure.font = `${record.weight} ${textureFontPx}px ${record.family}`;
      const width = Math.ceil(measure.measureText(record.text).width + padding * 2);
      const height = Math.ceil(textureFontPx * 1.35 + padding * 2);
      return { ...record, index, padding, textureFontPx, width, height };
    });

    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let atlasWidth = 1;
    for (const item of items) {
      if (x > 0 && x + item.width > MAX_ATLAS_WIDTH) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      item.x = x;
      item.y = y;
      x += item.width;
      rowHeight = Math.max(rowHeight, item.height);
      atlasWidth = Math.max(atlasWidth, x);
    }
    const atlasHeight = Math.max(1, y + rowHeight);
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = nextPowerOfTwo(atlasWidth);
    atlasCanvas.height = nextPowerOfTwo(atlasHeight);
    const ctx = atlasCanvas.getContext("2d");
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    for (const item of items) {
      ctx.font = `${item.weight} ${item.textureFontPx}px ${item.family}`;
      ctx.fillStyle = item.color;
      const textX = item.x + item.padding;
      const textY = item.y + item.height / 2;
      ctx.fillText(item.text, textX, textY);
    }

    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return {
      key: atlasKey(records),
      width: atlasCanvas.width,
      height: atlasCanvas.height,
      scale,
      items
    };
  }

  function ensureAtlas(records) {
    const key = atlasKey(records);
    if (!state.atlas || state.atlas.key !== key) state.atlas = createAtlas(records);
    return state.atlas;
  }

  function pushQuad(positions, texCoords, projected, item, angle) {
    const width = item.width / state.atlas.scale;
    const height = item.height / state.atlas.scale;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight]
    ];
    const depth = Math.max(-1, projected.depth - 0.001);
    const projectedCorners = corners.map(([x, y]) => {
      const sx = projected.x + x * cos - y * sin;
      const sy = projected.y + x * sin + y * cos;
      return {
        x: sx,
        y: sy,
        clip: [sx / canvas.width * 2 - 1, 1 - sy / canvas.height * 2, depth]
      };
    });
    const u0 = item.x / state.atlas.width;
    const v0 = item.y / state.atlas.height;
    const u1 = (item.x + item.width) / state.atlas.width;
    const v1 = (item.y + item.height) / state.atlas.height;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const index of [0, 1, 2, 0, 2, 3]) {
      positions.push(...projectedCorners[index].clip);
      texCoords.push(...uv[index]);
    }
    const xs = projectedCorners.map((corner) => corner.x);
    const ys = projectedCorners.map((corner) => corner.y);
    state.hitboxes.push({
      label: item.label,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    });
  }

  function draw({ labels, projectPoint, screenScale, isHovered, hideBehindGeometry }) {
    state.hitboxes = [];
    const scale = screenScale();
    const records = (labels || [])
      .filter((label) => shouldDrawLabel(settings, label, scale, isHovered(label)))
      .map((label) => {
        const font = textSettings(settings, label, scale, isHovered(label));
        return { label, text: labelText(label), ...font };
      });
    if (!records.length) return;
    const atlas = ensureAtlas(records);
    const positions = [];
    const texCoords = [];
    for (const item of atlas.items) {
      const projected = projectPoint(item.label.point);
      if (!projected) continue;
      if (projected.x < -160 || projected.x > canvas.width + 160 || projected.y < -120 || projected.y > canvas.height + 120) continue;
      pushQuad(positions, texCoords, projected, item, labelRotation(item.label, projectPoint));
    }
    if (!positions.length) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.position);
    gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.texCoord);
    gl.vertexAttribPointer(state.texCoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    gl.uniform1i(state.sampler, 0);

    if (hideBehindGeometry) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  function hitTest(x, y) {
    for (let index = state.hitboxes.length - 1; index >= 0; index -= 1) {
      const box = state.hitboxes[index];
      if (x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY) return box.label;
    }
    return null;
  }

  return { draw, hitTest };
}
