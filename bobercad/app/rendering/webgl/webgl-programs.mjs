const COLOR_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 vColor;
  void main() {
    gl_FragColor = vColor;
  }
`;

const VIEW_VERTEX_SHADER = `
  uniform float uYaw;
  uniform float uPitch;
  uniform float uScale;
  uniform vec2 uPan;
  uniform vec2 uViewport;
  uniform vec3 uPivot;
  uniform float uDepthHalf;

  vec3 cameraRotate(vec3 point) {
    float cy = cos(uYaw);
    float sy = sin(uYaw);
    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float x = cy * point.x - sy * point.y;
    float y = sy * point.x + cy * point.y;
    return vec3(x, cp * y - sp * point.z, sp * y + cp * point.z);
  }

  vec4 clipPosition(vec3 view) {
    float screenX = uViewport.x * 0.5 + uPan.x + view.x * uScale;
    float screenY = uViewport.y * 0.5 + uPan.y - view.y * uScale;
    float depth = clamp(-view.z / uDepthHalf, -1.0, 1.0);
    return vec4(screenX / uViewport.x * 2.0 - 1.0, 1.0 - screenY / uViewport.y * 2.0, depth, 1.0);
  }
`;

export function createWebglProgramRegistry(gl) {
  let renderer = null;
  let staticSceneRenderer = null;
  let memberInstanceRenderer = null;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function viewUniformLocations(program) {
    return {
      yaw: gl.getUniformLocation(program, "uYaw"),
      pitch: gl.getUniformLocation(program, "uPitch"),
      scale: gl.getUniformLocation(program, "uScale"),
      pan: gl.getUniformLocation(program, "uPan"),
      viewport: gl.getUniformLocation(program, "uViewport"),
      pivot: gl.getUniformLocation(program, "uPivot"),
      depthHalf: gl.getUniformLocation(program, "uDepthHalf")
    };
  }

  function initRenderer() {
    if (renderer) return renderer;
    if (!gl) throw new Error("WebGL is required for depth-correct viewing");
    const program = createProgram(`
      attribute vec3 aPosition;
      attribute vec4 aColor;
      varying vec4 vColor;
      void main() {
        gl_Position = vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `, COLOR_FRAGMENT_SHADER);
    renderer = {
      program,
      position: gl.getAttribLocation(program, "aPosition"),
      color: gl.getAttribLocation(program, "aColor"),
      positionBuffer: gl.createBuffer(),
      colorBuffer: gl.createBuffer()
    };
    return renderer;
  }

  function initStaticSceneRenderer() {
    if (staticSceneRenderer) return staticSceneRenderer;
    if (!gl) throw new Error("WebGL is required for scene rendering");
    const program = createProgram(`
      precision highp float;
      attribute vec3 aWorldPosition;
      attribute vec4 aColor;
      varying vec4 vColor;
      ${VIEW_VERTEX_SHADER}

      void main() {
        vec3 view = cameraRotate(aWorldPosition - uPivot);
        gl_Position = clipPosition(view);
        vColor = aColor;
      }
    `, COLOR_FRAGMENT_SHADER);
    staticSceneRenderer = {
      program,
      position: gl.getAttribLocation(program, "aWorldPosition"),
      color: gl.getAttribLocation(program, "aColor"),
      uniforms: viewUniformLocations(program)
    };
    return staticSceneRenderer;
  }

  function initMemberInstanceRenderer() {
    if (memberInstanceRenderer) return memberInstanceRenderer;
    if (!gl) throw new Error("WebGL is required for member instancing");
    const instancing = gl.getExtension("ANGLE_instanced_arrays");
    if (!instancing) return null;
    const program = createProgram(`
      precision highp float;
      attribute vec3 aLocalPosition;
      attribute vec3 aLocalNormal;
      attribute vec3 aStart;
      attribute vec3 aAxisX;
      attribute vec3 aAxisY;
      attribute vec3 aAxisZ;
      attribute float aLength;
      attribute vec4 aColor;
      uniform vec3 uLight;
      uniform float uAmbient;
      uniform float uDiffuse;
      varying vec4 vColor;
      ${VIEW_VERTEX_SHADER}

      void main() {
        vec3 world = aStart
          + aAxisX * (aLocalPosition.x * aLength)
          + aAxisY * aLocalPosition.y
          + aAxisZ * aLocalPosition.z;
        vec3 view = cameraRotate(world - uPivot);
        vec3 normal = normalize(aAxisX * aLocalNormal.x + aLocalNormal.y + aAxisZ * aLocalNormal.z);
        float shade = uAmbient + max(0.0, dot(normal, normalize(uLight))) * uDiffuse;
        gl_Position = clipPosition(view);
        vColor = vec4(aColor.rgb * shade, aColor.a);
      }
    `, COLOR_FRAGMENT_SHADER);
    memberInstanceRenderer = {
      program,
      instancing,
      localPosition: gl.getAttribLocation(program, "aLocalPosition"),
      localNormal: gl.getAttribLocation(program, "aLocalNormal"),
      start: gl.getAttribLocation(program, "aStart"),
      axisX: gl.getAttribLocation(program, "aAxisX"),
      axisY: gl.getAttribLocation(program, "aAxisY"),
      axisZ: gl.getAttribLocation(program, "aAxisZ"),
      length: gl.getAttribLocation(program, "aLength"),
      color: gl.getAttribLocation(program, "aColor"),
      uniforms: {
        ...viewUniformLocations(program),
        light: gl.getUniformLocation(program, "uLight"),
        ambient: gl.getUniformLocation(program, "uAmbient"),
        diffuse: gl.getUniformLocation(program, "uDiffuse")
      }
    };
    return memberInstanceRenderer;
  }

  return {
    initRenderer,
    initStaticSceneRenderer,
    initMemberInstanceRenderer
  };
}
