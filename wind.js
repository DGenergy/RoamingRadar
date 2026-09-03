/* Particle wind layer — a canvas over the map, particles advected through an
   interpolated 10 m wind grid, trails fading each frame (the marine-app look).
   Field: { w, s, e, n, nx, ny, hours: [{ u: Float32Array, v: Float32Array, spd: Float32Array, gust: Float32Array }] }
   u/v in knots (east/north), spd in knots. Grid row j runs south→north, column i west→east. */
const WindLayer = (() => {
  let map, canvas, ctx, field = null, hour = 0, particles = [], running = false, paused = false, raf = 0, moving = false, dpr = 1, W = 0, H = 0;
  let lastFrame = 0;
  const RAMP = [[0, '#7FA7C4'], [5, '#6FBFD8'], [10, '#5FD68A'], [15, '#C9DE7A'], [20, '#F0C95A'], [25, '#F0A35A'], [30, '#E8774F'], [40, '#E0554D'], [50, '#C41E9F']];
  function color(kt) { let c = RAMP[0][1]; for (const [t, col] of RAMP) if (kt >= t) c = col; return c; }

  function resize() {
    const r = map.getContainer().getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
    canvas.width = W; canvas.height = H; canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
    ctx.clearRect(0, 0, W, H);
    if (field) seed();
  }
  function count() { return Math.max(1200, Math.min(4000, Math.round((W * H) / (dpr * dpr) / 380))); }
  function bounds() { const b = map.getBounds(); return { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() }; }
  function spawn(p, b) { p.lng = b.w + Math.random() * (b.e - b.w); p.lat = b.s + Math.random() * (b.n - b.s); p.age = 0; p.life = 50 + Math.random() * 90; p.sx = NaN; p.sy = NaN; return p; }
  function seed() { const b = bounds(); const n = count(); particles = []; for (let i = 0; i < n; i++) { const p = spawn({}, b); p.age = Math.random() * p.life; particles.push(p); } }

  // bilinear sample of the selected hour at lng/lat -> [u, v, spd] in knots, or null outside the field
  function sample(lng, lat) {
    const f = field; if (!f || !f.hours[hour]) return null;
    const fx = (lng - f.w) / (f.e - f.w) * (f.nx - 1), fy = (lat - f.s) / (f.n - f.s) * (f.ny - 1);
    if (fx < 0 || fy < 0 || fx > f.nx - 1 || fy > f.ny - 1) return null;
    const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(i0 + 1, f.nx - 1), j1 = Math.min(j0 + 1, f.ny - 1);
    const tx = fx - i0, ty = fy - j0; const h = f.hours[hour];
    const k00 = j0 * f.nx + i0, k10 = j0 * f.nx + i1, k01 = j1 * f.nx + i0, k11 = j1 * f.nx + i1;
    const lerp = (a, b, t) => a + (b - a) * t;
    const u = lerp(lerp(h.u[k00], h.u[k10], tx), lerp(h.u[k01], h.u[k11], tx), ty);
    const v = lerp(lerp(h.v[k00], h.v[k10], tx), lerp(h.v[k01], h.v[k11], tx), ty);
    return [u, v, Math.hypot(u, v)];
  }

  function frame(t) {
    raf = 0; if (!running) return;
    if (paused || !field) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(50, t - lastFrame || 16); lastFrame = t;
    const b = bounds();
    // degrees per screen pixel at this view, so particle speed on screen is independent of zoom (px/frame ∝ knots)
    const degPerPxX = (b.e - b.w) / (W / dpr), degPerPxY = (b.n - b.s) / (H / dpr);
    const pxPerKt = 0.05 * (dt / 16);            // 20 kt ≈ 1 px per frame at 60 fps
    if (moving) { ctx.clearRect(0, 0, W, H); }
    else { ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = 'rgba(0,0,0,0.87)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    ctx.lineCap = 'round';
    const byColor = new Map();
    for (const p of particles) {
      const s = sample(p.lng, p.lat);
      if (!s || p.age++ > p.life) { spawn(p, b); continue; }
      const nlng = p.lng + s[0] * pxPerKt * degPerPxX, nlat = p.lat + s[1] * pxPerKt * degPerPxY;
      const a = map.project([p.lng, p.lat]), c = map.project([nlng, nlat]);
      p.lng = nlng; p.lat = nlat;
      if (a.x < -20 || a.y < -20 || a.x > W / dpr + 20 || a.y > H / dpr + 20) { spawn(p, b); continue; }
      const col = color(s[2]); let list = byColor.get(col); if (!list) { list = []; byColor.set(col, list); }
      list.push(a.x * dpr, a.y * dpr, c.x * dpr, c.y * dpr, s[2]);
    }
    for (const [col, list] of byColor) {
      ctx.strokeStyle = col; ctx.beginPath();
      for (let i = 0; i < list.length; i += 5) { ctx.moveTo(list[i], list[i + 1]); ctx.lineTo(list[i + 2], list[i + 3]); }
      ctx.lineWidth = (1.0 + Math.min(list[4] || 0, 40) / 32) * dpr; ctx.globalAlpha = 0.8; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  return {
    init(m, cv) {
      map = m; canvas = cv; ctx = cv.getContext('2d');
      resize(); window.addEventListener('resize', resize); map.on('resize', resize);
      map.on('movestart', () => { moving = true; }); map.on('moveend', () => { moving = false; if (field) seed(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else if (field && this.wanted) this.start(); });
    },
    wanted: false,
    setField(f) { field = f; if (f) seed(); else ctx.clearRect(0, 0, W, H); },
    setHour(h) { hour = Math.max(0, Math.min((field ? field.hours.length : 1) - 1, h)); },
    start() { this.wanted = true; if (running) return; running = true; lastFrame = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    off() { this.wanted = false; this.stop(); field = null; ctx.clearRect(0, 0, W, H); },
    pause(p) { paused = p; },
    sampleAt(lng, lat) { return sample(lng, lat); },
    color, RAMP
  };
})();
