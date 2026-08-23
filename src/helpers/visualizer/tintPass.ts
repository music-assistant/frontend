/**
 * WebGL artwork-tint pass for the visualizer.
 *
 * On TV compositors the CSS `mix-blend-mode: color` layer costs more than the
 * visualizer itself, so constrained displays apply the same color-blend math
 * in a single WebGL pass instead: butterchurn renders into a detached canvas
 * and the visible canvas shows the tinted copy.
 */

// mirrors the CSS tint layer's background-color transition duration
const TINT_TRANSITION_MS = 1500;

// the CSS Compositing spec's "color" blend: keep the preset's luminance,
// take hue/saturation from the tint
const TINT_VERTEX_SHADER = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const TINT_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_src;
uniform vec3 u_tint;
uniform float u_amount;
in vec2 v_uv;
out vec4 outColor;
float lum(vec3 c) { return dot(c, vec3(0.30, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0 && l > n) c = l + ((c - l) * l) / (l - n);
  if (x > 1.0 && x > l) c = l + ((c - l) * (1.0 - l)) / (x - l);
  return c;
}
void main() {
  vec3 src = texture(u_src, v_uv).rgb;
  vec3 blended = clipColor(u_tint + (lum(src) - lum(u_tint)));
  outColor = vec4(mix(src, blended, u_amount), 1.0);
}`;

export interface TintPass {
  draw(src: HTMLCanvasElement, nowMs: number): void;
  setTint(rgb: readonly [number, number, number] | null): void;
  destroy(): void;
}

// transition start marker: stamped from the next draw's clock, so setTint
// needs no timestamp of its own
const START_PENDING = -1;

/**
 * Build the tint pass on the visible canvas.
 *
 * Returns null when the pass cannot be built; butterchurn then draws to the
 * visible canvas as usual and the hosting layer falls back to its CSS tint.
 */
export function createTintPass(canvas: HTMLCanvasElement): TintPass | null {
  const gl = canvas.getContext("webgl2");
  if (!gl) return null;
  const build = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = build(gl.VERTEX_SHADER, TINT_VERTEX_SHADER);
  const fragment = build(gl.FRAGMENT_SHADER, TINT_FRAGMENT_SHADER);
  const program = gl.createProgram();
  let linked = false;
  if (vertex && fragment && program) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    linked = !!gl.getProgramParameter(program, gl.LINK_STATUS);
  }
  if (!vertex || !fragment || !program || !linked) {
    // a failed build must not strand objects on the canvas's long-lived context
    if (program) gl.deleteProgram(program);
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const tintLocation = gl.getUniformLocation(program, "u_tint");
  const amountLocation = gl.getUniformLocation(program, "u_amount");

  // Color and strength run a timed transition to their targets, standing in
  // for the CSS layer's 1.5s eased background-color transition (smoothstep
  // approximates the `ease` timing function).
  let color: [number, number, number] = [0, 0, 0];
  let amount = 0;
  let fromColor: [number, number, number] = [0, 0, 0];
  let fromAmount = 0;
  let targetColor: [number, number, number] = [0, 0, 0];
  let targetAmount = 0;
  // null = settled on the targets
  let transitionStartAt: number | null = null;
  let started = false;

  return {
    draw(src, nowMs) {
      if (transitionStartAt === START_PENDING) transitionStartAt = nowMs;
      if (transitionStartAt !== null) {
        const t = Math.min((nowMs - transitionStartAt) / TINT_TRANSITION_MS, 1);
        const eased = t * t * (3 - 2 * t);
        for (let i = 0; i < 3; i++) {
          color[i] = fromColor[i] + (targetColor[i] - fromColor[i]) * eased;
        }
        amount = fromAmount + (targetAmount - fromAmount) * eased;
        if (t >= 1) transitionStartAt = null;
      }
      if (canvas.width !== src.width || canvas.height !== src.height) {
        canvas.width = src.width;
        canvas.height = src.height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform3f(tintLocation, color[0], color[1], color[2]);
      gl.uniform1f(amountLocation, amount);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    setTint(rgb) {
      // an interrupted transition continues from wherever it stands
      fromColor = [...color];
      fromAmount = amount;
      if (rgb) {
        targetColor = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
        // first color jumps straight in; only the strength fades, as the
        // CSS v-if does
        if (!started) {
          started = true;
          color = [...targetColor];
          fromColor = [...targetColor];
        }
        targetAmount = 1;
      } else {
        targetAmount = 0;
      }
      transitionStartAt = START_PENDING;
    },
    destroy() {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
