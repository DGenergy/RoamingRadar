/* ============================================================
   Radar Route — client-only PWA. No backend: every layer is fetched
   straight from public endpoints by the phone.
   ============================================================ */
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ---------- endpoints ---------- */
const STYLE_BASE = 'https://tiles.openfreemap.org/styles/';
const IEM_TILES = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/';
const RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';
const CONUS = { w: -125.5, e: -66, s: 24, n: 50 };
const NWS = 'https://api.weather.gov';
const AWC = 'https://aviationweather.gov/api/data/metar';
const IEM_CUR = 'https://mesonet.agron.iastate.edu/api/1/currents.json';
const OM = 'https://api.open-meteo.com/v1/forecast';
const PS_BUCKET = 'https://noaa-mrms-pds.s3.amazonaws.com/';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERLAYS = {
  topo: { tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'], maxzoom: 17, attribution: '© OpenTopoMap (CC-BY-SA)' },
  osm: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], maxzoom: 19, attribution: '© OpenStreetMap' },
  sat: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], maxzoom: 19, attribution: 'Imagery © Esri' }
};
const STATE_BOX = {AL:[-88.5,30.2,-84.9,35.0],AZ:[-114.8,31.3,-109.0,37.0],AR:[-94.6,33.0,-89.6,36.5],CA:[-124.4,32.5,-114.1,42.0],CO:[-109.1,37.0,-102.0,41.0],CT:[-73.7,41.0,-71.8,42.1],DE:[-75.8,38.4,-75.0,39.8],FL:[-87.6,24.5,-80.0,31.0],GA:[-85.6,30.4,-80.8,35.0],ID:[-117.2,42.0,-111.0,49.0],IL:[-91.5,37.0,-87.5,42.5],IN:[-88.1,37.8,-84.8,41.8],IA:[-96.6,40.4,-90.1,43.5],KS:[-102.1,37.0,-94.6,40.0],KY:[-89.6,36.5,-81.9,39.1],LA:[-94.0,28.9,-88.8,33.0],ME:[-71.1,43.1,-66.9,47.5],MD:[-79.5,37.9,-75.0,39.7],MA:[-73.5,41.2,-69.9,42.9],MI:[-90.4,41.7,-82.4,48.2],MN:[-97.2,43.5,-89.5,49.4],MS:[-91.7,30.2,-88.1,35.0],MO:[-95.8,36.0,-89.1,40.6],MT:[-116.1,44.4,-104.0,49.0],NE:[-104.1,40.0,-95.3,43.0],NV:[-120.0,35.0,-114.0,42.0],NH:[-72.6,42.7,-70.6,45.3],NJ:[-75.6,38.9,-73.9,41.4],NM:[-109.1,31.3,-103.0,37.0],NY:[-79.8,40.5,-71.9,45.0],NC:[-84.3,33.8,-75.5,36.6],ND:[-104.1,45.9,-96.6,49.0],OH:[-84.8,38.4,-80.5,42.0],OK:[-103.0,33.6,-94.4,37.0],OR:[-124.6,42.0,-116.5,46.3],PA:[-80.5,39.7,-74.7,42.3],RI:[-71.9,41.1,-71.1,42.0],SC:[-83.4,32.0,-78.5,35.2],SD:[-104.1,42.5,-96.4,45.9],TN:[-90.3,35.0,-81.6,36.7],TX:[-106.6,25.8,-93.5,36.5],UT:[-114.1,37.0,-109.0,42.0],VT:[-73.4,42.7,-71.5,45.0],VA:[-83.7,36.5,-75.2,39.5],WA:[-124.8,45.5,-116.9,49.0],WV:[-82.6,37.2,-77.7,40.6],WI:[-92.9,42.5,-86.8,47.1],WY:[-111.1,41.0,-104.0,45.0]};
const NWS_COLORS = {
  'Tornado Warning': '#FF0000', 'Severe Thunderstorm Warning': '#FFA500', 'Flash Flood Warning': '#8B0000', 'Flood Warning': '#00FF00',
  'Tornado Watch': '#FFFF00', 'Severe Thunderstorm Watch': '#DB7093', 'Flood Watch': '#2E8B57', 'Flash Flood Watch': '#2E8B57',
  'Special Weather Statement': '#FFE4B5', 'Wind Advisory': '#D2B48C', 'High Wind Warning': '#DAA520', 'High Wind Watch': '#B8860B',
  'Red Flag Warning': '#FF00FF', 'Fire Weather Watch': '#FFDEAD', 'Heat Advisory': '#FF7F50', 'Excessive Heat Warning': '#C71585',
  'Winter Weather Advisory': '#7B68EE', 'Winter Storm Warning': '#FF69B4', 'Winter Storm Watch': '#4682B4', 'Blizzard Warning': '#FF4500',
  'Dense Fog Advisory': '#708090', 'Hurricane Warning': '#DC143C', 'Tropical Storm Warning': '#B22222', 'Coastal Flood Advisory': '#7CFC00',
  'Air Quality Alert': '#808080', 'Dust Storm Warning': '#FFE4C4', 'Freeze Warning': '#483D8B', 'Frost Advisory': '#6495ED'
};

/* ---------- settings (localStorage) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('rr.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rr.' + k, JSON.stringify(v)); } catch (e) {} }
};
const settings = Object.assign({ style: 'dark', overlay: 'none', overlayOp: 75, hs: 60, coneMode: 'group', minProb: 10, loop: '120,10', sound: true, windHeat: true, windHeatOp: 40, radarSrc: 'auto', layers: { radar: true, alerts: true, storms: true, wind: false, metar: false, terrain: false } }, store.get('settings', {}));
function saveSettings() { store.set('settings', settings); }

/* ---------- diagnostics ---------- */
const diag = {};
function src(name, note) {
  if (!diag[name]) {
    const el = document.createElement('div');
    el.className = 'row'; el.innerHTML = `<i></i><div class="n">${name}</div><div class="m">${note || ''}</div><div class="t"></div>`;
    $('#rows').appendChild(el); diag[name] = { el, t0: 0 };
  }
  const d = diag[name];
  return {
    start(msg) { d.t0 = performance.now(); d.el.className = 'row wait'; d.el.querySelector('.m').innerHTML = msg || 'fetching…'; d.el.querySelector('.t').textContent = ''; },
    ok(msg, detail) { d.el.className = 'row ok'; d.el.querySelector('.m').innerHTML = msg + (detail ? `<small>${detail}</small>` : ''); d.el.querySelector('.t').textContent = Math.round(performance.now() - d.t0) + ' ms'; },
    fail(err, detail) { const m = (err && err.message) ? err.message : String(err); const cors = /Failed to fetch|NetworkError|Load failed/i.test(m) ? ' — blocked (CORS or offline)' : ''; d.el.className = 'row bad'; d.el.querySelector('.m').innerHTML = m + cors + (detail ? `<small>${detail}</small>` : ''); d.el.querySelector('.t').textContent = Math.round(performance.now() - d.t0) + ' ms'; },
    note(msg) { d.el.querySelector('.m').innerHTML = msg; }
  };
}
async function getJSON(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`); return r.json(); }
async function getText(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`); return r.text(); }
const pad = (n) => String(n).padStart(2, '0');
const fc = (f) => ({ type: 'FeatureCollection', features: f || [] });
function haversine(a, b) { const R = 6371000, toR = Math.PI / 180; const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------- map ---------- */
let mapLoaded = false;
const lastView = store.get('view', null);
const map = new maplibregl.Map({ container: 'map', style: STYLE_BASE + settings.style, center: lastView ? lastView.c : [-103.4, 38.6], zoom: lastView ? lastView.z : 6.2, attributionControl: false, pitchWithRotate: false });
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
map.on('moveend', () => store.set('view', { c: [map.getCenter().lng, map.getCenter().lat], z: map.getZoom() }));
const dBase = src('Basemap', 'OpenFreeMap vector tiles'); dBase.start();
map.on('load', () => { mapLoaded = true; dBase.ok('style loaded', settings.style); buildAll(); setTimeout(() => { const a = document.querySelector('.maplibregl-ctrl-attrib'); if (a) a.classList.remove('maplibregl-compact-show'); }, 800); });
let radarErr = 0;
map.on('error', (e) => {
  const m = e && e.error && e.error.message ? e.error.message : String(e.error || e); const sid = e.sourceId || '';
  if (sid.startsWith('radar-')) { radarErr++; }
  else if (sid === 'terrain-dem') src('Relief').fail(new Error(m));
  else if (!sid && !mapLoaded) dBase.fail(new Error(m));
});
$('#northBtn').onclick = () => map.resetNorthPitch({ duration: 400 });
const OVERLAY_IDS = new Set(['hillshade', 'overlay', 'windheat', 'alerts-fill', 'alerts-line', 'cone-fill', 'cone-line', 'contour-line', 'contour-label', 'ps-outline', 'ps-vector', 'edge-fill', 'edge-line', 'edge-contour', 'edge-label', 'edge-outline', 'metar-pt', 'metar-lbl', 'route-casing', 'route-line', 'tick-pt', 'tick-lbl', 'places-pt', 'places-lbl', 'me-halo', 'me-pt']);
function anchorBelowRoads(exclude) { const l = map.getStyle().layers.find(l => !exclude.includes(l.id) && (l.id.startsWith('radar-') || OVERLAY_IDS.has(l.id) || l.type === 'line' || l.type === 'symbol')); return l ? l.id : undefined; }
function setVis(ids, on) { ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }); }
const overlayBuilders = [];
function switchStyle(name) {
  settings.style = name; saveSettings(); $('#styleSel').value = name;
  windBackground();
  map.setStyle(STYLE_BASE + name);
  map.once('style.load', () => { mapLoaded = true; overlayBuilders.forEach(fn => fn()); Object.keys(settings.layers).forEach(applyLayerState); buildRadar(); });
}
$('#styleSel').value = settings.style;
$('#styleSel').onchange = (e) => switchStyle(e.target.value);
const STYLE_CYCLE = ['dark', 'liberty', 'positron', 'fiord'];
$('#styleBtn').onclick = () => switchStyle(STYLE_CYCLE[(STYLE_CYCLE.indexOf(settings.style) + 1) % STYLE_CYCLE.length]);

