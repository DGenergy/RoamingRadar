/* Radar edge tracker — reads two radar tile frames into a canvas, classifies echo
   strength by colour, estimates motion by block matching, and returns the outlines
   of strong echo regions with a velocity for each. Works only when the tile server
   sends CORS headers (otherwise the canvas is tainted and getImageData throws). */
const RadarTracker = (() => {
  const TILE = 256;
  const lng2x = (lng, z) => (lng + 180) / 360 * Math.pow(2, z);
  const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
  const x2lng = (x, z) => x / Math.pow(2, z) * 360 - 180;
  const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

  function loadImg(url) {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile load failed')); im.src = url; });
  }

  async function renderFrame(tpl, z, tx0, ty0, nx, ny, ds) {
    const W = Math.round(nx * TILE / ds), H = Math.round(ny * TILE / ds), s = TILE / ds;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const jobs = []; let okTiles = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const url = tpl.replace('{z}', z).replace('{x}', tx0 + i).replace('{y}', ty0 + j);
      jobs.push(loadImg(url).then(im => { ctx.drawImage(im, i * s, j * s, s, s); okTiles++; }).catch(() => {}));
    }
    await Promise.all(jobs);
    let data;
    try { data = ctx.getImageData(0, 0, W, H).data; } catch (e) { throw new Error('tiles are not CORS-readable (canvas tainted) — edge tracking needs a proxy or a CORS-enabled tile source'); }
    return { data, W, H, okTiles, tiles: nx * ny };
  }

  // 0 none · 1 light (blue/green/cyan) · 2 moderate (yellow/orange) · 3 heavy (red/magenta/purple/white)
  function classify(data, W, H) {
    const cls = new Uint8Array(W * H);
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const a = data[i + 3]; if (a < 40) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 40) continue;
      const sat = (mx - mn) / mx;
      if (sat < 0.22) { if (mx > 210) cls[p] = 3; continue; }
      const d = mx - mn; let h;
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
      if (h >= 75 && h <= 265) cls[p] = 1;
      else if (h >= 15 && h < 75) cls[p] = 2;
      else cls[p] = 3;
    }
    return cls;
  }

  function smooth(cls, W, H) { // 3x3 majority on the strong mask (>=2) to kill speckle
    const m = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cls[(y + dy) * W + x + dx] >= 2) c++;
      if (c >= 5) m[y * W + x] = 1;
    }
    return m;
  }

  function sad(A, B, W, H, bx, by, n, dx, dy) {
    let s = 0;
    for (let y = by; y < by + n; y++) {
      const ya = y - dy; if (ya < 0 || ya >= H) { s += n * 3; continue; }
      const rowB = y * W, rowA = ya * W;
      for (let x = bx; x < bx + n; x++) { const xa = x - dx; if (xa < 0 || xa >= W) { s += 3; continue; } const d = B[rowB + x] - A[rowA + xa]; s += d < 0 ? -d : d; }
    }
    return s;
  }
  function blockMotion(A, B, W, H, block, search) {
    const vecs = [];
    for (let by = 0; by + block <= H; by += block) for (let bx = 0; bx + block <= W; bx += block) {
      let cov = 0; for (let y = by; y < by + block; y++) for (let x = bx; x < bx + block; x++) if (B[y * W + x] >= 2) cov++;
      if (cov < block * block * 0.04) continue;
      let best = Infinity, bdx = 0, bdy = 0;
      for (let dy = -search; dy <= search; dy += 2) for (let dx = -search; dx <= search; dx += 2) { const s = sad(A, B, W, H, bx, by, block, dx, dy); if (s < best) { best = s; bdx = dx; bdy = dy; } }
      const cx = bdx, cy = bdy;
      for (let dy = cy - 1; dy <= cy + 1; dy++) for (let dx = cx - 1; dx <= cx + 1; dx++) { const s = sad(A, B, W, H, bx, by, block, dx, dy); if (s < best) { best = s; bdx = dx; bdy = dy; } }
      const zero = sad(A, B, W, H, bx, by, block, 0, 0);
      vecs.push({ x: bx + block / 2, y: by + block / 2, dx: bdx, dy: bdy, cov, gain: zero > 0 ? 1 - best / zero : 0 });
    }
    return vecs;
  }
  function weightedMedian(vals, ws) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); let tot = ws.reduce((a, b) => a + b, 0), acc = 0;
    for (const i of idx) { acc += ws[i]; if (acc >= tot / 2) return vals[i]; } return vals[idx[idx.length - 1]] || 0;
  }

  // marching squares on a binary grid -> closed rings in pixel coords
  function contours(mask, W, H) {
    const segs = []; const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : mask[y * W + x];
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl; if (c === 0 || c === 15) continue;
      const T = [x + 1, y + 0.5], R = [x + 1.5, y + 1], B = [x + 1, y + 1.5], L = [x + 0.5, y + 1];
      const add = (a, b) => segs.push([a, b]);
      switch (c) {
        case 1: add(L, B); break; case 2: add(B, R); break; case 3: add(L, R); break; case 4: add(T, R); break;
        case 5: add(L, T); add(B, R); break; case 6: add(T, B); break; case 7: add(L, T); break; case 8: add(T, L); break;
        case 9: add(T, B); break; case 10: add(T, R); add(B, L); break; case 11: add(T, R); break; case 12: add(R, L); break;
        case 13: add(R, B); break; case 14: add(B, L); break;
      }
    }
    // link segments into rings (segments carry no consistent orientation, so index both ends)
    const key = (p) => (p[0] * 2) + ',' + (p[1] * 2);
    const at2 = new Map(); const push = (k, i) => { const l = at2.get(k); if (l) l.push(i); else at2.set(k, [i]); };
    segs.forEach((s, i) => { push(key(s[0]), i); push(key(s[1]), i); });
    const used = new Uint8Array(segs.length); const rings = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1; const ring = [segs[i][0], segs[i][1]]; let cur = segs[i][1]; const startKey = key(segs[i][0]); let guard = 0;
      while (guard++ < 400000) {
        const cands = at2.get(key(cur)); let next = -1;
        if (cands) for (const j of cands) if (!used[j]) { next = j; break; }
        if (next < 0) break; used[next] = 1;
        cur = key(segs[next][0]) === key(cur) ? segs[next][1] : segs[next][0]; ring.push(cur);
        if (key(cur) === startKey) break;
      }
      if (ring.length >= 8) rings.push(ring);
    }
    return rings;
  }
  function ringArea(r) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; }
  function simplify(r, maxPts) { const k = Math.max(1, Math.ceil(r.length / maxPts)); const out = []; for (let i = 0; i < r.length; i += k) out.push(r[i]); if (out[0] !== out[out.length - 1]) out.push(out[0]); return out; }

  /**
   * track({ tplNow, tplPrev, dtMin, bounds:{w,s,e,n}, zoom, maxPixels })
   * -> { rings:[{coords:[[lng,lat]...], areaKm2, vx, vy, spdKt, dir}], global:{vx,vy,spdKt,dir,blocks}, stats }
   */
  async function track(opt) {
    const { tplNow, tplPrev, dtMin } = opt; const b = opt.bounds;
    // MapLibre draws 256-px raster tiles at map zoom + 1, so match that level: the browser already has these tiles cached
    let z = Math.max(4, Math.min(9, Math.round(opt.zoom) + 1));
    let ds = 2;
    const latC = (b.n + b.s) / 2;
    const tx0 = Math.floor(lng2x(b.w, z)), tx1 = Math.floor(lng2x(b.e, z)), ty0 = Math.floor(lat2y(b.n, z)), ty1 = Math.floor(lat2y(b.s, z));
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    while ((nx * ny * TILE * TILE) / (ds * ds) > (opt.maxPixels || 700000)) ds *= 2;
    const t0 = performance.now();
    const [now, prev] = await Promise.all([renderFrame(tplNow, z, tx0, ty0, nx, ny, ds), renderFrame(tplPrev, z, tx0, ty0, nx, ny, ds)]);
    const W = now.W, H = now.H;
    const B = classify(now.data, W, H), A = classify(prev.data, W, H);
    const pxM = 40075016.7 * Math.cos(latC * Math.PI / 180) / (TILE * Math.pow(2, z)) * ds;
    const block = Math.max(12, Math.round(80000 / pxM));               // ~80 km blocks
    const search = Math.max(6, Math.min(24, Math.round(60000 / pxM))); // up to ~60 km per step
    const vecs = blockMotion(A, B, W, H, block, search).filter(v => v.gain > 0.05);
    const ws = vecs.map(v => v.cov * v.gain);
    const gdx = vecs.length ? weightedMedian(vecs.map(v => v.dx), ws) : 0, gdy = vecs.length ? weightedMedian(vecs.map(v => v.dy), ws) : 0;
    const toV = (dx, dy) => { const vx = dx * pxM / (dtMin * 60), vy = -dy * pxM / (dtMin * 60); const spd = Math.hypot(vx, vy); return { vx, vy, spdKt: spd * 1.944, dir: (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360 }; };
    const mask = smooth(B, W, H);
    const minArea = Math.max(20, 400e6 / (pxM * pxM)); // >= ~400 km²
    const rings = contours(mask, W, H).map(r => ({ r, a: ringArea(r) })).filter(o => o.a >= minArea).sort((p, q) => q.a - p.a).slice(0, 12).map(o => {
      const r = o.r; let xs = Infinity, xe = -Infinity, ys = Infinity, ye = -Infinity; for (const p of r) { xs = Math.min(xs, p[0]); xe = Math.max(xe, p[0]); ys = Math.min(ys, p[1]); ye = Math.max(ye, p[1]); }
      const local = vecs.filter(v => v.x >= xs - block && v.x <= xe + block && v.y >= ys - block && v.y <= ye + block);
      const lw = local.map(v => v.cov * v.gain);
      const dx = local.length ? weightedMedian(local.map(v => v.dx), lw) : gdx, dy = local.length ? weightedMedian(local.map(v => v.dy), lw) : gdy;
      const coords = simplify(r, 90).map(p => [x2lng(tx0 + p[0] * ds / TILE, z), y2lat(ty0 + p[1] * ds / TILE, z)]);
      return Object.assign({ coords, areaKm2: o.a * pxM * pxM / 1e6, localBlocks: local.length }, toV(dx, dy));
    });
    return { rings, global: Object.assign({ blocks: vecs.length }, toV(gdx, gdy)), stats: { z, ds, W, H, pxKm: pxM / 1000, tiles: now.tiles, okTiles: now.okTiles, ms: Math.round(performance.now() - t0), block, search } };
  }
  return { track };
})();
