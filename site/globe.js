// A dotted globe where every dot is a cell of real churches from the Lookup index.
// Plain canvas, no dependencies. Orthographic projection, front hemisphere only.

const RAD = Math.PI / 180;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createGlobe(canvas, data, opts = {}) {
  const ctx = canvas.getContext("2d");
  const dark = opts.theme === "dark";
  const color = opts.color ?? (dark ? [216, 180, 254] : [107, 33, 168]);
  const pinColor = opts.pinColor ?? (dark ? "#C084FC" : "#6B21A8");
  const ring = dark ? "#1E1040" : "#fff";
  const n = data.data.length / 3;
  const lat = new Float32Array(n), lng = new Float32Array(n), w = new Float32Array(n);
  let max = 1;
  for (let i = 0; i < n; i++) max = Math.max(max, data.data[i * 3 + 2]);
  for (let i = 0; i < n; i++) {
    lat[i] = data.data[i * 3] * data.unit * RAD;
    lng[i] = data.data[i * 3 + 1] * data.unit * RAD;
    w[i] = Math.log1p(data.data[i * 3 + 2]) / Math.log1p(max);
  }

  // View center, in degrees. Starts over the Atlantic so North America and Europe both show.
  let lat0 = opts.lat ?? 28, lng0 = opts.lng ?? -38;
  let size = 0, dpr = 1;
  let pins = [];
  let selected = null;
  let anim = null;
  let dragging = null;
  let idleUntil = 0;
  let visible = true;
  let raf = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    size = horizon ? r.width : Math.min(r.width, r.height);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    draw();
  }

  function project(la, lo, sinLat0, cosLat0) {
    const d = lo - lng0 * RAD;
    const cosC = sinLat0 * Math.sin(la) + cosLat0 * Math.cos(la) * Math.cos(d);
    return [Math.cos(la) * Math.sin(d), cosLat0 * Math.sin(la) - sinLat0 * Math.cos(la) * Math.cos(d), cosC];
  }

  // "disc" fits the whole globe in the canvas. "horizon" makes it huge and shows only the top, like a planet rising.
  const horizon = opts.layout === "horizon";
  function geometry() {
    const W = canvas.width, H = canvas.height;
    if (!horizon) return { W, H, R: (size / 2 - 6) * dpr, cx: W / 2, cy: H / 2 };
    const R = Math.min(W * 0.62, 1100 * dpr);
    return { W, H, R, cx: W / 2, cy: R + 28 * dpr };
  }

  function draw(t = performance.now()) {
    const { W, H, R, cx, cy } = geometry();
    ctx.clearRect(0, 0, W, H);

    // The sphere: a soft lit disc, so the dots read as sitting on a surface.
    const g = horizon
      ? ctx.createRadialGradient(cx, cy - R * 0.92, R * 0.05, cx, cy - R * 0.4, R * 1.05)
      : ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    if (dark) {
      g.addColorStop(0, "rgba(168,85,247,0.30)");
      g.addColorStop(0.6, "rgba(107,33,168,0.16)");
      g.addColorStop(1, "rgba(30,16,64,0.0)");
    } else {
      g.addColorStop(0, "rgba(255,255,255,0.98)");
      g.addColorStop(0.55, "rgba(252,249,255,0.85)");
      g.addColorStop(1, "rgba(237,224,250,0.7)");
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = dark ? "rgba(216,180,254,0.28)" : "rgba(107,33,168,0.18)";
    ctx.stroke();

    const sinLat0 = Math.sin(lat0 * RAD), cosLat0 = Math.cos(lat0 * RAD);

    // Faint graticule, drawn as dots too.
    ctx.fillStyle = dark ? "rgba(216,180,254,0.10)" : "rgba(107,33,168,0.10)";
    ctx.beginPath();
    for (let la = -60; la <= 60; la += 30) for (let lo = -180; lo < 180; lo += 3) {
      const [x, y, c] = project(la * RAD, lo * RAD, sinLat0, cosLat0);
      if (c > 0) ctx.rect(cx + x * R - 0.5 * dpr, cy - y * R - 0.5 * dpr, dpr, dpr);
    }
    for (let lo = -180; lo < 180; lo += 30) for (let la = -80; la <= 80; la += 3) {
      const [x, y, c] = project(la * RAD, lo * RAD, sinLat0, cosLat0);
      if (c > 0) ctx.rect(cx + x * R - 0.5 * dpr, cy - y * R - 0.5 * dpr, dpr, dpr);
    }
    ctx.fill();

    // Churches, batched into opacity buckets so the fill style changes only a few times per frame.
    const BUCKETS = 6;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const scale = Math.min(1.5, (R / dpr) / 260);
    const cellPx = R * data.unit * RAD;
    for (let i = 0; i < n; i++) {
      const [x, y, c] = project(lat[i], lng[i], sinLat0, cosLat0);
      if (c <= 0.02) continue;
      const depth = 0.35 + 0.65 * c;
      const b = Math.min(BUCKETS - 1, Math.floor(w[i] * depth * BUCKETS));
      // Never larger than a third of the spacing between cells, so a big globe stipples instead of tiling.
      const r = Math.min(cellPx * 0.34 * (0.55 + 0.45 * w[i]), (0.55 + 1.7 * w[i]) * scale * dpr);
      const px = cx + x * R, py = cy - y * R;
      paths[b].moveTo(px + r, py);
      paths[b].arc(px, py, r, 0, Math.PI * 2);
    }
    for (let b = 0; b < BUCKETS; b++) {
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.3 + (b / (BUCKETS - 1)) * 0.65})`;
      ctx.fill(paths[b]);
    }

    // Result pins, then the selected church with a pulse.
    for (const p of pins) {
      const [x, y, c] = project(p.lat * RAD, p.lng * RAD, sinLat0, cosLat0);
      if (c <= 0) continue;
      dot(cx + x * R, cy - y * R, 4.5 * dpr, pinColor, 1.5 * dpr);
    }
    if (selected) {
      const [x, y, c] = project(selected.lat * RAD, selected.lng * RAD, sinLat0, cosLat0);
      if (c > 0) {
        const px = cx + x * R, py = cy - y * R;
        if (!reduceMotion()) {
          const phase = ((t - selected.at) % 1600) / 1600;
          ctx.beginPath();
          ctx.arc(px, py, (8 + phase * 22) * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = dark ? `rgba(233,213,255,${0.7 * (1 - phase)})` : `rgba(168,85,247,${0.55 * (1 - phase)})`;
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
        }
        dot(px, py, 7 * dpr, pinColor, 2.5 * dpr);
      }
    }
  }

  function dot(x, y, r, fill, ring) {
    ctx.beginPath();
    ctx.arc(x, y, r + ring, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function frame(t) {
    raf = 0;
    if (anim) {
      const k = Math.min(1, (t - anim.start) / anim.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      lat0 = anim.fromLat + (anim.toLat - anim.fromLat) * e;
      lng0 = anim.fromLng + anim.dLng * e;
      if (k >= 1) anim = null;
    } else if (!dragging && !reduceMotion() && t > idleUntil && !selected) {
      lng0 += 0.045;
    }
    draw(t);
    if (visible && (anim || selected || (!reduceMotion() && !dragging))) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = { x: e.clientX, y: e.clientY, lat0, lng0 };
    anim = null;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const k = (horizon ? 120 : 180) / size;
    lng0 = dragging.lng0 - (e.clientX - dragging.x) * k;
    lat0 = Math.max(-60, Math.min(70, dragging.lat0 + (e.clientY - dragging.y) * k));
    draw();
  });
  const end = () => { dragging = null; idleUntil = performance.now() + 2500; wake(); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) wake(); });
  resize();
  wake();

  return {
    setPins(list) {
      pins = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (!selected && pins.length && !dragging) this.flyTo(pins[0].lat, pins[0].lng, { soft: true });
      draw();
      wake();
    },
    select(p) {
      selected = p ? { ...p, at: performance.now() } : null;
      // Aim a little south of the church, so its pin sits above center and clear of the record card.
      if (p) this.flyTo(p.lat - (opts.pinOffset ?? 0), p.lng);
      wake();
    },
    flyTo(la, lo, { soft = false } = {}) {
      const toLat = Math.max(-60, Math.min(70, la));
      let dLng = ((lo - lng0 + 540) % 360) - 180;
      if (reduceMotion()) {
        lat0 = toLat; lng0 += dLng; anim = null; draw(); return;
      }
      // While typing, only drift toward results; a pick gets the full flight.
      const ms = soft ? 900 : 1400;
      anim = { start: performance.now(), ms, fromLat: lat0, toLat: soft ? lat0 + (toLat - lat0) * 0.6 : toLat, fromLng: lng0, dLng: soft ? dLng * 0.6 : dLng };
      idleUntil = performance.now() + 6000;
      wake();
    },
  };
}