/* ---------- sheets + nav ---------- */
let openSheet = null;
function showSheet(name) {
  closeSheet();
  if (!name) return;
  openSheet = name; $('#sheet-' + name).hidden = false; $('#scrim').hidden = false; WindLayer.pause(true);
  $$('.nb[data-sheet]').forEach(b => b.classList.toggle('on', b.dataset.sheet === name));
  if (name === 'alerts') renderAlertList();
}
function closeSheet() { if (!openSheet) return; $('#sheet-' + openSheet).hidden = true; $('#scrim').hidden = true; openSheet = null; WindLayer.pause(false); $$('.nb[data-sheet]').forEach(b => b.classList.remove('on')); }
$$('.nb[data-sheet]').forEach(b => b.onclick = () => openSheet === b.dataset.sheet ? closeSheet() : showSheet(b.dataset.sheet));
$$('[data-close]').forEach(b => b.onclick = closeSheet);
$('#scrim').onclick = closeSheet;
$('#routePill').onclick = () => showSheet('route');

/* ---------- layer toggles ---------- */
$$('.chip[data-layer]').forEach(b => { b.classList.toggle('on', !!settings.layers[b.dataset.layer]); b.onclick = () => { const k = b.dataset.layer; settings.layers[k] = !settings.layers[k]; b.classList.toggle('on', settings.layers[k]); saveSettings(); applyLayerState(k); }; });
function applyLayerState(k) {
  if (!mapLoaded) return; const on = settings.layers[k];
  if (k === 'radar') { radarFrames.forEach(f => setVis([f.layer], on)); if (on) showFrame(curFrame); else stopPlay(); updateScrubCard(); }
  if (k === 'alerts') setVis(['alerts-fill', 'alerts-line'], on);
  if (k === 'storms') setVis(['cone-fill', 'cone-line', 'contour-line', 'contour-label', 'ps-outline', 'ps-vector', 'edge-fill', 'edge-line', 'edge-contour', 'edge-label', 'edge-outline'], on);
  if (k === 'wind') setWindOn(on);
  if (k === 'metar') { setVis(['metar-pt', 'metar-lbl'], on); if (on) loadMetar(); }
  if (k === 'terrain') toggleTerrain(on);
}

/* ============================================================
   RADAR — IEM MRMS composite tiles, one raster source per frame
   ============================================================ */
let radarFrames = [], curFrame = 0, playing = false, playTimer = null;
// The scrub card shows the radar loop controls only while the radar layer is on; with radar off it
// shrinks to the wind timeline, and disappears when that is off too.
function updateScrubCard() { const r = settings.layers.radar !== false, w = !$('#windRow').hidden; $('#scrub').classList.toggle('noradar', !r); $('#scrub').hidden = !r && !w; $('#radarLegend').hidden = !r; $('#legend').classList.toggle('noradar', !r); $('#legend').hidden = !r && !w; }
const dRadar = src('Radar', 'MRMS via IEM (US) · RainViewer (global)');
function stampUTC(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`; }
function fmtLocal(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function tzAbbr() { try { return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName').value; } catch (e) { return ''; } }
$('#tz').textContent = tzAbbr();
let tilesReadable = null;
const radarTpl = (d) => `${IEM_TILES}mrms::lcref-${stampUTC(d)}/{z}/{x}/{y}.png`;
async function findLatestFrame() {
  const now = new Date(); now.setUTCSeconds(0, 0); now.setUTCMinutes(now.getUTCMinutes() - (now.getUTCMinutes() % 2) - 4);
  for (let i = 0; i < 12; i++) {
    const t = new Date(now.getTime() - i * 2 * 60000);
    const url = `${IEM_TILES}mrms::lcref-${stampUTC(t)}/5/7/12.png`;
    try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) { tilesReadable = true; return { t }; } }
    catch (e) { tilesReadable = false; const ok = await new Promise(res => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = url; }); if (ok) return { t }; }
  }
  return null;
}
function clearRadar() { radarFrames.forEach(f => { if (map.getLayer(f.layer)) map.removeLayer(f.layer); if (map.getSource(f.source)) map.removeSource(f.source); }); radarFrames = []; radarErr = 0; }
let radarMode = 'mrms', lastObserved = -1;
function inConus() { const c = map.getCenter(); return c.lng > CONUS.w && c.lng < CONUS.e && c.lat > CONUS.s && c.lat < CONUS.n; }
function pickRadarMode() { const p = settings.radarSrc; if (p === 'mrms' || p === 'rv') return p; return inConus() ? 'mrms' : 'rv'; }
function addRadarFrame(id, tpl, t, attribution, future) {
  if (map.getSource(id)) return;
  const beforeId = map.getStyle().layers.find(l => (OVERLAY_IDS.has(l.id) && l.id !== 'hillshade' && l.id !== 'overlay' && l.id !== 'windheat') || (l.type === 'symbol' && !l.id.startsWith('radar-')));
  map.addSource(id, { type: 'raster', tiles: [tpl], tileSize: 256, maxzoom: 10, attribution });
  map.addLayer({ id, type: 'raster', source: id, layout: { visibility: settings.layers.radar ? 'visible' : 'none' }, paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0 }, 'raster-resampling': 'nearest' } }, beforeId ? beforeId.id : undefined);
  radarFrames.push({ t, tpl, source: id, layer: id, future: !!future });
}
function finishRadar(sub, ticks) {
  placeWindHeat();
  $('#scrubber').max = radarFrames.length - 1;
  const lt = $('#loopTicks'); lt.innerHTML = ''; ticks.forEach(txt => { const sp = document.createElement('span'); sp.textContent = txt; lt.appendChild(sp); });
  showFrame(lastObserved);
  $('#frameSub').textContent = sub;
  if (['edge', 'both'].includes(settings.coneMode)) runEdgeTracker();
}
async function buildRadar() {
  clearRadar(); radarMode = pickRadarMode();
  if (radarMode === 'rv') return buildRadarRV();
  dRadar.start('probing latest MRMS frame…');
  const latest = await findLatestFrame();
  if (!latest) { dRadar.fail(new Error('no recent mrms::lcref tile answered')); $('#frameSub').textContent = 'MRMS via IEM · no frames'; return; }
  const [spanMin, stepMin] = settings.loop.split(',').map(Number); const n = Math.floor(spanMin / stepMin) + 1;
  for (let i = n - 1; i >= 0; i--) { const t = new Date(latest.t.getTime() - i * stepMin * 60000); addRadarFrame(`radar-${stampUTC(t)}`, radarTpl(t), t, 'MRMS © NOAA via IEM', false); }
  lastObserved = radarFrames.length - 1;
  const age = Math.round((Date.now() - latest.t.getTime()) / 60000);
  dRadar.ok(`MRMS · ${radarFrames.length} frames · latest ${age} min old`, tilesReadable ? 'tiles CORS-readable → edge tracker available' : 'tiles display-only (no CORS) → edge tracker unavailable');
  finishRadar(`MRMS composite (US) · ${stepMin}-min steps · ${age} min old`, [0, 0.5, 1].map(f => { const m = Math.round(spanMin * (1 - f)); return f === 1 ? 'latest' : `−${m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0) + ' h' : m + ' min'}`; }));
}
// RainViewer global composite: ~2 h of past frames at 10 min plus a 30-min nowcast
async function buildRadarRV() {
  dRadar.start('RainViewer frame list…');
  try {
    const j = await getJSON(RAINVIEWER);
    const host = j.host || 'https://tilecache.rainviewer.com';
    const past = (j.radar && j.radar.past) || [], nowc = (j.radar && j.radar.nowcast) || [];
    if (!past.length) throw new Error('RainViewer returned no radar frames');
    const tpl = (fr) => `${host}${fr.path}/256/{z}/{x}/{y}/6/1_1.png`; // colour scheme 6 ≈ NEXRAD palette, smoothed, snow shown
    past.forEach(fr => addRadarFrame(`radar-rv-${fr.time}`, tpl(fr), new Date(fr.time * 1000), 'Radar © RainViewer', false));
    lastObserved = radarFrames.length - 1;
    nowc.forEach(fr => addRadarFrame(`radar-rvn-${fr.time}`, tpl(fr), new Date(fr.time * 1000), 'Radar © RainViewer', true));
    // CORS check on one tile (for the edge tracker)
    try { const r = await fetch(tpl(past[past.length - 1]).replace('{z}', 4).replace('{x}', 3).replace('{y}', 6), { mode: 'cors' }); tilesReadable = r.ok; } catch (e) { tilesReadable = false; }
    const age = Math.round((Date.now() - past[past.length - 1].time * 1000) / 60000);
    dRadar.ok(`RainViewer · ${past.length} past + ${nowc.length} nowcast frames · latest ${age} min old`, `global composite (NZ, Australia, Colombia where national radars feed it) · ${tilesReadable ? 'CORS ok → edge tracker available' : 'display-only'}`);
    finishRadar(`RainViewer global · 10-min steps · ${age} min old · +${nowc.length * 10} min nowcast`, ['−2 h', '−1 h', 'now', `+${nowc.length * 10}`]);
  } catch (e) { dRadar.fail(e, 'no radar coverage from this source here'); $('#frameSub').textContent = 'RainViewer · unavailable'; }
}
function showFrame(i) {
  if (!radarFrames.length) return; curFrame = Math.max(0, Math.min(i, radarFrames.length - 1));
  radarFrames.forEach((f, j) => { if (map.getLayer(f.layer)) map.setPaintProperty(f.layer, 'raster-opacity', (j === curFrame && settings.layers.radar) ? 0.78 : 0); });
  $('#scrubber').value = curFrame; $('#frameTime').textContent = fmtLocal(radarFrames[curFrame].t);
  const f = radarFrames[curFrame]; $('#liveBadge').hidden = !(curFrame === lastObserved || f.future); $('#liveBadge').lastChild.textContent = f.future ? 'NOWCAST' : 'LIVE'; $('#liveBadge').classList.toggle('future', !!f.future);
}
$('#scrubber').oninput = (e) => { stopPlay(); showFrame(Number(e.target.value)); };
$('#loopSel').value = settings.loop; $('#loopSel').onchange = (e) => { settings.loop = e.target.value; saveSettings(); stopPlay(); buildRadar(); };
$('#radarSrc').value = settings.radarSrc; $('#radarSrc').onchange = (e) => { settings.radarSrc = e.target.value; saveSettings(); stopPlay(); buildRadar(); };
map.on('moveend', () => { if (mapLoaded && settings.radarSrc === 'auto' && pickRadarMode() !== radarMode && !playing) buildRadar(); });
function stopPlay() { playing = false; clearInterval(playTimer); $('#playIcon').setAttribute('d', 'M8 5.5 L18 12 L8 18.5 Z'); }
$('#play').onclick = () => { if (playing) { stopPlay(); return; } playing = true; $('#playIcon').setAttribute('d', 'M7 5 H10.5 V19 H7 Z M13.5 5 H17 V19 H13.5 Z'); playTimer = setInterval(() => { const next = curFrame + 1; showFrame(next >= radarFrames.length ? 0 : next); }, 150); };

/* ============================================================
   ALERTS — NWS active alerts, list, badge, location check
   ============================================================ */
const dAlerts = src('NWS alerts', 'api.weather.gov/alerts/active');
let alertsGeo = fc(), alertsRaw = [], seenHere = new Set(), firstAlertPass = true;
function ensureAlertLayers() {
  if (!map.getSource('alerts')) map.addSource('alerts', { type: 'geojson', data: alertsGeo });
  if (!map.getLayer('alerts-fill')) map.addLayer({ id: 'alerts-fill', type: 'fill', source: 'alerts', layout: { visibility: settings.layers.alerts ? 'visible' : 'none' }, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['boolean', ['get', 'warning'], false], 0.14, 0.07] } });
  if (!map.getLayer('alerts-line')) map.addLayer({ id: 'alerts-line', type: 'line', source: 'alerts', layout: { visibility: settings.layers.alerts ? 'visible' : 'none' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['boolean', ['get', 'warning'], false], 2.2, 1.2], 'line-opacity': 0.9 } });
}
overlayBuilders.push(ensureAlertLayers);
async function loadAlerts() {
  dAlerts.start();
  try {
    const j = await getJSON(`${NWS}/alerts/active?status=actual&message_type=alert,update`);
    let withGeom = 0, zoneOnly = 0; const feats = [];
    alertsRaw = j.features;
    for (const f of j.features) {
      const ev = f.properties.event; if (!f.geometry) { zoneOnly++; continue; } withGeom++;
      feats.push({ type: 'Feature', geometry: f.geometry, properties: { event: ev, color: NWS_COLORS[ev] || '#9FB4C4', warning: /Warning/.test(ev), headline: f.properties.headline || '', severity: f.properties.severity, expires: f.properties.expires, id: f.properties.id, area: f.properties.areaDesc || '' } });
    }
    feats.sort((a, b) => (a.properties.warning ? 1 : 0) - (b.properties.warning ? 1 : 0));
    alertsGeo = fc(feats); ensureAlertLayers(); map.getSource('alerts').setData(alertsGeo);
    dAlerts.ok(`${j.features.length} active · ${withGeom} polygons · ${zoneOnly} zone-based`);
    updateAlertBadge(); checkAlertsHere(); if (openSheet === 'alerts') renderAlertList();
  } catch (e) { dAlerts.fail(e); }
}
function alertsInView() {
  const b = map.getBounds();
  return alertsGeo.features.filter(f => { const bb = bboxOf(f.geometry); return bb && bb[0] < b.getEast() && bb[2] > b.getWest() && bb[1] < b.getNorth() && bb[3] > b.getSouth(); });
}
function bboxOf(g) { if (!g) return null; const bb = [Infinity, Infinity, -Infinity, -Infinity]; const walk = (c) => { if (typeof c[0] === 'number') { bb[0] = Math.min(bb[0], c[0]); bb[1] = Math.min(bb[1], c[1]); bb[2] = Math.max(bb[2], c[0]); bb[3] = Math.max(bb[3], c[1]); } else c.forEach(walk); }; walk(g.coordinates); return bb; }
function updateAlertBadge() {
  const here = alertsGeo.features.filter(f => myPos && inGeom(myPos, f.geometry));
  const warnHere = here.filter(f => f.properties.warning).length;
  const inView = alertsInView().filter(f => f.properties.warning).length;
  const badge = $('#alertBadge'); const n = warnHere || inView;
  badge.hidden = n === 0; badge.textContent = n; badge.classList.toggle('red', warnHere > 0);
}
map.on('moveend', () => { updateAlertBadge(); if (openSheet === 'alerts') renderAlertList(); });
function renderAlertList() {
  const ul = $('#alertList'); const list = alertsInView().sort((a, b) => (b.properties.warning ? 1 : 0) - (a.properties.warning ? 1 : 0));
  ul.innerHTML = list.length ? '' : '<li class="empty">No polygon alerts in view. Zone-based advisories are not drawn yet.</li>';
  list.slice(0, 40).forEach(f => {
    const p = f.properties; const li = document.createElement('li');
    li.innerHTML = `<i class="sw" style="background:${p.color}"></i><div class="t"><b>${esc(p.event)}</b><small>${esc(p.area).slice(0, 70)} · until ${new Date(p.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><button>GO</button>`;
    li.querySelector('button').onclick = () => { const bb = bboxOf(f.geometry); map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 60, duration: 600 }); closeSheet(); };
    ul.appendChild(li);
  });
  const here = myPos ? alertsGeo.features.filter(f => inGeom(myPos, f.geometry)) : null;
  $('#alertsHere').textContent = !myPos ? 'Location unknown — tap LOCATE to start GPS.' : here.length ? `At your location now: ${here.map(f => f.properties.event).join(', ')}` : 'No polygon alerts at your location.';
}
map.on('click', 'alerts-fill', (e) => { const p = e.features[0].properties; new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>${esc(p.event)}</b><div class="k">${esc(p.severity)} · until ${new Date(p.expires).toLocaleString()}</div><div style="margin-top:6px">${esc(p.headline)}</div></div>`).addTo(map); });

