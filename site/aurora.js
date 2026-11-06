// A soft aurora behind the header: two drifting curtains of violet light with fine grain, drawn by a
// small WebGL shader at half resolution. It drifts with the globe's turn, pauses off-screen, and
// renders one still frame for reduced motion. Without WebGL the header's own gradient shows.

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform float shift;
uniform float floorY;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  uv.y = 1.0 - uv.y;
  float x = uv.x * res.x / res.y + shift;
  // Curtains: a bright lower edge that fades upward, wavering along x, patchy in brightness, with
  // fine vertical rays for texture.
  float rays = 0.35 + 1.3 * pow(fbm(vec2(x * 9.0, t * 0.05)), 1.4);
  float c1 = 0.30 + 0.10 * sin(x * 0.9 + t * 0.06) + 0.05 * sin(x * 2.3 - t * 0.04) + 0.08 * (fbm(vec2(x * 0.8, t * 0.03)) - 0.5);
  float c2 = 0.16 + 0.07 * sin(x * 1.3 - t * 0.05 + 1.7) + 0.06 * (fbm(vec2(x * 1.1 + 5.0, t * 0.035)) - 0.5);
  float d1 = uv.y - c1, d2 = uv.y - c2;
  float b1 = (d1 < 0.0 ? exp(d1 / 0.13) : exp(-d1 * d1 / 0.0007)) * (0.25 + 1.0 * fbm(vec2(x * 0.7 + 3.0, t * 0.025)));
  float b2 = (d2 < 0.0 ? exp(d2 / 0.09) : exp(-d2 * d2 / 0.0005)) * (0.15 + 0.9 * fbm(vec2(x * 0.6 + 9.0, t * 0.02)));
  vec3 col = vec3(0.40, 0.30, 0.98) * b1 * rays + vec3(0.72, 0.42, 0.96) * b2 * 0.6 * rays + vec3(0.20, 0.55, 0.85) * b1 * 0.22 * rays;
  // Fade out before the globe so the planet keeps the stage.
  col *= smoothstep(floorY, floorY * 0.35, uv.y) * 0.5;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.018;
  col = max(col, 0.0);
  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
}`;

export function createAurora(canvas, { view, horizon }) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) { canvas.hidden = true; return { setRunning() {} }; }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.hidden = true; return { setRunning() {} }; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = { res: gl.getUniformLocation(prog, "res"), t: gl.getUniformLocation(prog, "t"), shift: gl.getUniformLocation(prog, "shift"), floorY: gl.getUniformLocation(prog, "floorY") };

  let running = false, last = 0, floorY = 0.7;
  const t0 = performance.now();
  function resize() {
    const r = canvas.getBoundingClientRect();
    // Half resolution: the glow is soft, so it costs a quarter of the pixels.
    canvas.width = Math.max(1, Math.round(r.width * 0.5));
    canvas.height = Math.max(1, Math.round(r.height * 0.5));
    floorY = Math.min(1, (horizon() + 60) / Math.max(1, r.height));
    draw(performance.now());
  }
  function draw(now) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.t, reduce ? 12 : (now - t0) / 1000);
    gl.uniform1f(u.shift, view().lng * 0.006);
    gl.uniform1f(u.floorY, floorY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function frame(now) {
    if (!running) return;
    if (now - last > 33) { draw(now); last = now; }
    requestAnimationFrame(frame);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  return {
    setRunning(on) {
      if (reduce || on === running) return;
      running = on;
      if (on) requestAnimationFrame(frame);
    },
  };
}
