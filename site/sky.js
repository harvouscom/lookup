// The header's night sky: faint seeded stars that turn with the globe, plus
// the odd shooting star travelling the way the globe is spinning. Stays still for reduced motion.

export function createSky(canvas, { view, horizon }) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Positions are sky longitude (0-360) and height (0 = top, 1 = the horizon line).
  const stars = Array.from({ length: 120 }, () => ({
    lng: rnd() * 360, y: Math.pow(rnd(), 1.15), r: rnd() < 0.07 ? 1.5 : rnd() < 0.35 ? 1 : 0.65,
    a: 0.12 + rnd() * 0.4, tw: rnd() * Math.PI * 2,
  }));
  let W = 0, H = 0, dpr = 1, skyH = 0, running = false, last = 0, prevLng = null, spin = -1, nextShot = 0;
  const shots = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    skyH = Math.min(H, horizon() + 40);
    draw(performance.now());
  }

  // About 110 degrees of sky across the header; it turns at half the globe's rate.
  const scale = () => W / 110;
  const xOf = (lng, v) => {
    let d = ((lng + v.lng * 0.5) % 360 + 540) % 360 - 180;
    return W / 2 + d * scale();
  };
  const yOf = (y, v) => y * skyH + (v.lat + 16) * 0.6;

  function draw(t) {
    const v = view();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const x = xOf(s.lng, v);
      if (x < -4 || x > W + 4) continue;
      const y = yOf(s.y, v);
      const fade = Math.min(1, Math.max(0, (skyH - y) / 80));
      const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(t / 900 + s.tw);
      ctx.fillStyle = `rgba(226,220,255,${s.a * tw * fade})`;
      ctx.fillRect(Math.round(x), Math.round(y), s.r, s.r);
    }
    for (const s of shots) {
      const k = (t - s.t0) / s.life;
      const hx = s.x + s.vx * k, hy = s.y + s.vy * k;
      const tx = hx - s.vx * 0.22, ty = hy - s.vy * 0.22;
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      const a = Math.sin(Math.PI * Math.min(1, k));
      g.addColorStop(0, "rgba(196,181,253,0)");
      g.addColorStop(1, `rgba(255,255,255,${0.9 * a})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    }
  }

  function frame(t) {
    if (!running) return;
    const v = view();
    if (prevLng != null && Math.abs(v.lng - prevLng) > 0.001) spin = Math.sign(v.lng - prevLng);
    prevLng = v.lng;
    if (t > nextShot) {
      // Shooting stars cross the upper sky, heading the way the globe turns.
      const dir = spin > 0 ? 1 : -1;
      shots.push({ t0: t, life: 900 + rnd() * 500, x: W * (0.15 + rnd() * 0.7), y: skyH * (0.05 + rnd() * 0.35),
        vx: dir * (260 + rnd() * 180), vy: 90 + rnd() * 70 });
      nextShot = t + 3500 + rnd() * 5500;
    }
    for (let i = shots.length - 1; i >= 0; i--) if (t - shots[i].t0 > shots[i].life) shots.splice(i, 1);
    if (t - last > 30) { draw(t); last = t; }
    requestAnimationFrame(frame);
  }

  function setRunning(on) {
    if (reduce || on === running) return;
    running = on;
    if (on) { nextShot = performance.now() + 1500; requestAnimationFrame(frame); }
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  return { setRunning, redraw: () => draw(performance.now()) };
}