/* point in polygon / multipolygon */
function inRing(pt, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
function inPoly(pt, poly) { if (!inRing(pt, poly[0])) return false; for (let k = 1; k < poly.length; k++) if (inRing(pt, poly[k])) return false; return true; }
function inGeom(pt, g) { if (!g) return false; if (g.type === 'Polygon') return inPoly(pt, g.coordinates); if (g.type === 'MultiPolygon') return g.coordinates.some(p => inPoly(pt, p)); return false; }

/* sound + flash */
let audioCtx = null;
function unlockAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} }
document.addEventListener('pointerdown', unlockAudio, { once: true });
function beep() {
  unlockAudio(); if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.35, 0.7, 1.05].forEach((dt, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + dt); g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.28); o.connect(g).connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.3); });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
}
function flash() { const f = $('#flash'); f.hidden = false; f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; setTimeout(() => { f.hidden = true; }, 2600); }
function banner(title, sub) { $('#bannerTitle').textContent = title; $('#bannerSub').textContent = sub; $('#banner').hidden = false; }
$('#bannerClose').onclick = () => { $('#banner').hidden = true; };
$('#soundOn').checked = settings.sound !== false; $('#soundOn').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
$('#testSound').onclick = () => { beep(); flash(); banner('Test alert', 'This is what a new warning at your location looks like.'); };
function checkAlertsHere() {
  if (!myPos) return;
  const here = alertsGeo.features.filter(f => f.properties.warning && inGeom(myPos, f.geometry));
  const fresh = here.filter(f => !seenHere.has(f.properties.id));
  here.forEach(f => seenHere.add(f.properties.id));
  if (firstAlertPass) { firstAlertPass = false; if (here.length) banner(here[0].properties.event, 'in effect at your location'); return; }
  if (fresh.length && settings.sound !== false) { beep(); flash(); banner(fresh[0].properties.event, `new at your location · until ${new Date(fresh[0].properties.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); }
}

/* ============================================================
   LOCATION — follow toggle, marker
   ============================================================ */
let myPos = null, watchId = null, follow = false;
function ensureMeLayers() {
  if (!map.getSource('me')) map.addSource('me', { type: 'geojson', data: fc() });
  if (!map.getLayer('me-halo')) map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-radius': 16, 'circle-color': '#57B8E0', 'circle-opacity': 0.18 } });
  if (!map.getLayer('me-pt')) map.addLayer({ id: 'me-pt', type: 'circle', source: 'me', paint: { 'circle-radius': 7, 'circle-color': '#57B8E0', 'circle-stroke-color': '#0F1418', 'circle-stroke-width': 2.5 } });
}
overlayBuilders.push(ensureMeLayers);
function setMyPos(ll, acc) {
  myPos = ll; ensureMeLayers(); map.getSource('me').setData(fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: ll }, properties: { acc } }]));
  if (follow) map.easeTo({ center: ll, duration: 500 });
  updateAlertBadge(); checkAlertsHere(); if (openSheet === 'alerts') renderAlertList();
}
$('#nbLocate').onclick = () => {
  if (!navigator.geolocation) { banner('No GPS', 'Geolocation is not available in this browser.'); return; }
  follow = !follow; $('#nbLocate').classList.toggle('on', follow);
  if (follow && watchId == null) watchId = navigator.geolocation.watchPosition(p => setMyPos([p.coords.longitude, p.coords.latitude], p.coords.accuracy), err => { banner('GPS failed', err.message); follow = false; $('#nbLocate').classList.remove('on'); }, { enableHighAccuracy: true, maximumAge: 10000 });
  if (follow && myPos) map.easeTo({ center: myPos, zoom: Math.max(map.getZoom(), 8) });
};

/* ============================================================
   STORMS — ProbSevere cones (grouped) + radar edge cones
   ============================================================ */
const dPS = src('ProbSevere', 'noaa-mrms-pds S3 → latest JSON');
const dEdge = src('Edge tracker', 'radar pixels → motion → leading-edge cones');
const CONE_MIN = 90, DIR_TOL = 15 * Math.PI / 180, SPD_TOL = 0.2, CONTOURS = [30, 60, 90], GROUP_KM = 45, GROUP_DEG = 35;
let coneGeo = fc(), contourGeo = fc(), psOutlineGeo = fc(), psVecGeo = fc(), edgeGeo = fc(), edgeContourGeo = fc(), edgeOutlineGeo = fc();
function ensureStormLayers() {
  const add = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data }); };
  add('cones', coneGeo); add('contours', contourGeo); add('ps-outline', psOutlineGeo); add('ps-vector', psVecGeo); add('edges', edgeGeo); add('edge-contours', edgeContourGeo); add('edge-outlines', edgeOutlineGeo);
  const vis = settings.layers.storms ? 'visible' : 'none';
  const lbl = (id, srcId, color) => ({ id, type: 'symbol', source: srcId, layout: { visibility: vis, 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, -0.8], 'text-allow-overlap': true }, paint: { 'text-color': color, 'text-halo-color': '#0F1418', 'text-halo-width': 1.2 } });
  if (!map.getLayer('edge-fill')) map.addLayer({ id: 'edge-fill', type: 'fill', source: 'edges', layout: { visibility: vis }, paint: { 'fill-color': '#7CCBEA', 'fill-opacity': 0.12 } });
  if (!map.getLayer('edge-line')) map.addLayer({ id: 'edge-line', type: 'line', source: 'edges', layout: { visibility: vis }, paint: { 'line-color': '#7CCBEA', 'line-width': 1.2, 'line-opacity': 0.7 } });
  if (!map.getLayer('edge-contour')) map.addLayer({ id: 'edge-contour', type: 'line', source: 'edge-contours', layout: { visibility: vis }, paint: { 'line-color': '#BFE6F5', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } });
  if (!map.getLayer('edge-label')) map.addLayer(lbl('edge-label', 'edge-contours', '#BFE6F5'));
  if (!map.getLayer('edge-outline')) map.addLayer({ id: 'edge-outline', type: 'line', source: 'edge-outlines', layout: { visibility: vis }, paint: { 'line-color': '#FFFFFF', 'line-width': 1.6, 'line-opacity': 0.9 } });
  if (!map.getLayer('cone-fill')) map.addLayer({ id: 'cone-fill', type: 'fill', source: 'cones', layout: { visibility: vis }, paint: { 'fill-color': '#E9B437', 'fill-opacity': 0.16 } });
  if (!map.getLayer('cone-line')) map.addLayer({ id: 'cone-line', type: 'line', source: 'cones', layout: { visibility: vis }, paint: { 'line-color': '#E9B437', 'line-width': 1.2, 'line-opacity': 0.8 } });
  if (!map.getLayer('contour-line')) map.addLayer({ id: 'contour-line', type: 'line', source: 'contours', layout: { visibility: vis }, paint: { 'line-color': '#F1D48A', 'line-width': 1.2, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } });
  if (!map.getLayer('contour-label')) map.addLayer(lbl('contour-label', 'contours', '#F1D48A'));
  if (!map.getLayer('ps-outline')) map.addLayer({ id: 'ps-outline', type: 'line', source: 'ps-outline', layout: { visibility: vis }, paint: { 'line-color': '#FFFFFF', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } });
  if (!map.getLayer('ps-vector')) map.addLayer({ id: 'ps-vector', type: 'line', source: 'ps-vector', layout: { visibility: vis }, paint: { 'line-color': '#FFFFFF', 'line-width': 1.8 } });
}
overlayBuilders.push(ensureStormLayers);
function projFactory(lat0) { const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540; return { to: (lng, lat) => [lng * kx, lat * ky], from: (x, y) => [x / kx, y / ky] }; }
function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts; const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); }
function ringCentroid(ring) { const n = ring.length; return [ring.reduce((a, c) => a + c[0], 0) / n, ring.reduce((a, c) => a + c[1], 0) / n]; }
function motionOf(p) { const ve = parseFloat(p.MOTION_EAST), vs = parseFloat(p.MOTION_SOUTH); return (isFinite(ve) && isFinite(vs)) ? [ve, -vs] : null; }
function buildConeFrom(rings, vx, vy) {
  const spd = Math.hypot(vx, vy); if (spd < 2) return null;
  const all = rings.flat(); const lat0 = all.reduce((a, c) => a + c[1], 0) / all.length; const P = projFactory(lat0);
  const pts = all.map(c => P.to(c[0], c[1]));
  const cx = pts.reduce((a, c) => a + c[0], 0) / pts.length, cy = pts.reduce((a, c) => a + c[1], 0) / pts.length;
  const ux = vx / spd, uy = vy / spd, nx = -uy, ny = ux; const T = CONE_MIN * 60, endPts = []; const hullNow = hull(pts);
  for (const q of hullNow) for (const sf of [1 - SPD_TOL, 1 + SPD_TOL]) for (const ang of [-DIR_TOL, DIR_TOL]) { const d = spd * sf * T, ca = Math.cos(ang), sa = Math.sin(ang); endPts.push([q[0] + (ux * ca - uy * sa) * d, q[1] + (ux * sa + uy * ca) * d]); }
  const coneRing = hull(hullNow.concat(endPts)).map(q => P.from(q[0], q[1])); coneRing.push(coneRing[0]);
  let w = 0, aheadMax = -1e9; for (const q of pts) { w = Math.max(w, Math.abs((q[0] - cx) * nx + (q[1] - cy) * ny)); aheadMax = Math.max(aheadMax, (q[0] - cx) * ux + (q[1] - cy) * uy); }
  const contours = CONTOURS.map(m => { const d = spd * m * 60, hw = w + d * Math.tan(DIR_TOL), mx = cx + ux * (d + aheadMax), my = cy + uy * (d + aheadMax); const segs = 12, line = []; for (let i = 0; i <= segs; i++) { const f = (i / segs) * 2 - 1, bul = (1 - f * f) * d * SPD_TOL * 0.5; line.push(P.from(mx + nx * hw * f + ux * bul, my + ny * hw * f + uy * bul)); } return { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { label: m === CONE_MIN ? `${m} min` : String(m), minutes: m } }; });
  const vector = { type: 'Feature', geometry: { type: 'LineString', coordinates: [P.from(cx, cy), P.from(cx + ux * spd * 900, cy + uy * spd * 900)] }, properties: {} };
  return { ring: coneRing, contours, vector, spdKt: (spd * 1.944).toFixed(0), dir: ((Math.atan2(ux, uy) * 180 / Math.PI + 360) % 360).toFixed(0) };
}
function groupObjects(objs) {
  const parent = objs.map((_, i) => i); const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) { const a = objs[i], b = objs[j]; if (haversine(a.c, b.c) > GROUP_KM * 1000) continue; let dd = Math.abs(a.dir - b.dir); if (dd > 180) dd = 360 - dd; if (dd > GROUP_DEG) continue; parent[find(i)] = find(j); }
  const groups = {}; objs.forEach((o, i) => { const r = find(i); (groups[r] = groups[r] || []).push(o); }); return Object.values(groups);
}
async function findLatestProbSevere() {
  const tryHour = async (d) => { const day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; const prefix = `ProbSevere/${day}/MRMS_PROBSEVERE_${day}_${pad(d.getUTCHours())}`; const xml = await getText(`${PS_BUCKET}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=100`); const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]).filter(k => k.endsWith('.json')).sort(); return keys.length ? keys[keys.length - 1] : null; };
  const now = new Date(); return (await tryHour(now)) || (await tryHour(new Date(now.getTime() - 3600000)));
}
let lastPS = null, lastStats = '';
async function loadProbSevere() {
  dPS.start('listing bucket…');
  try {
    const key = await findLatestProbSevere(); if (!key) throw new Error('no ProbSevere file in the last two UTC hours');
    const j = await getJSON(PS_BUCKET + key); lastPS = j; renderStorms();
    const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(j.validTime || ''); const age = m ? Math.round((Date.now() - Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) / 60000) : NaN;
    dPS.ok(`${j.features.length} objects · ${lastStats}`, `${j.product} · ${isFinite(age) ? age + ' min old' : ''}`);
  } catch (e) { dPS.fail(e); }
}
function renderStorms() {
  if (!lastPS) return;
  const mode = settings.coneMode, minProb = settings.minProb; const outlines = [], objs = []; let slow = 0, below = 0;
  for (const f of lastPS.features) {
    const p = f.properties; outlines.push({ type: 'Feature', geometry: f.geometry, properties: { id: p.ID, ps: p.ProbSevere } });
    const v = motionOf(p); if (!v) continue; const spd = Math.hypot(v[0], v[1]); if (spd < 2) { slow++; continue; }
    if (parseFloat(p.ProbSevere) < minProb) { below++; continue; }
    objs.push({ ring: f.geometry.coordinates[0], c: ringCentroid(f.geometry.coordinates[0]), v, spd, dir: (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360, p });
  }
  const cones = [], contours = [], vectors = []; let groupsN = 0;
  if (['group', 'each', 'both'].includes(mode)) {
    const groups = mode === 'each' ? objs.map(o => [o]) : groupObjects(objs);
    for (const g of groups) {
      const vx = g.reduce((a, o) => a + o.v[0], 0) / g.length, vy = g.reduce((a, o) => a + o.v[1], 0) / g.length;
      const c = buildConeFrom(g.map(o => o.ring), vx, vy); if (!c) continue;
      const mx = (k) => Math.max(...g.map(o => parseFloat(o.p[k]) || 0));
      cones.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring] }, properties: { id: g.length > 1 ? `line of ${g.length} cells` : g[0].p.ID, n: g.length, spdKt: c.spdKt, dir: c.dir, ps: mx('ProbSevere'), hail: mx('ProbHail'), wind: mx('ProbWind'), tor: mx('ProbTor'), mesh: mx('MESH').toFixed(2) } });
      contours.push(...c.contours); vectors.push(c.vector); if (g.length > 1) groupsN++;
    }
  }
  coneGeo = fc(cones); contourGeo = fc(contours); psOutlineGeo = fc(outlines); psVecGeo = fc(vectors); ensureStormLayers();
  map.getSource('cones').setData(coneGeo); map.getSource('contours').setData(contourGeo); map.getSource('ps-outline').setData(psOutlineGeo); map.getSource('ps-vector').setData(psVecGeo);
  lastStats = ['none', 'edge'].includes(mode) ? 'ProbSevere cones off' : `${cones.length} cones (${groupsN} lines) · ${below} below ${minProb}% · ${slow} slow`;
  if (!['edge', 'both'].includes(mode)) { edgeGeo = fc(); edgeContourGeo = fc(); edgeOutlineGeo = fc(); map.getSource('edges').setData(edgeGeo); map.getSource('edge-contours').setData(edgeContourGeo); map.getSource('edge-outlines').setData(edgeOutlineGeo); dEdge.note('off'); }
}
$('#coneMode').value = settings.coneMode; $('#coneMode').onchange = (e) => { settings.coneMode = e.target.value; saveSettings(); renderStorms(); if (['edge', 'both'].includes(settings.coneMode)) runEdgeTracker(); if (lastPS) dPS.note(`${lastPS.features.length} objects · ${lastStats}`); };
$('#minProb').value = settings.minProb; $('#minProbV').textContent = settings.minProb + '%'; $('#minProb').oninput = (e) => { settings.minProb = Number(e.target.value); $('#minProbV').textContent = settings.minProb + '%'; saveSettings(); renderStorms(); };
map.on('click', 'cone-fill', (e) => { const p = e.features[0].properties; new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>Storm ${esc(p.id)}</b><div class="k">moving ${p.dir}° at ${p.spdKt} kt · 90-min cone${p.n > 1 ? ' · max of members' : ''}</div><table><tr><td>ProbSevere</td><td>${p.ps}%</td></tr><tr><td>Hail</td><td>${p.hail}%</td></tr><tr><td>Wind</td><td>${p.wind}%</td></tr><tr><td>Tornado</td><td>${p.tor}%</td></tr><tr><td>MESH</td><td>${p.mesh} in</td></tr></table></div>`).addTo(map); });
map.on('click', 'edge-fill', (e) => { const p = e.features[0].properties; new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>Radar edge</b><div class="k">≥ ~35 dBZ region, ${p.areaKm2} km² · moving ${p.dir}° at ${p.spdKt} kt</div><div class="k">motion from ${p.blocks} local blocks over ${p.dt} min</div></div>`).addTo(map); });

/* edge tracker (radar pixels) */
let edgeBusy = false, edgeTimer = null;
async function runEdgeTracker() {
  if (edgeBusy || !mapLoaded || radarFrames.length < 2 || lastObserved < 1) return;
  if (tilesReadable === false) { dEdge.fail(new Error('radar tiles are not CORS-readable in this browser/origin')); return; }
  edgeBusy = true; dEdge.start('reading radar frames…');
  try {
    if (lastObserved < 1) return; const now = radarFrames[lastObserved]; let prev = radarFrames[lastObserved - 1];
    const dt = Math.max(2, Math.round((now.t - prev.t) / 60000));
    const b = map.getBounds();
    const res = await RadarTracker.track({ tplNow: now.tpl, tplPrev: prev.tpl, dtMin: dt, bounds: { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() }, zoom: map.getZoom(), maxPixels: 600000 });
    const fills = [], conts = [], outs = [];
    for (const r of res.rings) {
      outs.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords }, properties: {} });
      const c = buildConeFrom([r.coords], r.vx, r.vy); if (!c) continue;
      fills.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring] }, properties: { areaKm2: Math.round(r.areaKm2), spdKt: c.spdKt, dir: c.dir, blocks: r.localBlocks, dt } });
      conts.push(...c.contours);
    }
    edgeGeo = fc(fills); edgeContourGeo = fc(conts); edgeOutlineGeo = fc(outs); ensureStormLayers();
    map.getSource('edges').setData(edgeGeo); map.getSource('edge-contours').setData(edgeContourGeo); map.getSource('edge-outlines').setData(edgeOutlineGeo);
    const g = res.global;
    dEdge.ok(`${res.rings.length} regions · ${fills.length} cones · field motion ${Math.round(g.dir)}° at ${Math.round(g.spdKt)} kt`, `z${res.stats.z} · ${res.stats.pxKm.toFixed(1)} km/px · ${res.stats.okTiles}/${res.stats.tiles} tiles ×2 · ${res.stats.ms} ms · ${g.blocks} motion blocks`);
  } catch (e) { dEdge.fail(e); }
  edgeBusy = false;
}
map.on('moveend', () => { if (['edge', 'both'].includes(settings.coneMode)) { clearTimeout(edgeTimer); edgeTimer = setTimeout(runEdgeTracker, 900); } });

/* ============================================================
   WIND + METAR
   ============================================================ */
const dWind = src('Wind field', 'Open-Meteo hourly 10 m wind → particles');
let windField = null, windFetching = false, windPending = false, windTimer = null, windHour = 0, windRetry = null;
WindLayer.init(map, $('#windCanvas'));
function windExtent() { const b = map.getBounds(); const cx = (b.getWest() + b.getEast()) / 2, cy = (b.getSouth() + b.getNorth()) / 2, hw = (b.getEast() - b.getWest()) * 0.75, hh = (b.getNorth() - b.getSouth()) * 0.75; return { w: cx - hw, e: cx + hw, s: Math.max(-85, cy - hh), n: Math.min(85, cy + hh) }; }
function viewInside(f) { const b = map.getBounds(); return b.getWest() >= f.w && b.getEast() <= f.e && b.getSouth() >= f.s && b.getNorth() <= f.n; }
async function fetchJSONRetry(url, tries) {
  for (let k = 0; ; k++) {
    try { const r = await fetch(url); const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch (pe) { throw new Error(`Open-Meteo replied ${r.status}: "${txt.trim().slice(0, 120)}"`); } if (j && j.error) throw new Error('Open-Meteo: ' + (j.reason || 'API error')); if (!r.ok) throw new Error(`HTTP ${r.status}`); return j; }
    catch (e) { if (k >= tries) throw e; dWind.note(`${e.message} (${k + 1}/${tries})`); await new Promise(res => setTimeout(res, 2000 * Math.pow(2, k))); }
  }
}
async function loadWind(force) {
  if (!settings.layers.wind || !mapLoaded) return;
  if (!force && windField && viewInside(windField) && Date.now() - windField.at < 30 * 60000) return;
  if (windFetching) { windPending = true; return; } windFetching = true; windPending = false; dWind.start('fetching wind grid…');
  const ext = windExtent(); const nx = 14, ny = 12; const lats = [], lngs = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { lats.push((ext.s + (ext.n - ext.s) * j / (ny - 1)).toFixed(3)); lngs.push((ext.w + (ext.e - ext.w) * i / (nx - 1)).toFixed(3)); }
  try {
    const CH = 42, chunks = []; for (let k = 0; k < lats.length; k += CH) chunks.push([lats.slice(k, k + CH), lngs.slice(k, k + CH)]);
    // Open-Meteo picks a model per point ("best match"); when that model's backend is down it answers
    // "allEndpointsUnavailable". Fall back through explicitly named models served from other backends.
    const MODELS = [['best match', ''], ['GFS+HRRR seamless', '&models=gfs_seamless'], ['ECMWF IFS 0.25°', '&models=ecmwf_ifs025'], ['GFS global', '&models=gfs_global']];
    let results = null, modelUsed = '', lastErr = null;
    for (const [name, q] of MODELS) {
      try {
        const out = [];
        for (const [la, lo] of chunks) out.push(await fetchJSONRetry(`${OM}?latitude=${la.join(',')}&longitude=${lo.join(',')}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&forecast_hours=8&wind_speed_unit=kn&timezone=UTC${q}`, 1));
        results = out; modelUsed = name; break;
      } catch (e) { lastErr = e; dWind.note(`${name}: ${e.message.slice(0, 90)} — trying next model`); }
    }
    if (!results) throw lastErr;
    const pts = results.flatMap(r => Array.isArray(r) ? r : [r]);
    if (pts.length !== lats.length) throw new Error(`expected ${lats.length} points, got ${pts.length}`);
    // hour 0 = the hour containing "now"
    const t0 = pts[0].hourly.time; const nowMs = Date.now(); let i0 = 0; for (let k = 0; k < t0.length; k++) if (Date.parse(t0[k] + 'Z') <= nowMs) i0 = k;
    const NH = Math.min(7, t0.length - i0); const hours = [];
    for (let h = 0; h < NH; h++) {
      const u = new Float32Array(pts.length), v = new Float32Array(pts.length), spd = new Float32Array(pts.length), gust = new Float32Array(pts.length);
      pts.forEach((pt, k) => { const hh = pt.hourly; const sp = hh.wind_speed_10m[i0 + h] || 0, dir = (hh.wind_direction_10m[i0 + h] || 0) * Math.PI / 180; u[k] = -sp * Math.sin(dir); v[k] = -sp * Math.cos(dir); spd[k] = sp; gust[k] = hh.wind_gusts_10m[i0 + h] || 0; });
      hours.push({ u, v, spd, gust, time: Date.parse(t0[i0 + h] + 'Z') });
    }
    windField = Object.assign({ nx, ny, hours, at: Date.now() }, ext);
    WindLayer.setField(windField); windHour = Math.min(windHour, hours.length - 1); $('#windHour').max = hours.length - 1; $('#windHour').value = windHour; WindLayer.setHour(windHour); updateWindLabel(); WindLayer.start(); drawWindHeat();
    const mx = Math.max(...hours[0].spd), mg = Math.max(...hours[0].gust);
    dWind.ok(`${pts.length}-point grid · ${hours.length} h · now max ${Math.round(mx)} kt, gust ${Math.round(mg)}`, `model: ${modelUsed} · ${chunks.length} requests · refreshes when you leave the area or after 30 min`);
  } catch (e) { dWind.fail(e, windField ? 'showing the last good field · retrying in 60 s' : 'retrying in 60 s'); clearTimeout(windRetry); windRetry = setTimeout(() => loadWind(true), 60000); }
  windFetching = false;
  if (windPending) { windPending = false; loadWind(false); } // the view moved while we were fetching
}
function updateWindLabel() {
  const h = windField && windField.hours[windHour]; if (!h) { $('#windHourV').textContent = 'now'; return; }
  const t = new Date(h.time); $('#windHourV').textContent = (windHour === 0 ? 'now' : `+${windHour} h`) + ' · ' + fmtLocal(t);
}
$('#windHour').oninput = (e) => { windHour = Number(e.target.value); WindLayer.setHour(windHour); updateWindLabel(); drawWindHeat(); };
function drawWindHeat() {
  if (!windField || !settings.layers.wind || !settings.windHeat) { if (map.getLayer('windheat')) map.setLayoutProperty('windheat', 'visibility', 'none'); return; }
  const im = WindLayer.heatImage(windField, windHour, 1);
  if (!map.getSource('windheat')) {
    map.addSource('windheat', { type: 'image', url: im.url, coordinates: im.coordinates });
    const anchor = map.getStyle().layers.find(l => l.id.startsWith('radar-')) || map.getStyle().layers.find(l => OVERLAY_IDS.has(l.id) && !['hillshade', 'overlay', 'windheat'].includes(l.id)) || map.getStyle().layers.find(l => l.type === 'symbol');
    map.addLayer({ id: 'windheat', type: 'raster', source: 'windheat', paint: { 'raster-opacity': settings.windHeatOp / 100, 'raster-opacity-transition': { duration: 0 }, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, anchor ? anchor.id : undefined);
  } else { map.getSource('windheat').updateImage({ url: im.url, coordinates: im.coordinates }); }
  map.setLayoutProperty('windheat', 'visibility', 'visible'); placeWindHeat();
}
function placeWindHeat() { if (!map.getLayer('windheat')) return; const a = map.getStyle().layers.find(l => l.id.startsWith('radar-')) || map.getStyle().layers.find(l => OVERLAY_IDS.has(l.id) && !['hillshade', 'overlay', 'windheat'].includes(l.id)) || map.getStyle().layers.find(l => l.type === 'symbol'); if (a && a.id !== 'windheat') map.moveLayer('windheat', a.id); }
overlayBuilders.push(() => { if (windField) drawWindHeat(); });
function windContrast() { WindLayer.setContrast(settings.windHeat ? settings.windHeatOp / 100 : 0); }
// How light the ground under the particles is: style lightness blended toward the overlay's at its opacity.
const STYLE_LIGHT = { dark: 0, fiord: 0.1, positron: 1, liberty: 0.85, bright: 0.9 }, OVERLAY_LIGHT = { topo: 0.9, osm: 0.95, sat: 0.4 };
function windBackground() {
  let l = STYLE_LIGHT[settings.style] ?? 0.5;
  if (settings.overlay !== 'none' && settings.overlay in OVERLAY_LIGHT) { const k = settings.overlayOp / 100; l = l * (1 - k) + OVERLAY_LIGHT[settings.overlay] * k; }
  WindLayer.setBackground(l);
}
$('#windHeat').checked = settings.windHeat !== false; $('#windHeat').onchange = (e) => { settings.windHeat = e.target.checked; saveSettings(); drawWindHeat(); windContrast(); }; windContrast();
$('#windHeatOp').value = settings.windHeatOp; $('#windHeatOpV').textContent = settings.windHeatOp + '%';
$('#windHeatOp').oninput = (e) => { settings.windHeatOp = Number(e.target.value); $('#windHeatOpV').textContent = settings.windHeatOp + '%'; saveSettings(); if (map.getLayer('windheat')) map.setPaintProperty('windheat', 'raster-opacity', settings.windHeatOp / 100); windContrast(); };
function setWindOn(on) {
  $('#windRow').hidden = !on; $('#windLegend').hidden = !on; updateScrubCard();
  if (on) { if (windField) { WindLayer.setField(windField); WindLayer.start(); } loadWind(!windField); }
  else { WindLayer.off(); windField = null; clearTimeout(windRetry); if (map.getLayer('windheat')) map.setLayoutProperty('windheat', 'visibility', 'none'); dWind.note('off'); }
}
map.on('click', (e) => {
  if (!settings.layers.wind || pickTarget != null) return;
  const hits = map.queryRenderedFeatures(e.point, { layers: ['alerts-fill', 'cone-fill', 'edge-fill', 'metar-pt', 'tick-pt', 'places-pt'].filter(id => map.getLayer(id)) });
  if (hits.length) return;
  const sm = WindLayer.sampleAt(e.lngLat.lng, e.lngLat.lat); if (!sm) return;
  const dirFrom = (Math.atan2(-sm[0], -sm[1]) * 180 / Math.PI + 360) % 360;
  new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>${Math.round(sm[2])} kt</b> from ${Math.round(dirFrom)}°<div class="k">10 m wind · ${$('#windHourV').textContent} · Open-Meteo</div></div>`).addTo(map);
});

