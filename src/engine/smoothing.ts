import type { Pixels } from './filter';

// Original corner-aware filter inspired by emulator pixel-art interpolation.
// It is not a port of xBR: opposing-neighbor checks preserve lines and isolated dots.
const fragment = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform float strength;
out vec4 outputColor;
vec4 pixel(ivec2 p) {
  vec4 c = texelFetch(image, clamp(p, ivec2(0), textureSize(image, 0) - 1), 0);
  return vec4(c.rgb * c.a, c.a);
}
float difference(vec4 a, vec4 b) { return dot(abs(a - b), vec4(.299, .587, .114, 1.)); }
void corner(vec4 e, vec4 a, vec4 b, vec4 oppositeA, vec4 oppositeB, inout vec4 sum, inout float total) {
  float da = difference(e, a), db = difference(e, b), pair = difference(a, b);
  float limit = .15 * (da + db);
  if (da > .06 && db > .06 && pair < limit && difference(a, oppositeB) > .06 && difference(b, oppositeA) > .06) {
    float weight = .25 * (1. - pair / limit);
    sum += .5 * (a + b) * weight;
    total += weight;
  }
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 e = pixel(p), n = pixel(p + ivec2(0,-1)), s = pixel(p + ivec2(0,1));
  vec4 w = pixel(p + ivec2(-1,0)), east = pixel(p + ivec2(1,0));
  vec4 sum = vec4(0.); float total = 0.;
  corner(e,n,w,s,east,sum,total); corner(e,n,east,s,w,sum,total);
  corner(e,s,w,n,east,sum,total); corner(e,s,east,n,w,sum,total);
  vec4 color = e * (1. - total * strength) + sum * strength;
  outputColor = vec4(color.a > 0. ? color.rgb / color.a : vec3(0.), color.a);
}`;
const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;
interface Renderer { canvas: OffscreenCanvas; gl: WebGL2RenderingContext; program: WebGLProgram; texture: WebGLTexture; vao: WebGLVertexArrayObject }
let renderer: Renderer | null | undefined;
function createRenderer(): Renderer | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(1, 1), gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!; gl!.shaderSource(shader, source); gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) { gl!.deleteShader(shader); throw new Error('Shader compilation failed'); }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment), program = gl.createProgram()!;
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  const texture = gl.createTexture()!, vao = gl.createVertexArray()!;
  return { canvas, gl, program, texture, vao };
}

/** Returns null if GPU smoothing cannot run; the caller then uses the equivalent CPU filter. */
export function smoothPixelsGpu(source: Pixels, intensity: number): Pixels | null {
  try {
    if (renderer === undefined) renderer = createRenderer();
    if (!renderer) return null;
    const { gl, canvas, program, texture, vao } = renderer;
    if (gl.isContextLost() || Math.max(source.width, source.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
    if (canvas.width !== source.width) canvas.width = source.width;
    if (canvas.height !== source.height) canvas.height = source.height;
    gl.viewport(0, 0, source.width, source.height); gl.disable(gl.DITHER); gl.disable(gl.BLEND);
    gl.useProgram(program); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
    gl.uniform1f(gl.getUniformLocation(program, 'strength'), Math.max(0, Math.min(100, intensity)) / 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const data = new Uint8ClampedArray(source.data.length);
    gl.readPixels(0, 0, source.width, source.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) return null;
    return { width: source.width, height: source.height, data };
  } catch { renderer = null; return null; }
}

export function smoothPixelsCpu(source: Pixels, intensity: number): Pixels {
  const strength = Math.max(0, Math.min(100, intensity)) / 100;
  if (!strength) return source;
  const { width, height, data } = source, input = new Float32Array(data.length), output = new Uint8ClampedArray(data.length), neighbors = new Int32Array(4);
  for (let i = 0; i < data.length; i += 4) { const alpha = data[i + 3] / 255; for (let c = 0; c < 3; c++) input[i + c] = data[i + c] / 255 * alpha; input[i + 3] = alpha; }
  const difference = (a: number, b: number) => .299 * Math.abs(input[a] - input[b]) + .587 * Math.abs(input[a + 1] - input[b + 1]) + .114 * Math.abs(input[a + 2] - input[b + 2]) + Math.abs(input[a + 3] - input[b + 3]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    neighbors[0] = (Math.max(0, y - 1) * width + x) * 4; neighbors[2] = (Math.min(height - 1, y + 1) * width + x) * 4;
    neighbors[1] = (y * width + Math.max(0, x - 1)) * 4; neighbors[3] = (y * width + Math.min(width - 1, x + 1)) * 4;
    let r = 0, g = 0, b = 0, alpha = 0, total = 0;
    for (let corner = 0; corner < 4; corner++) {
      const a = neighbors[corner < 2 ? 0 : 2], next = neighbors[corner % 2 ? 3 : 1];
      const oppositeA = neighbors[corner < 2 ? 2 : 0], oppositeB = neighbors[corner % 2 ? 1 : 3];
      const da = difference(at, a), db = difference(at, next), pair = difference(a, next), limit = .15 * (da + db);
      if (da > .06 && db > .06 && pair < limit && difference(a, oppositeB) > .06 && difference(next, oppositeA) > .06) {
        const weight = .25 * (1 - pair / limit); total += weight;
        r += .5 * (input[a] + input[next]) * weight; g += .5 * (input[a + 1] + input[next + 1]) * weight;
        b += .5 * (input[a + 2] + input[next + 2]) * weight; alpha += .5 * (input[a + 3] + input[next + 3]) * weight;
      }
    }
    const keep = 1 - total * strength, finalAlpha = input[at + 3] * keep + alpha * strength;
    output[at + 3] = finalAlpha * 255;
    if (finalAlpha) { output[at] = (input[at] * keep + r * strength) / finalAlpha * 255; output[at + 1] = (input[at + 1] * keep + g * strength) / finalAlpha * 255; output[at + 2] = (input[at + 2] * keep + b * strength) / finalAlpha * 255; }
  }
  return { width, height, data: output };
}

export function smoothPixels(source: Pixels, intensity: number): Pixels {
  if (intensity <= 0) return source;
  return smoothPixelsGpu(source, intensity) ?? smoothPixelsCpu(source, intensity);
}