const dMetar = src('METAR', 'AWC bbox → IEM ASOS fallback');
let metarGeo = fc(), metarTimer = null;
function ensureMetarLayers() {
  if (!map.getSource('metar')) map.addSource('metar', { type: 'geojson', data: metarGeo }); const vis = settings.layers.metar ? 'visible' : 'none';
  if (!map.getLayer('metar-pt')) map.addLayer({ id: 'metar-pt', type: 'circle', source: 'metar', layout: { visibility: vis }, paint: { 'circle-radius': 4, 'circle-color': '#0F1418', 'circle-stroke-color': '#C9D3DC', 'circle-stroke-width': 1.5 } });
  if (!map.getLayer('metar-lbl')) map.addLayer({ id: 'metar-lbl', type: 'symbol', source: 'metar', layout: { visibility: vis, 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-offset': [0.8, 0], 'text-anchor': 'left' }, paint: { 'text-color': '#C9D3DC', 'text-halo-color': '#0F1418', 'text-halo-width': 1.2 } });
}
overlayBuilders.push(ensureMetarLayers);
async function loadMetar() {
  if (map.getZoom() < 5) { dMetar.note('zoom in to 5+ to load stations'); return; }
  dMetar.start(); const b = map.getBounds(); let feats = [], via = '';
  try {
    const j = await getJSON(`${AWC}?bbox=${b.getSouth().toFixed(2)},${b.getWest().toFixed(2)},${b.getNorth().toFixed(2)},${b.getEast().toFixed(2)}&format=json`);
    feats = j.filter(r => isFinite(r.lat) && isFinite(r.lon)).map(r => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id: r.icaoId, label: `${r.icaoId} ${r.wdir ?? '--'}/${r.wspd ?? '--'}${r.wgst ? 'G' + r.wgst : ''}`, raw: r.rawOb, name: r.name } })); via = 'aviationweather.gov';
  } catch (e) {
    const states = Object.entries(STATE_BOX).filter(([st, bx]) => bx[0] < b.getEast() && bx[2] > b.getWest() && bx[1] < b.getNorth() && bx[3] > b.getSouth()).map(x => x[0]).slice(0, 6);
    try {
      const res = await Promise.all(states.map(st => getJSON(`${IEM_CUR}?network=${st}_ASOS`))); const rows = res.flatMap(r => r.data || []);
      feats = rows.filter(r => isFinite(r.lat) && isFinite(r.lon) && r.lon > b.getWest() && r.lon < b.getEast() && r.lat > b.getSouth() && r.lat < b.getNorth()).map(r => { const id = r.station || r.id || '?'; return { type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id, label: `${id} ${r.drct == null ? '--' : Math.round(r.drct)}/${r.sknt == null ? '--' : Math.round(r.sknt)}${r.gust ? 'G' + Math.round(r.gust) : ''}`, raw: r.raw || '', name: r.name || '' } }; });
      via = `IEM ${states.join('/')} (AWC: ${e.message})`;
    } catch (e2) { dMetar.fail(new Error(`AWC: ${e.message} · IEM: ${e2.message}`)); return; }
  }
  metarGeo = fc(feats); ensureMetarLayers(); map.getSource('metar').setData(metarGeo); dMetar.ok(`${feats.length} stations`, via);
}
map.on('click', 'metar-pt', (e) => { const p = e.features[0].properties; new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>${esc(p.id)}</b> <span class="k">${esc(p.name)}</span><div style="margin-top:6px;font-family:var(--mono);font-size:11px">${esc(p.raw)}</div></div>`).addTo(map); });
map.on('moveend', () => { if (settings.layers.wind) { clearTimeout(windTimer); windTimer = setTimeout(() => loadWind(false), 1200); } if (settings.layers.metar) { clearTimeout(metarTimer); metarTimer = setTimeout(loadMetar, 800); } });

/* ============================================================
   OVERLAY + RELIEF
   ============================================================ */
const dOverlay = src('Overlay', 'OpenTopoMap · OSM · Esri imagery');
function applyOverlay() {
  if (map.getLayer('overlay')) map.removeLayer('overlay'); if (map.getSource('overlay')) map.removeSource('overlay');
  if (settings.overlay === 'none') { dOverlay.note('off'); return; }
  const o = OVERLAYS[settings.overlay]; dOverlay.start();
  map.addSource('overlay', { type: 'raster', tiles: o.tiles, tileSize: 256, maxzoom: o.maxzoom, attribution: o.attribution });
  map.addLayer({ id: 'overlay', type: 'raster', source: 'overlay', paint: { 'raster-opacity': settings.overlayOp / 100, 'raster-opacity-transition': { duration: 0 } } }, map.getLayer('hillshade') ? 'hillshade' : anchorBelowRoads(['overlay', 'windheat']));
  map.once('idle', () => { if (settings.overlay !== 'none') dOverlay.ok(`${settings.overlay} at ${settings.overlayOp}%`, o.attribution); });
}
$('#overlaySel').value = settings.overlay; $('#overlaySel').onchange = (e) => { settings.overlay = e.target.value; saveSettings(); applyOverlay(); windBackground(); };
$('#overlayOp').value = settings.overlayOp; $('#overlayOpV').textContent = settings.overlayOp + '%';
$('#overlayOp').oninput = (e) => { settings.overlayOp = Number(e.target.value); $('#overlayOpV').textContent = settings.overlayOp + '%'; saveSettings(); if (map.getLayer('overlay')) map.setPaintProperty('overlay', 'raster-opacity', settings.overlayOp / 100);  windBackground(); };
overlayBuilders.push(() => { if (settings.overlay !== 'none') applyOverlay(); });
windBackground();
const dTerrain = src('Relief', 'AWS terrain tiles → hillshade');
function toggleTerrain(on) {
  if (on) {
    dTerrain.start();
    if (!map.getSource('terrain-dem')) map.addSource('terrain-dem', { type: 'raster-dem', tiles: [TERRAIN], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: 'Terrain: Mapzen/AWS' });
    if (!map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'terrain-dem', paint: { 'hillshade-exaggeration': settings.hs / 100, 'hillshade-shadow-color': '#05080B', 'hillshade-highlight-color': '#5C7080', 'hillshade-accent-color': '#0F1418', 'hillshade-illumination-direction': 315 } }, anchorBelowRoads(['hillshade', 'overlay', 'windheat']));
    if (map.getLayer('overlay')) map.moveLayer('overlay', 'hillshade');
    setTimeout(() => { if (settings.layers.terrain && map.getLayer('hillshade')) dTerrain.ok(`hillshade at ${settings.hs}%`); }, 2500);
  } else { if (map.getLayer('hillshade')) map.removeLayer('hillshade'); if (map.getSource('terrain-dem')) map.removeSource('terrain-dem'); dTerrain.note('off'); }
}
$('#hsStrength').value = settings.hs; $('#hsStrengthV').textContent = settings.hs + '%';
$('#hsStrength').oninput = (e) => { settings.hs = Number(e.target.value); $('#hsStrengthV').textContent = settings.hs + '%'; saveSettings(); if (map.getLayer('hillshade')) map.setPaintProperty('hillshade', 'hillshade-exaggeration', settings.hs / 100); };
overlayBuilders.push(() => { if (settings.layers.terrain) toggleTerrain(true); });

/* ============================================================
   ROUTE — straight line / OSRM / Google, ticks, saved routes, places
   ============================================================ */
const dRoute = src('Route', 'OSRM demo · Google Routes · straight line');
const dFcst = src('Point forecast', 'api.weather.gov hourly');
let routePts = [null, null], routeGeo = fc(), tickGeo = fc(), pickTarget = null, routeMode = store.get('mode', 'osrm'), currentRoute = null;
$('#gkey').value = store.get('gkey', ''); $('#gkey').onchange = (e) => store.set('gkey', e.target.value.trim());
function ensureRouteLayers() {
  if (!map.getSource('route')) map.addSource('route', { type: 'geojson', data: routeGeo }); if (!map.getSource('ticks')) map.addSource('ticks', { type: 'geojson', data: tickGeo });
  if (!map.getLayer('route-casing')) map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B1014', 'line-width': 8, 'line-opacity': 0.7 } });
  if (!map.getLayer('route-line')) map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#57B8E0', 'line-width': 4 } });
  if (!map.getLayer('tick-pt')) map.addLayer({ id: 'tick-pt', type: 'circle', source: 'ticks', paint: { 'circle-radius': 5, 'circle-color': '#0F1418', 'circle-stroke-color': '#57B8E0', 'circle-stroke-width': 2.5 } });
  if (!map.getLayer('tick-lbl')) map.addLayer({ id: 'tick-lbl', type: 'symbol', source: 'ticks', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-allow-overlap': true }, paint: { 'text-color': '#BFE6F5', 'text-halo-color': '#0F1418', 'text-halo-width': 1.2 } });
}
overlayBuilders.push(ensureRouteLayers);
$$('#modeSeg button').forEach(b => { b.classList.toggle('on', b.dataset.mode === routeMode); b.onclick = () => { routeMode = b.dataset.mode; store.set('mode', routeMode); $$('#modeSeg button').forEach(x => x.classList.toggle('on', x === b)); $('#gkeyRow').hidden = routeMode !== 'drive'; }; });
$('#gkeyRow').hidden = routeMode !== 'drive';
$('#pickFrom').onclick = () => armPick(0); $('#pickTo').onclick = () => armPick(1);
function armPick(i) { pickTarget = i; closeSheet(); banner(i === 0 ? 'Tap the map for the origin' : 'Tap the map for the destination', 'or reopen Route to type a place'); map.getCanvas().style.cursor = 'crosshair'; }
map.on('click', (e) => {
  if (pickTarget == null) return;
  const ll = [e.lngLat.lng, e.lngLat.lat]; routePts[pickTarget] = ll; (pickTarget === 0 ? $('#fromTxt') : $('#toTxt')).value = `${ll[1].toFixed(4)},${ll[0].toFixed(4)}`;
  const next = pickTarget === 0 && !routePts[1] ? 1 : null; pickTarget = null; map.getCanvas().style.cursor = ''; $('#banner').hidden = true;
  if (next != null) armPick(next); else { showSheet('route'); $('#routeHint').textContent = 'Origin and destination set — Build route.'; }
});
function parseLoc(txt) { const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(txt || ''); return m ? [parseFloat(m[2]), parseFloat(m[1])] : null; }
function endpoint(txt, pt) { const loc = parseLoc(txt); if (loc) return { ll: loc }; if (txt && txt.trim()) return { address: txt.trim() }; if (pt) return { ll: pt }; return null; }
$('#useLoc').onclick = () => {
  if (myPos) { routePts[0] = myPos; $('#fromTxt').value = `${myPos[1].toFixed(4)},${myPos[0].toFixed(4)}`; $('#routeHint').textContent = 'Origin set from GPS.'; return; }
  if (!navigator.geolocation) { $('#routeHint').textContent = 'Geolocation not available.'; return; }
  $('#routeHint').textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(p => { setMyPos([p.coords.longitude, p.coords.latitude], p.coords.accuracy); routePts[0] = myPos; $('#fromTxt').value = `${myPos[1].toFixed(4)},${myPos[0].toFixed(4)}`; $('#routeHint').textContent = `Origin set from GPS (±${Math.round(p.coords.accuracy)} m).`; }, err => { $('#routeHint').textContent = 'GPS failed: ' + err.message; }, { enableHighAccuracy: true, timeout: 10000 });
};
$('#routeGo').onclick = () => buildRoute();
async function buildRoute() {
  const o = endpoint($('#fromTxt').value, routePts[0]), d = endpoint($('#toTxt').value, routePts[1]);
  if (!o || !d) { $('#routeHint').textContent = 'Need an origin and a destination (type, GPS, or MAP).'; return; }
  let mode = routeMode; if ((o.address || d.address) && mode === 'line') mode = $('#gkey').value.trim() ? 'drive' : 'osrm';
  if (mode === 'line') return buildLine(o.ll, d.ll);
  if (mode === 'drive') return buildGoogle(o, d);
  return buildOSRM(o, d);
}
function fmtOffset(min) { const h = Math.floor(min / 60), m = min % 60; return `+${h}:${pad(m)}`; }
function ticksAlong(coords, cumSec, everyMin) {
  const out = []; const total = cumSec[cumSec.length - 1];
  for (let t = everyMin * 60; t < total && out.length < 60; t += everyMin * 60) { let i = 1; while (i < cumSec.length && cumSec[i] < t) i++; const f = (t - cumSec[i - 1]) / Math.max(1, cumSec[i] - cumSec[i - 1]); out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f] }, properties: { label: fmtOffset(t / 60), sec: t } }); }
  out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { label: 'arrive ' + fmtOffset(Math.round(total / 60)), sec: total } });
  return out;
}
function finishRoute(coords, cum, summary, meta) {
  const every = Math.max(5, parseInt($('#tickMin').value) || 30);
  routeGeo = fc([{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }]); tickGeo = fc(ticksAlong(coords, cum, every));
  ensureRouteLayers(); map.getSource('route').setData(routeGeo); map.getSource('ticks').setData(tickGeo);
  routePts = [coords[0], coords[coords.length - 1]]; currentRoute = meta;
  const bb = coords.reduce((b, c) => [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { top: 100, bottom: 300, left: 40, right: 40 }, duration: 800 });
  $('#pillTitle').textContent = meta.title; $('#pillSub').textContent = summary; $('#routeHint').textContent = 'Built: ' + summary; closeSheet();
}
function buildLine(a, b) {
  if (!a || !b) { $('#routeHint').textContent = 'Hike/bike needs coordinates: use GPS or MAP for both ends.'; return; }
  dRoute.start(); const pace = Math.max(0.5, parseFloat($('#pace').value) || 5); const n = 40, coords = [];
  for (let i = 0; i <= n; i++) coords.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]) / (pace * 1000 / 3600));
  const km = haversine(a, b) / 1000, min = Math.round(cum[cum.length - 1] / 60);
  finishRoute(coords, cum, `${km.toFixed(1)} km · ${Math.floor(min / 60)} h ${pad(min % 60)} at ${pace} km/h`, { title: 'Hike / bike', mode: 'line', from: $('#fromTxt').value, to: $('#toTxt').value, pace });
  dRoute.ok(`straight line ${km.toFixed(1)} km`);
}
function decodePolyline(str) { let i = 0, lat = 0, lng = 0; const out = []; while (i < str.length) { let b, s = 0, r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20); lat += (r & 1) ? ~(r >> 1) : (r >> 1); s = 0; r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20); lng += (r & 1) ? ~(r >> 1) : (r >> 1); out.push([lng / 1e5, lat / 1e5]); } return out; }
async function geocode(q) { const j = await getJSON(`${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1`); if (!j.length) throw new Error(`could not find "${q}"`); return [parseFloat(j[0].lon), parseFloat(j[0].lat)]; }
function titleFor(o, d) { const s = (x) => x.address ? x.address.split(',')[0] : 'pin'; return `${s(o)} → ${s(d)}`; }
async function buildOSRM(o, d) {
  dRoute.start('OSRM…'); $('#routeHint').textContent = 'Resolving places and routing…';
  try {
    const a = o.ll || await geocode(o.address), b = d.ll || await geocode(d.address);
    const j = await getJSON(`${OSRM}${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=polyline&annotations=duration&steps=false`);
    if (j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error('OSRM: ' + (j.message || j.code || 'no route'));
    const route = j.routes[0]; const coords = decodePolyline(route.geometry); const durs = route.legs.flatMap(l => (l.annotation && l.annotation.duration) || []); const cum = [0];
    if (durs.length === coords.length - 1) { for (const dd of durs) cum.push(cum[cum.length - 1] + dd); } else { let tot = 0; const seg = []; for (let i = 1; i < coords.length; i++) { const x = haversine(coords[i - 1], coords[i]); seg.push(x); tot += x; } for (const x of seg) cum.push(cum[cum.length - 1] + route.duration * (x / tot)); }
    const km = route.distance / 1000, min = Math.round(route.duration / 60);
    finishRoute(coords, cum, `${km.toFixed(0)} km · ${Math.floor(min / 60)} h ${pad(min % 60)} · free-flow`, { title: titleFor(o, d), mode: 'osrm', from: $('#fromTxt').value, to: $('#toTxt').value });
    dRoute.ok(`OSRM ${km.toFixed(0)} km`, 'demo server, free-flow times');
  } catch (e) { dRoute.fail(e); $('#routeHint').textContent = 'Route failed — ' + e.message; }
}
async function buildGoogle(o, d) {
  const key = $('#gkey').value.trim(); if (!key) { $('#routeHint').textContent = 'Google mode needs an API key — or switch to Drive (OSRM).'; return; }
  dRoute.start('Google Routes…'); $('#routeHint').textContent = 'Asking Google Routes…';
  try {
    const wp = (x) => x.address ? { address: x.address } : { location: { latLng: { latitude: x.ll[1], longitude: x.ll[0] } } };
    const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.staticDuration' }, body: JSON.stringify({ origin: wp(o), destination: wp(d), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', polylineQuality: 'HIGH_QUALITY', departureTime: new Date(Date.now() + 60000).toISOString() }) });
    const txt = await r.text();
    if (!r.ok) { let msg = txt.slice(0, 200); try { const ej = JSON.parse(txt); if (ej.error) msg = `${ej.error.status || r.status}: ${ej.error.message}`; } catch (pe) {} if (r.status === 403) msg += ' — enable Routes API and check key restrictions (a key restricted by HTTP referrer must include this site)'; throw new Error(msg); }
    const j = JSON.parse(txt); const route = j.routes && j.routes[0]; if (!route) throw new Error('no route returned');
    const coords = [], cum = [0];
    for (const leg of route.legs) for (const st of leg.steps) { const pts = decodePolyline(st.polyline.encodedPolyline); const dur = parseFloat(st.staticDuration); const segLen = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const x = haversine(pts[i - 1], pts[i]); segLen.push(x); tot += x; } if (!coords.length) coords.push(pts[0]); for (let i = 1; i < pts.length; i++) { coords.push(pts[i]); cum.push(cum[cum.length - 1] + dur * (tot ? segLen[i - 1] / tot : 1 / (pts.length - 1))); } }
    const km = route.distanceMeters / 1000, min = Math.round(parseFloat(route.duration) / 60);
    finishRoute(coords, cum, `${km.toFixed(0)} km · ${Math.floor(min / 60)} h ${pad(min % 60)} · traffic-aware`, { title: titleFor(o, d), mode: 'drive', from: $('#fromTxt').value, to: $('#toTxt').value });
    dRoute.ok(`Google ${km.toFixed(0)} km`);
  } catch (e) { dRoute.fail(e); $('#routeHint').textContent = 'Google Routes failed — ' + e.message; }
}
$('#routeClear').onclick = () => { routePts = [null, null]; routeGeo = fc(); tickGeo = fc(); currentRoute = null; ensureRouteLayers(); map.getSource('route').setData(routeGeo); map.getSource('ticks').setData(tickGeo); $('#fromTxt').value = ''; $('#toTxt').value = ''; $('#pillTitle').textContent = 'Set a route'; $('#pillSub').textContent = 'Driving, hike or bike · storms and alerts on the way'; $('#routeHint').textContent = 'Cleared.'; };
map.on('click', 'tick-pt', async (e) => {
  const f = e.features[0]; const [lng, lat] = f.geometry.coordinates; const at = new Date(Date.now() + f.properties.sec * 1000);
  const pop = new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<div class="pp"><b>${esc(f.properties.label)}</b><div class="k">fetching NWS hourly…</div></div>`).addTo(map); dFcst.start();
  try {
    const pt = await getJSON(`${NWS}/points/${lat.toFixed(4)},${lng.toFixed(4)}`); const hr = await getJSON(pt.properties.forecastHourly);
    const per = hr.properties.periods.find(p => new Date(p.endTime) > at) || hr.properties.periods[0]; const pop_ = per.probabilityOfPrecipitation && per.probabilityOfPrecipitation.value;
    pop.setHTML(`<div class="pp"><b>${esc(f.properties.label)} · ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b><div class="k">NWS hourly · ${esc(pt.properties.relativeLocation.properties.city)}, ${esc(pt.properties.relativeLocation.properties.state)}</div><table><tr><td>Wind</td><td>${esc(per.windSpeed)} ${esc(per.windDirection)}</td></tr><tr><td>Precip</td><td>${pop_ == null ? '—' : pop_ + '%'}</td></tr><tr><td>Temp</td><td>${per.temperature}°${per.temperatureUnit}</td></tr><tr><td colspan="2">${esc(per.shortForecast)}</td></tr></table></div>`);
    dFcst.ok(esc(per.shortForecast));
  } catch (er) { dFcst.fail(er); pop.setHTML(`<div class="pp"><b>${esc(f.properties.label)}</b><div class="k">forecast failed: ${esc(er.message)}</div></div>`); }
});

/* saved routes */
function renderSavedRoutes() {
  const list = store.get('routes', []); const ul = $('#savedRoutes'); ul.innerHTML = list.length ? '' : '<li class="empty">Nothing saved yet — build a route and tap Save.</li>';
  list.forEach((r, i) => { const li = document.createElement('li'); li.innerHTML = `<div class="t"><b>${esc(r.title)}</b><small>${esc(r.from)} → ${esc(r.to)} · ${r.mode}</small></div><button>LOAD</button><button class="del">✕</button>`;
    li.querySelector('button').onclick = () => { $('#fromTxt').value = r.from; $('#toTxt').value = r.to; if (r.pace) $('#pace').value = r.pace; routeMode = r.mode; $$('#modeSeg button').forEach(x => x.classList.toggle('on', x.dataset.mode === r.mode)); routePts = [parseLoc(r.from), parseLoc(r.to)]; buildRoute(); };
    li.querySelector('.del').onclick = () => { list.splice(i, 1); store.set('routes', list); renderSavedRoutes(); }; ul.appendChild(li); });
}
$('#routeSave').onclick = () => { if (!currentRoute) { $('#routeHint').textContent = 'Build a route first, then save it.'; return; } const list = store.get('routes', []); const name = prompt('Name this route', currentRoute.title) || currentRoute.title; list.unshift(Object.assign({}, currentRoute, { title: name })); store.set('routes', list.slice(0, 20)); renderSavedRoutes(); $('#routeHint').textContent = 'Saved.'; };
renderSavedRoutes();

/* places */
let placesGeo = fc();
function ensurePlaceLayers() {
  if (!map.getSource('places')) map.addSource('places', { type: 'geojson', data: placesGeo });
  if (!map.getLayer('places-pt')) map.addLayer({ id: 'places-pt', type: 'circle', source: 'places', paint: { 'circle-radius': 6, 'circle-color': '#E9B437', 'circle-stroke-color': '#0F1418', 'circle-stroke-width': 2 } });
  if (!map.getLayer('places-lbl')) map.addLayer({ id: 'places-lbl', type: 'symbol', source: 'places', layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.2], 'text-anchor': 'top' }, paint: { 'text-color': '#F1D48A', 'text-halo-color': '#0F1418', 'text-halo-width': 1.2 } });
}
overlayBuilders.push(ensurePlaceLayers);
function renderPlaces() {
  const list = store.get('places', []); const ul = $('#places'); ul.innerHTML = list.length ? '' : '<li class="empty">Home, trailhead, the field site — tap to jump there.</li>';
  placesGeo = fc(list.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.ll }, properties: { name: p.name } }))); if (mapLoaded) { ensurePlaceLayers(); map.getSource('places').setData(placesGeo); }
  list.forEach((p, i) => { const here = alertsGeo.features.filter(f => f.properties.warning && inGeom(p.ll, f.geometry)); const li = document.createElement('li'); li.innerHTML = `<div class="t"><b>${esc(p.name)}</b><small>${p.ll[1].toFixed(3)}, ${p.ll[0].toFixed(3)}${here.length ? ' · ⚠ ' + esc(here[0].properties.event) : ''}</small></div><button>GO</button><button class="del">✕</button>`;
    li.querySelector('button').onclick = () => { map.flyTo({ center: p.ll, zoom: Math.max(map.getZoom(), 8) }); closeSheet(); }; li.querySelector('.del').onclick = () => { list.splice(i, 1); store.set('places', list); renderPlaces(); }; ul.appendChild(li); });
}
function addPlace(ll, defName) { const name = prompt('Name this place', defName); if (!name) return; const list = store.get('places', []); list.unshift({ name, ll }); store.set('places', list.slice(0, 30)); renderPlaces(); }
$('#placeAddGPS').onclick = () => { if (!myPos) { $('#routeHint').textContent = 'Tap LOCATE first so I know where you are.'; return; } addPlace(myPos, 'My location'); };
$('#placeAddCenter').onclick = () => addPlace([map.getCenter().lng, map.getCenter().lat], 'Map centre');
renderPlaces();

/* ============================================================
   orchestration
   ============================================================ */
function buildAll() { overlayBuilders.forEach(fn => fn()); Object.keys(settings.layers).forEach(applyLayerState); buildRadar(); loadAlerts(); loadProbSevere(); renderPlaces(); }
$('#retest').onclick = () => { if (mapLoaded) buildAll(); };
setInterval(() => { if (mapLoaded && !playing) { loadAlerts(); loadProbSevere(); } }, 120000);
setInterval(() => { if (mapLoaded && !playing && curFrame === lastObserved) buildRadar(); }, 300000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
