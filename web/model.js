// Model objekta i izvedba: čisti podaci i geometrija (bez three.js), da ih koriste i 3D prikaz i troškovnik.
// Tlocrt: x udesno, z prema dolje (kao na nacrtu); y = visina. Sve u metrima.
// Cijene u katalogu su OKVIRNE tržišne cijene (EUR bez PDV-a, Hrvatska 2026.) i uvijek čekaju potvrdu korisnika.
// Provjera statike je INFORMATIVNA (pravila za omeđeno ziđe); konstrukciju dokazuje ovlašteni inženjer.

export const DEFAULT_COLORS = { fasada: '#efe9df', cokl: '#77736c', krov: '#9b4a31', stolarija: '#33363b', limarija: '#4a4f55', teren: '#8fa468' };
export const COLOR_PRESETS = [
  { n: 'Klasična (bijela + crveni crijep)', c: { fasada: '#efe9df', cokl: '#77736c', krov: '#9b4a31', stolarija: '#33363b', limarija: '#4a4f55' } },
  { n: 'Moderna (siva + antracit)', c: { fasada: '#d6d5d1', cokl: '#3f4246', krov: '#3b3e43', stolarija: '#2a2c30', limarija: '#2a2c30' } },
  { n: 'Mediteranska (pijesak + terakota)', c: { fasada: '#ead8b9', cokl: '#9b8b74', krov: '#bb6440', stolarija: '#f2f0ea', limarija: '#8a6a4a' } },
  { n: 'Alpska (bijela + drvo)', c: { fasada: '#f4f2ec', cokl: '#5d5a55', krov: '#4b4440', stolarija: '#7a5233', limarija: '#4b4440' } },
];

/* ---------- zadani model iz priloženih nacrta (obiteljska kuća P+1) ---------- */
export function demoModel() {
  return {
    v: 2, src: 'nacrt',
    fp: [[0, 0], [8.75, 0], [8.75, 6.06], [3.22, 7.0], [0, 7.0]],
    floors: 2, storeyH: 2.97, eave: 5.78, ridge: 8.43, ridgeX: 4.15, ov: 0.8, wallT: 0.4, base: 0.45,
    roof: { type: 'gable' },
    // e = indeks zida (0 SI, 1 JI, 2-3 JZ, 4 SZ), u = sredina otvora od početka zida, s = parapet od ±0,00
    openings: [
      { e: 0, u: 4.15, w: 1.88, h: 1.0, s: 1.3, t: 'win' }, { e: 0, u: 1.25, w: 0.55, h: 1.0, s: 1.3, t: 'win' },
      { e: 0, u: 1.5, w: 1.25, h: 1.01, s: 3.85, t: 'win' }, { e: 0, u: 3.95, w: 0.6, h: 0.6, s: 6.75, t: 'win' },
      { e: 1, u: 3.2, w: 3.6, h: 2.21, s: 0, t: 'slide' }, { e: 1, u: 1.75, w: 2.6, h: 2.21, s: 2.97, t: 'slide' }, { e: 1, u: 4.3, w: 1.28, h: 1.21, s: 3.97, t: 'win' },
      { e: 2, u: 4.8, w: 0.6, h: 0.6, s: 6.85, t: 'win' },
      { e: 3, u: 1.32, w: 0.6, h: 0.6, s: 1.0, t: 'win' }, { e: 3, u: 1.32, w: 0.6, h: 0.6, s: 4.5, t: 'win' },
      { e: 4, u: 5.4, w: 1.25, h: 2.21, s: 0, t: 'door' }, { e: 4, u: 5.4, w: 1.25, h: 1.01, s: 3.85, t: 'win' },
      { e: 4, u: 2.65, w: 0.6, h: 0.6, s: 1.85, t: 'win' }, { e: 4, u: 2.65, w: 0.6, h: 0.6, s: 2.75, t: 'win' },
    ],
    balcony: { x0: 8.75, z0: 0.4, x1: 10.75, z1: 3.1, y: 2.97 },
    canopy: { x0: -1.35, z0: 0.95, x1: 0, z1: 2.25, y: 2.75 },
    chimneys: [{ x: 4.75, z: 4.6, s: 0.5, top: 9.15 }, { x: 0.75, z: 1.2, s: 0.45, top: 7.05 }],
    colors: { ...DEFAULT_COLORS },
    labels: ['Pročelje sjeveroistok', 'Pročelje jugoistok', 'Pročelje jugozapad', 'Pročelje jugozapad', 'Pročelje sjeverozapad'],
  };
}
// okvirni model iz dimenzija (kuća ili stambena zgrada): pravokutnik, prozori ravnomjerno po etažama
export function autoModel(d = {}) {
  const { W, D, floors, storeyH, pitch, ov } = clampDims({ W: 10, D: 8, floors: 2, storeyH: 2.9, pitch: 30, ov: 0.6, ...d });
  const eave = floors * storeyH + 0.2, ridgeX = W / 2, ridge = eave + Math.tan(pitch * Math.PI / 180) * ridgeX;
  const fp = [[0, 0], [W, 0], [W, D], [0, D]];
  const openings = [], big = floors >= 3;
  fp.forEach((p, e) => {
    const q = fp[(e + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.max(1, Math.floor(L / 3));
    for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
      const u = (k + 0.5) * L / n;
      if (e === 3 && f === 0 && k === Math.floor(n / 2)) openings.push({ e, u, w: big ? 1.6 : 1.1, h: big ? 2.3 : 2.15, s: 0, t: 'door' });
      else openings.push({ e, u, w: big && k % 2 ? 1.6 : 1.2, h: big && k % 2 ? 1.5 : 1.3, s: f * storeyH + 0.9, t: 'win' });
    }
  });
  return { v: 2, src: 'auto', fp, floors, storeyH, eave, ridge, ridgeX, ov, wallT: 0.4, base: big ? 0.6 : 0.4, roof: { type: 'gable' }, openings, balcony: null, canopy: null, chimneys: [{ x: W * 0.35, z: D * 0.4, s: 0.5, top: ridge + 0.6 }], colors: { ...DEFAULT_COLORS }, labels: ['Pročelje 1 (sjever)', 'Pročelje 2 (istok)', 'Pročelje 3 (jug)', 'Pročelje 4 (zapad)'] };
}

/* ---------- vrste objekta i dimenzije ---------- */
// Uobičajene polazne dimenzije (nisu propis): korisnik svaku može promijeniti. build = uobičajena izvedba za tu vrstu.
export const TYPES = [
  { id: 'nacrt', n: 'Po nacrtu', note: 'Model složen iz priloženih nacrta', demo: true, build: { krovOblik: 'gable', pokrov: 'crijep', konstrukcija: 'opeka25', temelji: 'trakasti' } },
  { id: 'ai', n: 'Iz nacrta (AI)', note: 'Model koji je AI složio iz učitanih nacrta', ai: true },
  { id: 'prizemnica', n: 'Prizemnica', d: { W: 12, D: 9, floors: 1, storeyH: 2.9, pitch: 25, ov: 0.6 }, build: { krovOblik: 'hip', konstrukcija: 'opeka25', temelji: 'trakasti' } },
  { id: 'kuca', n: 'Obiteljska kuća P+1', d: { W: 10, D: 8, floors: 2, storeyH: 2.9, pitch: 30, ov: 0.6 }, build: { krovOblik: 'gable', konstrukcija: 'opeka25', temelji: 'trakasti' } },
  { id: 'zgrada3', n: 'Manja stambena zgrada P+2', d: { W: 16, D: 11, floors: 3, storeyH: 2.95, pitch: 25, ov: 0.5 }, build: { krovOblik: 'hip', konstrukcija: 'opeka30', temelji: 'trakasti' } },
  { id: 'zgrada5', n: 'Stambena zgrada P+4', d: { W: 22, D: 13, floors: 5, storeyH: 3.0, pitch: 20, ov: 0.4 }, build: { krovOblik: 'flat', konstrukcija: 'ab', temelji: 'ploca' } },
];
export const DIM_LIM = { W: [4, 40], D: [4, 30], floors: [1, 8], storeyH: [2.4, 4.5], pitch: [5, 55], ov: [0, 1.5] };
export function clampDims(d) {
  const o = {};
  Object.entries(DIM_LIM).forEach(([k, [lo, hi]]) => { let v = Number(d[k]); if (!isFinite(v) || !v && k !== 'ov') return; if (k === 'floors') v = Math.round(v); o[k] = Math.min(hi, Math.max(lo, v)); });
  return o;
}
export const etaze = (n) => n <= 1 ? 'P' : 'P+' + (n - 1);
// stvarne dimenzije modela (za obrazac)
export function modelDims(m) {
  const b = bbox(m), rise = (m.ridge - m.eave) / Math.max(0.1, m.ridgeX - b.x0);
  return { W: rd(b.x1 - b.x0), D: rd(b.z1 - b.z0), floors: floorsAll(m), storeyH: rd(m.storeyH), pitch: Math.round(Math.atan(rise) * 1800 / Math.PI) / 10, ov: rd(m.ov) };
}
const rd = (n) => Math.round(n * 100) / 100;
// Promjena dimenzija modela složenog iz nacrta: tlocrt se rasteže, otvori zadržavaju veličinu i slijede zid,
// etaže se dodaju (ponavlja se zadnja) ili oduzimaju, visina etaže pomiče otvore. Uvijek se polazi od izvornog modela.
export function resizeModel(base, dims) {
  const d = { ...modelDims(base), ...clampDims(dims || {}) }, b = bbox(base), E0 = edges(base);
  const sx = d.W / (b.x1 - b.x0), sz = d.D / (b.z1 - b.z0), h = d.storeyH, h0 = base.storeyH, n = d.floors, n0 = base.floors;
  const X = (x) => b.x0 + (x - b.x0) * sx, Z = (z) => b.z0 + (z - b.z0) * sz;
  const m = JSON.parse(JSON.stringify(base));
  m.fp = base.fp.map(([x, z]) => [rd(X(x)), rd(Z(z))]);
  const E1 = edges(m), rise0 = base.ridge - base.eave;
  m.floors = n; m.storeyH = h; m.eave = rd(n * h + (base.eave - n0 * h0)); m.ridgeX = rd(X(base.ridgeX)); m.ov = d.ov;
  m.ridge = rd(m.eave + Math.tan(d.pitch * Math.PI / 180) * (m.ridgeX - b.x0));
  const rise = m.ridge - m.eave, out = [];
  const fits = (o) => !out.some((q) => q.e === o.e && Math.abs(q.u - o.u) < (q.w + o.w) / 2 + 0.15 && q.s < o.s + o.h && o.s < q.s + q.h);
  base.openings.forEach((o) => {
    const L = E1[o.e].L, k = L / E0[o.e].L; if (L < o.w + 0.6) return;
    const u = Math.min(L - o.w / 2 - 0.3, Math.max(o.w / 2 + 0.3, o.u * k));
    const put = (s) => { const c = { ...o, u: rd(u), s: rd(s) }; if (fits(c)) out.push(c); };
    if (o.s >= base.eave - 0.05) return put(m.eave + (o.s - base.eave) * (rise / Math.max(0.1, rise0))); // zabatni prozor
    const f = Math.min(n0 - 1, Math.floor((o.s + 0.01) / h0)), rel = h >= h0 ? o.s - f * h0 : Math.min(o.s - f * h0, Math.max(0, h - o.h - 0.25));
    if (f === 0) { if (o.s + o.h <= m.eave) put(rel); return; }
    for (let ff = 1; ff < n; ff++) if (Math.min(ff, n0 - 1) === f) put(ff * h + rel);
  });
  m.openings = out;
  if (base.balcony) { const B = base.balcony, lvl = Math.round(B.y / h0); m.balcony = lvl < n ? { x0: rd(X(B.x0)), x1: rd(X(B.x0) + (B.x1 - B.x0)), z0: rd(Z(B.z0)), z1: rd(Z(B.z0) + (B.z1 - B.z0)), y: rd(lvl * h) } : null; }
  if (base.canopy) { const K = base.canopy; m.canopy = { ...K, z0: rd(Z(K.z0)), z1: rd(Z(K.z0) + (K.z1 - K.z0)), y: rd(Math.min(K.y, h - 0.2)) }; }
  m.chimneys = (base.chimneys || []).map((c) => ({ ...c, x: rd(X(c.x)), z: rd(Z(c.z)), top: rd(c.top + (m.ridge - base.ridge)) }));
  m.resized = ['W', 'D', 'floors', 'storeyH', 'pitch', 'ov'].some((k) => Math.abs(d[k] - modelDims(base)[k]) > 0.005);
  return m;
}

/* ---------- model iz AI čitanja nacrta ---------- */
// očisti obris: makni preblizu točke, poravnaj gotovo vodoravne/okomite stranice, makni kolinearne točke
export function cleanPoly(pts) {
  let fp = (pts || []).map((p) => [Number(p[0]), Number(p[1])]).filter((p) => isFinite(p[0]) && isFinite(p[1]));
  fp = fp.filter((p, i) => { const q = fp[(i + fp.length - 1) % fp.length]; return i === 0 || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.25; });
  for (let pass = 0; pass < 2; pass++) fp.forEach((p, i) => { const q = fp[(i + 1) % fp.length], dx = Math.abs(q[0] - p[0]), dz = Math.abs(q[1] - p[1]); if (dx < 0.4 && dz > 2 * dx) q[0] = p[0]; else if (dz < 0.4 && dx > 2 * dz) q[1] = p[1]; });
  fp = fp.filter((p, i) => { const a = fp[(i + fp.length - 1) % fp.length], c = fp[(i + 1) % fp.length]; return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 0.05; });
  const x0 = Math.min(...fp.map((p) => p[0])), z0 = Math.min(...fp.map((p) => p[1]));
  return fp.map((p) => [Math.round((p[0] - x0) * 20) / 20, Math.round((p[1] - z0) * 20) / 20]);
}
// Specifikacija iz AI čitanja (ili ručno ispravljena), sve u metrima:
// { fp (obris podnožja; x udesno, z dolje kao na tlocrtu), roof: flat|gable|hip|mono, ridgeDir: 'x'|'z', ridgeH, ov,
//   parts: [{ name, floors, heights: [visina svake etaže], inset: null | { g, d, dl, l } }] odozdo prema gore
//          (inset = uvlaka gornjeg dijela od ruba dijela ispod: gore, desno, dolje, lijevo na tlocrtu),
//   facades: [{ side: gore|desno|dolje|lijevo, name, openings: [{ x: 0..1 slijeva nadesno, s (od ±0,00), w, h, t }] }] }
// Stari oblik (floors, storeyH, wallTop bez parts) i dalje radi kao jedan dio.
export function normSpec(a) {
  const lim = (v, lo, hi, d) => (isFinite(+v) && +v > 0 ? Math.min(hi, Math.max(lo, +v)) : d);
  const roof = ['flat', 'gable', 'hip', 'mono'].includes(a.roof) ? a.roof : 'flat';
  let parts = Array.isArray(a.parts) && a.parts.length ? a.parts : [{ floors: a.floors, heights: [], storeyH: a.storeyH, wallTop: a.wallTop }];
  parts = parts.slice(0, 4).map((p, i) => {
    const hs = (Array.isArray(p.heights) ? p.heights : []).map((h) => lim(h, 2.2, 9, 0)).filter(Boolean);
    let floors = Math.round(lim(p.floors, 1, 12, hs.length || 1));
    let h = lim(p.storeyH, 2.2, 9, 0);
    if (!h && !hs.length && +p.wallTop > 0) h = Math.min(9, Math.max(2.4, (+p.wallTop - (roof === 'flat' ? 0.6 : 0.2)) / floors));
    const heights = Array.from({ length: floors }, (_, f) => rd(hs[f] ?? hs[hs.length - 1] ?? h ?? 2.9) || 2.9);
    const ins = i > 0 ? p.inset || {} : null, n0 = (v) => (isFinite(+v) && +v > 0 ? rd(Math.min(40, +v)) : 0);
    return { name: String(p.name || (i ? 'Gornji dio ' + i : 'Podnožje')).slice(0, 40), floors, heights, inset: ins ? { g: n0(ins.g), d: n0(ins.d), dl: n0(ins.dl), l: n0(ins.l) } : null };
  });
  return { fp: cleanPoly(a.fp), roof, ridgeDir: a.ridgeDir === 'x' ? 'x' : 'z', ridgeH: isFinite(+a.ridgeH) ? +a.ridgeH : null, ov: isFinite(+a.ov) && a.ov != null ? Math.min(1.5, Math.max(0, +a.ov)) : 0.5, parts, facades: Array.isArray(a.facades) ? a.facades : [] };
}
// promjena mjera na specifikaciji (širina/dubina rastežu obris; dijelovi se zamjenjuju ako su zadani)
export function specWithDims(spec, d = {}) {
  const sp = JSON.parse(JSON.stringify(spec)), b = bbox({ fp: sp.fp });
  const W = isFinite(+d.W) && +d.W > 0 ? Math.min(150, Math.max(3, +d.W)) : b.x1 - b.x0, D = isFinite(+d.D) && +d.D > 0 ? Math.min(150, Math.max(3, +d.D)) : b.z1 - b.z0;
  const sx = W / (b.x1 - b.x0), sz = D / (b.z1 - b.z0);
  sp.fp = sp.fp.map(([x, z]) => [x * sx, z * sz]);
  if (Array.isArray(d.parts)) sp.parts = d.parts;
  if (d.ov != null && isFinite(+d.ov)) sp.ov = +d.ov;
  if (d.roof) sp.roof = d.roof;
  if (d.pitch != null && isFinite(+d.pitch)) sp.pitch = Math.min(55, Math.max(5, +d.pitch));
  return normSpecKeep(sp);
}
const normSpecKeep = (sp) => ({ ...normSpec(sp), pitch: sp.pitch });
export function modelFromAi(a0) {
  const a = normSpecKeep(a0), flatTop = a.roof === 'flat', nP = a.parts.length;
  let fp0 = a.fp; if (fp0.length < 3) throw new Error('Obris zgrade nije prepoznat.');
  // obrisi dijelova u koordinatama tlocrta (prije moguće rotacije): gornji dio = pravokutnik uvučen od dijela ispod
  const fps = [fp0];
  for (let i = 1; i < nP; i++) {
    const b = bbox({ fp: fps[i - 1] }), n = a.parts[i].inset, w = b.x1 - b.x0, dd = b.z1 - b.z0;
    const l = Math.min(n.l, w - 3), r = Math.min(n.d, Math.max(0, w - 3 - l)), g = Math.min(n.g, dd - 3), dl = Math.min(n.dl, Math.max(0, dd - 3 - g));
    fps.push(l + r + g + dl < 0.05 ? fps[i - 1].map((p) => p.slice()) : [[b.x0 + l, b.z0 + g], [b.x1 - r, b.z0 + g], [b.x1 - r, b.z1 - dl], [b.x0 + l, b.z1 - dl]]);
  }
  const rot = (a.roof === 'gable' || a.roof === 'mono') && a.ridgeDir === 'x'; // sljeme mora ići po osi z
  let F = fps;
  if (rot) { F = fps.map((f) => f.map(([x, z]) => [-z, x])); const x0 = Math.min(...F[0].map((p) => p[0])), z0 = Math.min(...F[0].map((p) => p[1])); F = F.map((f) => f.map(([x, z]) => [rd(x - x0), rd(z - z0)])); }
  const SIDES = ['gore', 'desno', 'dolje', 'lijevo'], sideOf = (sd) => (rot && SIDES.includes(sd) ? SIDES[(SIDES.indexOf(sd) + 1) % 4] : sd);
  // volumeni: svaki ima svoj obris, razine etaža i visinu; y0 = razina na kojoj počinje
  let y0 = 0;
  const vols = a.parts.map((p, i) => {
    const top = i === nP - 1, flat = !top || flatTop, sumH = p.heights.reduce((s, h) => s + h, 0), levels = p.heights.map((_, f) => rd(p.heights.slice(0, f).reduce((s, h) => s + h, 0)));
    const eave = rd(flat ? sumH : sumH + 0.2), b = bbox({ fp: F[i] }), half = (b.x1 - b.x0) / 2, deg = Math.PI / 180;
    const want = a.pitch ? Math.tan(a.pitch * deg) * half : a.ridgeH != null && a.ridgeH - y0 > eave ? a.ridgeH - y0 - eave : Math.tan(25 * deg) * half;
    const rise = Math.min(Math.tan(50 * deg) * half, Math.max(Math.tan(8 * deg) * half, want));
    const v = { name: p.name, fp: F[i], floors: p.floors, storeyH: rd(sumH / p.floors), levels, eave, ridge: rd(eave + rise), ridgeX: rd((b.x0 + b.x1) / 2), ov: top && !flatTop ? rd(a.ov) : 0, wallT: 0.4, base: i ? 0 : 0.5, roof: { type: top ? a.roof : 'flat' }, openings: [], y0: rd(y0), labels: [] };
    y0 += sumH; return v;
  });
  // otvori: pročelje je nacrtano preko cijele širine podnožja; dio zgrade se bira po visini otvora
  const b0 = bbox({ fp: F[0] }), DIR = { gore: [0, -1], desno: [1, 0], dolje: [0, 1], lijevo: [-1, 0] };
  const geo = vols.map((v) => { const E = edges(v); return { v, E, N: E.map((e) => outward(v, e)) }; });
  a.facades.forEach((f) => {
    const sd = sideOf(f.side), d = DIR[sd]; if (!d) return;
    const horiz = d[0] === 0, lo = horiz ? b0.x0 : b0.z0, span = horiz ? b0.x1 - b0.x0 : b0.z1 - b0.z0, inc = sd === 'dolje' || sd === 'lijevo';
    const facesOf = (g) => g.E.filter((e, i) => g.N[i][0] * d[0] + g.N[i][1] * d[1] > 0.7);
    geo.forEach((g) => facesOf(g).forEach((e) => { if (f.name && !g.v.labels[e.i]) g.v.labels[e.i] = String(f.name).slice(0, 40); }));
    const outK = (e) => (horiz ? (e.p[1] + e.q[1]) / 2 * d[1] : (e.p[0] + e.q[0]) / 2 * d[0]);
    (Array.isArray(f.openings) ? f.openings : []).forEach((o) => {
      const x = Math.min(1, Math.max(0, +o.x)); if (!isFinite(x)) return;
      const w = Math.min(8, Math.max(0.4, +o.w > 0 ? +o.w : 1.2)), hh = Math.min(5, Math.max(0.4, +o.h > 0 ? +o.h : 1.3)), c = lo + (inc ? x : 1 - x) * span, sAbs = Math.max(0, isFinite(+o.s) ? +o.s : 0.9);
      const g = geo.slice().reverse().find((q) => q.v.y0 <= sAbs + 0.3) || geo[0], v = g.v;
      const cand = facesOf(g).filter((e) => { const a0 = horiz ? e.p[0] : e.p[1], a1 = horiz ? e.q[0] : e.q[1]; return c >= Math.min(a0, a1) + w / 2 + 0.1 && c <= Math.max(a0, a1) - w / 2 - 0.1; }).sort((p, q) => outK(q) - outK(p));
      if (!cand.length) return;
      const e = cand[0], a0 = horiz ? e.p[0] : e.p[1], a1 = horiz ? e.q[0] : e.q[1], t = o.t === 'vrata' ? 'door' : o.t === 'klizna' ? 'slide' : 'win';
      let sill = Math.max(0, sAbs - v.y0);
      if (t !== 'win') sill = v.levels.reduce((best, L) => (Math.abs(L - sill) < Math.abs(best - sill) ? L : best), 0);
      const op = { e: e.i, u: rd((c - a0) / (a1 - a0) * e.L), w: rd(w), h: rd(hh), s: rd(sill), t };
      if (!v.openings.some((q) => q.e === op.e && Math.abs(q.u - op.u) < (q.w + op.w) / 2 + 0.1 && q.s < op.s + op.h && op.s < q.s + q.h)) v.openings.push(op);
    });
  });
  vols.forEach((v) => edges(v).forEach((e) => { v.labels[e.i] ||= 'Pročelje ' + (e.i + 1); }));
  const m = { v: 3, src: 'ai', ...vols[0], balcony: null, canopy: null, chimneys: [], colors: { ...DEFAULT_COLORS } };
  if (nP > 1) m.vols = vols.slice(1);
  return m;
}
// pomoćno za zgrade iz više dijelova
export const volsOf = (m) => [m, ...(m.vols || [])];
export const levelsOf = (m) => (Array.isArray(m.levels) && m.levels.length === m.floors ? m.levels : Array.from({ length: m.floors }, (_, f) => f * m.storeyH));
export const floorsAll = (m) => volsOf(m).reduce((s, v) => s + v.floors, 0);
export const topOf = (m) => Math.max(...volsOf(m).map((v) => (v.y0 || 0) + roofGeom(v).top));
export function storeyHeights(v) { const L = levelsOf(v); return L.map((l, i) => (i < L.length - 1 ? L[i + 1] : Math.max(l + 2.2, v.roof?.type === 'flat' || !v.roof ? v.eave : v.eave - 0.2)) - l); }

/* ---------- geometrija ---------- */
export function edges(m) { return m.fp.map((p, i) => { const q = m.fp[(i + 1) % m.fp.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return { i, p, q, L, dx: (q[0] - p[0]) / L, dz: (q[1] - p[1]) / L }; }); }
export function bbox(m) { const xs = m.fp.map((p) => p[0]), zs = m.fp.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; }
export function centroid(m) { const b = bbox(m); return [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]; }
export function polyArea(poly) { let a = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; }
export function isCW(m) { return polyArea(m.fp) > 0; }
export function outward(m, e) { const s = isCW(m) ? 1 : -1; return [e.dz * s, -e.dx * s]; }
export function isConvex(fp) { let sg = 0; for (let i = 0; i < fp.length; i++) { const a = fp[i], b = fp[(i + 1) % fp.length], c = fp[(i + 2) % fp.length], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-9) continue; if (sg && Math.sign(cr) !== sg) return false; sg = Math.sign(cr); } return true; }
// tlocrt pomaknut prema van za d (prepust krova, radni prostor iskopa)
export function offsetPoly(m, d) {
  const E = edges(m), n = m.fp.length;
  return m.fp.map((v, i) => { const n1 = outward(m, E[(i - 1 + n) % n]), n2 = outward(m, E[i]), k = 1 + n1[0] * n2[0] + n1[1] * n2[1]; return [v[0] + d * (n1[0] + n2[0]) / k, v[1] + d * (n1[1] + n2[1]) / k]; });
}
// odreži poligon: ostaje dio gdje je f(p) <= 0 (f je linearna funkcija)
function clipFn(poly, f) {
  const out = [];
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], a = f(p), c = f(q); if (a <= 1e-9) out.push(p); if ((a <= 1e-9) !== (c <= 1e-9)) { const k = a / (a - c); out.push([p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])]); } });
  return out;
}

export const PARAPET = 0.5; // atika ravnog krova
// Oblik krova: plohe (poligoni u tlocrtu), visina gornje plohe H(x,z), vrh zida wallTop(x,z).
// gable = dvostrešni (po nacrtu), mono = jednostrešni, hip = četverostrešni (viševodni), flat = ravni.
export function roofKind(m) { const t = m.roof?.type || 'gable'; return t === 'hip' && !isConvex(m.fp) ? 'gable' : t; }
export function roofGeom(m) {
  const b = bbox(m), E = edges(m), kind = roofKind(m);
  const tanL = (m.ridge - m.eave) / Math.max(0.1, m.ridgeX - b.x0), tanR = (m.ridge - m.eave) / Math.max(0.1, b.x1 - m.ridgeX);
  const ov = kind === 'flat' ? 0 : m.ov, off = offsetPoly(m, ov), deg = Math.PI / 180;
  let H, faces, wallTop, top;
  if (kind === 'mono') {
    const t = Math.tan((m.roof.pitch || 15) * deg);
    H = (x) => m.eave + (x - b.x0) * t; faces = [{ poly: off, tan: t, up: [1, 0] }]; wallTop = (x) => H(x) - 0.04; top = H(b.x1 + ov);
  } else if (kind === 'hip') {
    const t = m.roof.pitch ? Math.tan(m.roof.pitch * deg) : (tanL + tanR) / 2;
    const N = E.map((e) => outward(m, e)), dist = (p, i) => -((p[0] - E[i].p[0]) * N[i][0] + (p[1] - E[i].p[1]) * N[i][1]);
    H = (x, z) => m.eave + t * Math.min(...E.map((_, i) => dist([x, z], i)));
    faces = E.map((e, i) => { let poly = off; E.forEach((_, j) => { if (j !== i && poly.length >= 3) poly = clipFn(poly, (p) => dist(p, i) - dist(p, j)); }); return { poly, tan: t, up: [-N[i][0], -N[i][1]] }; }).filter((f) => f.poly.length >= 3 && Math.abs(polyArea(f.poly)) > 0.02);
    wallTop = () => m.eave - 0.04; top = Math.max(...faces.flatMap((f) => f.poly.map((p) => H(p[0], p[1]))));
  } else if (kind === 'flat') {
    H = () => m.eave; faces = [{ poly: m.fp.map((p) => p.slice()), tan: 0, up: [1, 0] }]; wallTop = () => m.eave + PARAPET; top = m.eave + PARAPET;
  } else {
    H = (x) => m.ridge - Math.abs(x - m.ridgeX) * (x <= m.ridgeX ? tanL : tanR);
    const X = m.ridgeX;
    faces = [{ poly: clipFn(off, (p) => p[0] - X), tan: tanL, up: [1, 0] }, { poly: clipFn(off, (p) => X - p[0]), tan: tanR, up: [-1, 0] }].filter((f) => f.poly.length >= 3);
    wallTop = (x) => H(x) - 0.04; top = m.ridge;
  }
  // rubovi ploha: streha (najniži vodoravni rub), sljeme/greben (unutarnji rub), zabat (kosi vanjski rub)
  const onOff = (p, q) => off.some((a, i) => { const c = off[(i + 1) % off.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), d = (v) => Math.abs((v[0] - a[0]) * (c[1] - a[1]) - (v[1] - a[1]) * (c[0] - a[0])) / L; return d(p) < 1e-4 && d(q) < 1e-4; });
  faces.forEach((f) => {
    const hs = f.poly.map((p) => H(p[0], p[1])), lo = Math.min(...hs);
    f.eaves = []; f.inner = []; f.verges = [];
    f.poly.forEach((p, i) => {
      const q = f.poly[(i + 1) % f.poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.05) return;
      const hp = H(p[0], p[1]), hq = H(q[0], q[1]);
      if (!onOff(p, q)) f.inner.push([p, q]);
      else if (f.tan > 0 && Math.abs(hp - lo) < 0.01 && Math.abs(hq - lo) < 0.01) f.eaves.push([p, q]);
      else if (f.tan > 0) f.verges.push([p, q]);
    });
  });
  return { kind, H, faces, wallTop, off, ov, top, tanL, tanR };
}
// točke loma vrha zida (sljeme dvostrešnog krova)
export function wallBreaks(m, e, G) {
  const us = [0, e.L];
  if (G.kind === 'gable' && Math.abs(e.dx) > 1e-6) { const t = (m.ridgeX - e.p[0]) / (e.q[0] - e.p[0]) * e.L; if (t > 0.01 && t < e.L - 0.01) us.push(t); }
  return us.sort((a, b) => a - b);
}

// otvori koji stanu ispod vrha zida (npr. zabatni prozori nestaju kad krov više nema zabat)
export function openingsIn(m, G) {
  const E = edges(m);
  return m.openings.filter((o) => { const e = E[o.e]; if (!e) return false; const top = (u) => G.wallTop(e.p[0] + e.dx * u, e.p[1] + e.dz * u); return o.s + o.h <= Math.min(top(o.u - o.w / 2), top(o.u + o.w / 2)) - 0.12; });
}

/* ---------- količine iz modela ---------- */
const r2 = (n) => Math.round(n * 100) / 100;
const nf = new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 2 });
const f2 = (n) => nf.format(r2(n));
function volQ(m) {
  const E = edges(m), G = roofGeom(m), per = E.reduce((s, e) => s + e.L, 0), A = Math.abs(polyArea(m.fp)), b = bbox(m);
  let gross = 0;
  E.forEach((e) => { const us = wallBreaks(m, e, G), top = (u) => G.wallTop(e.p[0] + e.dx * u, e.p[1] + e.dz * u); for (let k = 0; k < us.length - 1; k++) gross += (us[k + 1] - us[k]) * (top(us[k]) + top(us[k + 1])) / 2; });
  const ops = openingsIn(m, G), ar = (t) => ops.filter((o) => o.t === t), sum = (a) => a.reduce((s, o) => s + o.w * o.h, 0);
  const win = ar('win'), slide = ar('slide'), door = ar('door'), openA = sum(ops);
  const roofA = G.faces.reduce((s, f) => s + Math.abs(polyArea(f.poly)) * Math.sqrt(1 + f.tan * f.tan), 0);
  const len = (segs) => segs.reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
  const eaveL = G.faces.reduce((s, f) => s + len(f.eaves), 0), nGut = G.faces.reduce((s, f) => s + f.eaves.length, 0);
  const pipes = G.kind === 'flat' ? 2 : (G.faces.length > 2 ? nGut : nGut * 2);
  return {
    per, A, bw: b.x1 - b.x0, bd: b.z1 - b.z0, floors: m.floors, storeyH: m.storeyH, eave: m.eave, kind: G.kind,
    gross, openA, net: Math.max(0, gross - openA), winA: sum(win), winN: win.length, slideA: sum(slide), slideN: slide.length, doorA: sum(door), doorN: door.length,
    reveal: ops.reduce((s, o) => s + 2 * o.h + o.w, 0),
    roofA, roofPlan: G.faces.reduce((s, f) => s + Math.abs(polyArea(f.poly)), 0), eaveL, pipes, pipeL: pipes * (m.eave + 0.2),
    pitch: G.faces[0] ? Math.atan(G.faces[0].tan) * 180 / Math.PI : 0,
  };
}
export function quantities(m) {
  const V = volsOf(m), qs = V.map(volQ), q0 = qs[0], top = qs[qs.length - 1], tv = V[V.length - 1], sum = (k) => qs.reduce((s, q) => s + q[k], 0);
  const hMax = Math.max(...V.flatMap(storeyHeights)), slabVol = qs.reduce((s, q) => s + q.A * 0.2 * q.floors, 0), perFloors = qs.reduce((s, q) => s + q.per * q.floors, 0);
  if (V.length === 1) return { ...q0, slabVol, perFloors, terrA: 0, hMax, parts: 1 };
  let terrA = 0; for (let i = 0; i < V.length - 1; i++) terrA += Math.max(0, qs[i].A - qs[i + 1].A);
  return { ...q0, floors: sum('floors'), gross: sum('gross'), openA: sum('openA'), net: sum('net'), winA: sum('winA'), winN: sum('winN'), slideA: sum('slideA'), slideN: sum('slideN'), doorA: sum('doorA'), doorN: sum('doorN'), reveal: sum('reveal'),
    kind: top.kind, roofA: top.roofA, roofPlan: top.roofPlan, eaveL: top.eaveL, pipes: top.pipes, pipeL: top.pipes * (tv.y0 + tv.eave + 0.2), pitch: top.pitch, eave: tv.y0 + tv.eave,
    slabVol, perFloors, terrA, hMax, parts: V.length };
}
// vertikalni i horizontalni serklaži omeđenog ziđa (pravila: uglovi, uz otvore > 1,5 m², razmak ≤ 5 m; u razini svake ploče)
export function serklazi(m, side = 0.25) {
  const r = { nCorner: 0, nMid: 0, big: 0, lenV: 0, lenH: 0, colLen: 0 };
  volsOf(m).forEach((v) => {
    const E = edges(v), nC = v.fp.length, nM = E.reduce((s, e) => s + Math.max(0, Math.ceil(e.L / 5) - 1), 0), big = v.openings.filter((o) => o.w * o.h > 1.5).length;
    r.nCorner += nC; r.nMid += nM; r.big += big; r.colLen += (nC + nM) * v.eave; r.lenV += (nC + nM) * v.eave + big * 2 * v.storeyH; r.lenH += E.reduce((s, e) => s + e.L, 0) * v.floors;
  });
  return { ...r, nV: r.nCorner + r.nMid + r.big * 2, vol: (r.lenV + r.lenH) * side * side };
}
function foundationQ(m, kind, Q) {
  const Lt = Q.per + Math.round(Q.per * 0.25), nS = m.fp.length + edges(m).reduce((s, e) => s + Math.max(0, Math.ceil(e.L / 5) - 1), 0) + 1;
  if (kind === 'ploca') {
    const Ap = Q.A + Q.per * 0.3, Ai = Q.A + Q.per * 1.0 + 4;
    return { za: 'temeljnu ploču', iskop: Ai * 0.5, iskopB: `Tlocrt ${f2(Q.A)} m² + 1 m radnog prostora uz opseg ${f2(Q.per)} m = ${f2(Ai)} m² × dubina 0,50 m.`, Ap };
  }
  if (kind === 'samci') {
    const pits = nS * 1.5 * 1.5 * 1.0, tr = Lt * 0.4 * 0.5;
    return { za: 'temelje samce i vezne grede', iskop: pits + tr, iskopB: `${nS} temelja samaca 1,5 × 1,5 × 1,0 m + rovovi veznih greda ${f2(Lt)} m × 0,40 × 0,50 m.`, nS, Lt };
  }
  return { za: 'trakaste temelje', iskop: Lt * 0.6 * 0.9, iskopB: `Opseg ${f2(Q.per)} m + unutarnji temelji ≈ ${f2(Lt - Q.per)} m = ${f2(Lt)} m; širina 0,60 m × dubina 0,90 m (ispod granice smrzavanja).`, Lt };
}

/* ---------- katalog opcija izvedbe (okvirne cijene, EUR bez PDV-a) ---------- */
// p = jedinična cijena glavne stavke, u = jedinica. Izvori raspona: javni cjenici izvođača 2026. (vidi README).
export const OPT = {
  tlo: { n: 'Iskop: vrsta tla', opts: [
    { id: 'k3', n: 'Zemlja III. kategorije', note: 'Strojni iskop bagerom', p: 8.5, u: 'm³', rast: 1.2, d: 'Strojni iskop zemlje III. kategorije' },
    { id: 'k45', n: 'Tvrdo tlo IV.–V. kategorije', note: 'Zbijena glina, lapor, trošna stijena', p: 14, u: 'm³', rast: 1.3, d: 'Strojni iskop tvrdog tla IV.–V. kategorije' },
    { id: 'k67', n: 'Stijena VI.–VII. kategorije', note: 'Hidraulični čekić (pikamer)', p: 24, u: 'm³', rast: 1.45, d: 'Strojni iskop stijene VI.–VII. kategorije hidrauličnim čekićem' },
    { id: 'rucno', n: 'Ručni iskop', note: 'Gdje stroj ne može prići', p: 22, u: 'm³', rast: 1.2, d: 'Ručni iskop zemlje III. kategorije' },
  ] },
  temelji: { n: 'Temelji', opts: [
    { id: 'trakasti', n: 'Trakasti temelji', note: 'Ispod nosivih zidova; po nacrtu', p: 110, u: 'm³', nacrt: true },
    { id: 'ploca', n: 'Temeljna ploča', note: 'Puna AB ploča 30 cm ispod cijele kuće; slabije tlo, podzemna voda', p: 115, u: 'm³' },
    { id: 'samci', n: 'Temelji samci + vezne grede', note: 'Ispod stupova; uz AB skelet', p: 120, u: 'm³' },
  ] },
  konstrukcija: { n: 'Nosiva konstrukcija', opts: [
    { id: 'opeka25', n: 'Blok opeka 25 cm + AB serklaži', note: 'Omeđeno ziđe; po nacrtu', p: 30, u: 'm²', t: 0.25, zid: true, nacrt: true },
    { id: 'opeka30', n: 'Blok opeka 30 cm + AB serklaži', note: 'Omeđeno ziđe, deblji zid', p: 36, u: 'm²', t: 0.30, zid: true },
    { id: 'puna', n: 'Puna opeka 25 cm + AB serklaži', note: 'Klasično zidanje, veća masa', p: 42.5, u: 'm²', t: 0.25, zid: true },
    { id: 'ab', n: 'Armirani beton, zidovi 20 cm', note: 'Monolitni AB zidovi u oplati', p: 210, u: 'm³', t: 0.20 },
    { id: 'skelet', n: 'AB skelet + ispuna šupljom opekom', note: 'Nose stupovi i grede; opeka je samo ispuna', p: 260, u: 'm³', t: 0.25 },
  ] },
  krovOblik: { n: 'Krov: oblik', opts: [
    { id: 'gable', n: 'Dvostrešni', note: 'Dvije vode, zabati; po nacrtu', nacrt: true },
    { id: 'hip', n: 'Četverostrešni', note: 'Vode na sve strane, bez zabata' },
    { id: 'mono', n: 'Jednostrešni', note: 'Jedna voda, nagib 15°' },
    { id: 'flat', n: 'Ravni krov', note: 'AB ploča, atika, pad 2 %' },
  ] },
  pokrov: { n: 'Krov: pokrov', opts: [
    { id: 'crijep', n: 'Glineni crijep', note: 'Utoreni crijep na letvama', p: 52, u: 'm²', kosi: true, boja: '#9b4a31', nacrt: true },
    { id: 'lim', n: 'Čelični lim', note: 'Falcani ili trapezni, s folijom', p: 42, u: 'm²', kosi: true, boja: '#474c52' },
    { id: 'sljunak', n: 'Membrana + šljunak', note: 'TPO/PVC hidroizolacija, balast', p: 45, u: 'm²', ravni: true, boja: '#b9b3a6' },
    { id: 'zeleni', n: 'Zeleni krov', note: 'Ekstenzivni, sedum', p: 95, u: 'm²', ravni: true, boja: '#7f9a5c' },
  ] },
  fasada: { n: 'Fasada', opts: [
    { id: 'eticsEps', n: 'ETICS, EPS 15 cm', note: 'Kontaktna fasada sa žbukom; po nacrtu', p: 46, u: 'm²', nacrt: true },
    { id: 'eticsVuna', n: 'ETICS, kamena vuna 15 cm', note: 'Negoriva, paropropusna', p: 52, u: 'm²' },
    { id: 'ventilirana', n: 'Ventilirana, ploče', note: 'HPL ili vlaknocement na potkonstrukciji', p: 110, u: 'm²' },
    { id: 'kamen', n: 'Kamena obloga', note: 'Prirodni kamen preko izolacije', p: 135, u: 'm²' },
    { id: 'klinker', n: 'Fasadna (klinker) opeka', note: 'Obzid 12 cm sa sidrima i izolacijom', p: 120, u: 'm²' },
    { id: 'drvo', n: 'Drvena, sibirski ariš', note: 'Ventilirana, kamena vuna 15 cm', p: 100, u: 'm²' },
  ] },
  stolarija: { n: 'Stolarija: materijal', opts: [
    { id: 'pvc', n: 'PVC', note: 'Višekomorni profili; po nacrtu', p: 230, u: 'm²', boja: '#33363b', hs: 520, vrata: 1400, ime: 'PVC', prid: 'PVC', nacrt: true },
    { id: 'alu', n: 'Aluminij', note: 'Vitki profili s prekidom toplinskog mosta', p: 440, u: 'm²', boja: '#2a2c30', hs: 780, vrata: 2400, ime: 'Aluminijski', prid: 'aluminijski' },
    { id: 'drvo', n: 'Drvo', note: 'Lamelirano drvo, prirodan izgled', p: 310, u: 'm²', boja: '#7a5233', hs: 690, vrata: 2100, ime: 'Drveni', prid: 'drveni' },
    { id: 'drvoalu', n: 'Drvo-aluminij', note: 'Drvo iznutra, aluminij izvana', p: 460, u: 'm²', boja: '#3a3d42', hs: 820, vrata: 2900, ime: 'Drvo-aluminijski', prid: 'drvo-aluminijski' },
  ] },
  staklo: { n: 'Ostakljenje', opts: [
    { id: '2', n: 'Dvostruko staklo', note: 'Ug ≈ 1,1 W/m²K', k: 1 },
    { id: '3', n: 'Trostruko staklo', note: 'Ug ≈ 0,6 W/m²K; po nacrtu', k: 1.15, nacrt: true },
  ] },
  klizna: { n: 'Klizne stijene', opts: [
    { id: 'hs', n: 'Podizno-klizna (HS)', note: 'Krilo se podigne pa klizi', k: 1, ime: 'podizno-klizna (HS)' },
    { id: 'psk', n: 'Nagibno-klizna (PSK)', note: 'Krilo se nagne pa klizi', k: 0.7, ime: 'nagibno-klizna (PSK)' },
  ] },
  seizmika: { n: 'Potresno područje (a_g·S)', opts: [
    { id: 'a07', n: 'do 0,07 g', i: 0 }, { id: 'a10', n: '0,07–0,10 g', i: 1 }, { id: 'a15', n: '0,10–0,15 g', i: 2 }, { id: 'a20', n: '0,15–0,20 g', i: 3 }, { id: 'a30', n: 'više od 0,20 g', i: 4 },
  ] },
};
export const BUILD_KEYS = ['tlo', 'temelji', 'konstrukcija', 'krovOblik', 'pokrov', 'fasada', 'stolarija', 'staklo', 'klizna'];
export const DEFAULT_BUILD = { tlo: 'k3', temelji: 'trakasti', konstrukcija: 'opeka25', krovOblik: 'gable', pokrov: 'crijep', fasada: 'eticsEps', stolarija: 'pvc', staklo: '3', klizna: 'hs', seizmika: null };
export const optOf = (k, id) => OPT[k].opts.find((o) => o.id === id) || OPT[k].opts[0];
// koje stavke troškovnika (slotovi) ovise o kojoj odluci
export const SLOTS_OF = { tlo: ['iskop'], temelji: ['iskop', 'temelji'], konstrukcija: ['zid'], krovOblik: ['krovK', 'pokrov', 'oluk', 'zid', 'fasada'], pokrov: ['pokrov'], fasada: ['fasada'], stolarija: ['stolarija'], staklo: ['stolarija'], klizna: ['stolarija'] };
export const ALL_SLOTS = ['iskop', 'temelji', 'zid', 'ploce', 'krovK', 'pokrov', 'oluk', 'fasada', 'stolarija'];
export const COST_OF = { tlo: ['iskop'], temelji: ['iskop', 'temelji'], konstrukcija: ['zid'], krovOblik: ['krovK', 'pokrov', 'oluk'], pokrov: ['pokrov'], fasada: ['fasada'], stolarija: ['stolarija'], staklo: ['stolarija'], klizna: ['stolarija'] };
// okvirne cijene stavki koje ne ovise o odabiru
export const PRICE = { odvoz: 10, podna: 110, podlozni: 20, serklazi: 230, krovK: 32, osb: 22, oluk: 22, cijev: 20, padBeton: 18, krovIzol: 38, opsav: 28, slivnik: 120, ispuna: 28, humus: 4.5, sljunak: 27, hidro: 16, stropna: 120, armatura: 1.7, terasa: 85 };

// uskladi odabir (npr. ravni krov ne može imati crijep) i oblik krova u modelu
export function normBuild(b) {
  const o = { ...DEFAULT_BUILD, ...(b || {}) };
  BUILD_KEYS.forEach((k) => { if (!OPT[k].opts.some((x) => x.id === o[k])) o[k] = DEFAULT_BUILD[k]; });
  if (!OPT.seizmika.opts.some((x) => x.id === o.seizmika)) o.seizmika = null;
  const flat = o.krovOblik === 'flat', pk = optOf('pokrov', o.pokrov);
  if (flat && !pk.ravni) o.pokrov = 'sljunak'; if (!flat && !pk.kosi) o.pokrov = 'crijep';
  return o;
}
export function applyBuild(m, b) {
  const note = (v) => { if (v.roof.type === 'hip' && !isConvex(v.fp)) v.roof.note = 'Tlocrt nije konveksan: prikazan je dvostrešni krov.'; };
  if (m.vols?.length) {
    m.roof = { type: 'flat' };
    m.vols = m.vols.map((v, i) => { const c = { ...v, roof: { type: i === m.vols.length - 1 ? b.krovOblik : 'flat' } }; note(c); return c; }); // kopije: pregled cijena ne smije dirati pravi model
    const t = m.vols[m.vols.length - 1]; if (t.roof.note) m.roof.note = t.roof.note;
  } else { m.roof = { type: b.krovOblik }; note(m); }
  return m;
}

// Stavke troškovnika koje proizlaze iz odabrane izvedbe. Svaka ima slot + key (da se pri promjeni opcije zamijeni ista stavka).
export function buildItems(m, b) {
  b = normBuild(b);
  const mm = applyBuild({ ...m }, b), Q = quantities(mm), S = serklazi(mm), out = [];
  const add = (slot, key, group, phase, desc, unit, qty, price, basis, opt) => out.push({ slot, key, group, phase, desc, unit, qty: r2(qty), price, basis, opt });
  // iskop
  const tlo = optOf('tlo', b.tlo), F = foundationQ(mm, b.temelji, Q), oi = b.tlo;
  add('iskop', 'iskop', 'g02', 'iskop', `${tlo.d} za ${F.za}`, 'm³', F.iskop, tlo.p, F.iskopB, oi);
  add('iskop', 'odvoz', 'g02', 'iskop', 'Odvoz viška materijala na deponiju', 'm³', F.iskop * tlo.rast, PRICE.odvoz, `Iskop ${f2(F.iskop)} m³ × ${f2(tlo.rast)} (rastresitost).`, oi);
  // temelji
  const tm = optOf('temelji', b.temelji);
  if (b.temelji === 'ploca') {
    add('temelji', 'podlozni', 'g03', 'temelji', 'Podložni beton C12/15 d=8 cm ispod temeljne ploče', 'm²', F.Ap, PRICE.podlozni, `Površina temeljne ploče: tlocrt ${f2(Q.A)} m² + istak 30 cm uz opseg.`, b.temelji);
    add('temelji', 'temelj', 'g03', 'temelji', 'Betoniranje AB temeljne ploče d=30 cm betonom C25/30, s oplatom ruba', 'm³', F.Ap * 0.3, tm.p, `${f2(F.Ap)} m² × 0,30 m. Ploča je ujedno i podna ploča prizemlja.`, b.temelji);
  } else if (b.temelji === 'samci') {
    add('temelji', 'temelj', 'g03', 'temelji', 'Betoniranje temelja samaca 1,2 × 1,2 × 0,5 m betonom C25/30', 'm³', F.nS * 0.72, tm.p, `${F.nS} temelja (uglovi, razmak ≤ 5 m, unutarnji stup) × 0,72 m³.`, b.temelji);
    add('temelji', 'vezne', 'g03', 'temelji', 'Betoniranje AB veznih (temeljnih) greda 30/40 cm betonom C25/30', 'm³', F.Lt * 0.12, tm.p, `Duljina ${f2(F.Lt)} m × 0,30 × 0,40 m.`, b.temelji);
    add('temelji', 'podna', 'g03', 'temelji', 'Betoniranje AB podne ploče d=15 cm betonom C25/30', 'm³', Q.A * 0.15, PRICE.podna, `Tlocrt ${f2(Q.A)} m² × 0,15 m.`, b.temelji);
  } else {
    add('temelji', 'temelj', 'g03', 'temelji', 'Betoniranje trakastih temelja betonom C25/30', 'm³', F.Lt * 0.5 * 0.4, tm.p, `Duljina temelja ${f2(F.Lt)} m × 0,50 × 0,40 m (provjeriti s konstrukcijom).`, b.temelji);
    add('temelji', 'podna', 'g03', 'temelji', 'Betoniranje AB podne ploče d=15 cm betonom C25/30', 'm³', Q.A * 0.15, PRICE.podna, `Tlocrt ${f2(Q.A)} m² × 0,15 m.`, b.temelji);
  }
  // zidovi / konstrukcija
  const ks = optOf('konstrukcija', b.konstrukcija), ok = b.konstrukcija, cm = Math.round(ks.t * 100);
  const zb = `Zidovi do krova ${f2(Q.gross)} m² − otvori ${f2(Q.openA)} m² (iz 3D modela: opseg ${f2(Q.per)} m, etaža: ${Q.floors}).`;
  if (ks.zid) {
    const Sx = serklazi(mm, ks.t);
    add('zid', 'zid', 'g04', 'konstrukcija', b.konstrukcija === 'puna' ? `Zidanje vanjskih nosivih zidova punom opekom d=${cm} cm u produžnom mortu M10` : `Zidanje vanjskih nosivih zidova opekarskim blokom d=${cm} cm (skupina 2) u mortu M10`, 'm²', Q.net, ks.p, zb, ok);
    add('zid', 'serklazi', 'g03', 'konstrukcija', `Betoniranje AB serklaža ${cm}/${cm} cm (vertikalni i horizontalni) i nadvoja, C25/30, s oplatom`, 'm³', Sx.vol, PRICE.serklazi, `Horizontalni u razini svake ploče: ${f2(Sx.lenH)} m. Vertikalni: ${Sx.nCorner} uglova + ${Sx.nMid} na razmaku ≤ 5 m + uz ${Sx.big} otvora većih od 1,5 m² = ${f2(Sx.lenV)} m. Presjek ${cm}×${cm} cm.`, ok);
  } else if (b.konstrukcija === 'ab') {
    add('zid', 'zid', 'g03', 'konstrukcija', 'Betoniranje AB zidova d=20 cm betonom C25/30 u dvostranoj oplati', 'm³', Q.net * 0.2, ks.p, `${zb} × 0,20 m.`, ok);
  } else {
    const nC = S.nCorner + S.nMid, vol = S.colLen * 0.09 + Q.perFloors * 0.12;
    add('zid', 'skelet', 'g03', 'konstrukcija', 'Betoniranje AB skeleta: stupovi 30/30 i grede 30/40 cm, C30/37, s oplatom', 'm³', vol, ks.p, `${nC} stupova, ukupno ${f2(S.colLen)} m × 0,09 m² + grede ${f2(Q.perFloors)} m × 0,12 m².`, ok);
    add('zid', 'zid', 'g04', 'konstrukcija', 'Zidanje ispune AB skeleta šupljom opekom d=25 cm (nenosivo), sa sidrenjem u stupove', 'm²', Q.net, PRICE.ispuna, zb, ok);
  }
  add('ploce', 'stropna', 'g03', 'konstrukcija', 'Betoniranje AB stropnih ploča d=20 cm betonom C25/30, s oplatom i podupiranjem', 'm³', Q.slabVol, PRICE.stropna, Q.parts > 1 ? `Ploča nad svakom od ${Q.floors} etaža, po tlocrtu svakog dijela zgrade (${Q.parts} dijela) × 0,20 m.` : `${Q.floors} ${Q.floors === 1 ? 'ploča' : 'ploče/ploča'} (nad svakom etažom) × tlocrt ${f2(Q.A)} m² × 0,20 m.`, 'ab20');
  // krov
  const flat = Q.kind === 'flat', pk = optOf('pokrov', b.pokrov), okr = flat ? 'ravni' : 'kosi';
  const kb = flat ? `Tlocrt krova unutar atike ${f2(Q.roofA)} m².` : `Tlocrt krova s prepustima ${f2(Q.roofPlan)} m², nagib ${f2(Q.pitch)}° → ploha ${f2(Q.roofA)} m² (${optOf('krovOblik', b.krovOblik).n.toLowerCase()} krov).`;
  if (flat) {
    add('krovK', 'krovK', 'g05', 'krov', 'Beton za pad ravnog krova 2 % (prosječno 8 cm)', 'm²', Q.roofA, PRICE.padBeton, kb, okr);
    add('krovK', 'osb', 'g05', 'krov', 'Toplinska izolacija ravnog krova XPS/EPS d=20 cm s parnom branom', 'm²', Q.roofA, PRICE.krovIzol, kb, okr);
    add('oluk', 'oluk', 'g08', 'krov', 'Limeni opšav atike (poklopnica) r.š. 50 cm', 'm', Q.per, PRICE.opsav, `Opseg atike ${f2(Q.per)} m.`, okr);
    add('oluk', 'cijev', 'g08', 'krov', 'Slivnik ravnog krova s odvodnom cijevi', 'kom', 2, PRICE.slivnik, 'Najmanje dva slivnika (sigurnosni preljev).', okr);
  } else {
    add('krovK', 'krovK', 'g06', 'krov', 'Izrada drvene krovne konstrukcije (rogovi 10/14, podrožnice)', 'm²', Q.roofA, PRICE.krovK, kb, okr);
    add('krovK', 'osb', 'g06', 'krov', 'Postava OSB ploča d=1,5 cm na rogove', 'm²', Q.roofA, PRICE.osb, 'Jednako krovnoj plohi.', okr);
    add('oluk', 'oluk', 'g08', 'krov', 'Horizontalni oluk od pocinčanog lima', 'm', Q.eaveL, PRICE.oluk, `Duljina streha ${f2(Q.eaveL)} m.`, okr);
    add('oluk', 'cijev', 'g08', 'krov', 'Vertikalna odvodna cijev', 'm', Q.pipeL, PRICE.cijev, `${Q.pipes} cijevi × ${f2(Q.eave + 0.2)} m (visina strehe).`, okr);
  }
  const pd = { crijep: 'Pokrivanje krova glinenim utorenim crijepom s letvama, kontraletvama i kišnom branom', lim: 'Pokrivanje krova čeličnim plastificiranim limom (falcani/trapezni) na letvama, s paropropusnom folijom', sljunak: 'Hidroizolacija ravnog krova TPO/PVC membranom s geotekstilom i slojem šljunka 5 cm', zeleni: 'Ekstenzivni zeleni krov (sedum) na hidroizolaciji s protukorijenskom zaštitom i drenažom' }[b.pokrov];
  if (Q.terrA > 1) add('pokrov', 'terasa', 'g05', 'krov', 'Ravni krov nižeg dijela zgrade (terasa): hidroizolacija, toplinska izolacija XPS d=20 cm i završni sloj', 'm²', Q.terrA, PRICE.terasa, `Tlocrt nižeg dijela umanjen za tlocrt uvučenog gornjeg dijela: ${f2(Q.terrA)} m².`, 'terasa');
  add('pokrov', 'pokrov', 'g07', 'krov', pd, 'm²', Q.roofA, pk.p, kb, b.pokrov);
  // fasada
  const fs = optOf('fasada', b.fasada);
  const fd = { eticsEps: 'Kontaktna fasada (ETICS) EPS d=15 cm sa silikatnom žbukom', eticsVuna: 'Kontaktna fasada (ETICS) kamena vuna d=15 cm sa silikatnom žbukom', ventilirana: 'Ventilirana fasada: kamena vuna 15 cm, aluminijska potkonstrukcija, obloga HPL ili vlaknocementnim pločama', kamen: 'Obloga fasade prirodnim kamenom d=2–3 cm preko toplinske izolacije 15 cm', klinker: 'Fasadna (klinker) opeka kao obzid 12 cm sa sidrima, zračnim slojem i toplinskom izolacijom 15 cm', drvo: 'Ventilirana drvena fasada od sibirskog ariša na potkonstrukciji, kamena vuna 15 cm' }[b.fasada];
  add('fasada', 'fasada', 'g09', 'fasada', fd, 'm²', Q.net, fs.p, zb, b.fasada);
  // stolarija
  const st = optOf('stolarija', b.stolarija), gl = optOf('staklo', b.staklo), kl = optOf('klizna', b.klizna), os = [b.stolarija, b.staklo, b.klizna].join('/');
  const stak = b.staklo === '3' ? 'trostrukim' : 'dvostrukim';
  if (Q.winN) add('stolarija', 'prozori', 'g10', 'fasada', `${st.ime} prozori s ${stak} staklom, dobava i RAL ugradnja s klupčicama`, 'm²', Q.winA, r2(st.p * gl.k), `Iz 3D modela (pročelja): ${Q.winN} prozora, ukupno ${f2(Q.winA)} m². Provjeri broj i mjere na nacrtu.`, os);
  if (Q.slideN) add('stolarija', 'klizne', 'g10', 'fasada', `Klizna stijena ${kl.ime}, ${st.prid} profil, ${stak.replace('im', 'o')} staklo`, 'm²', Q.slideA, Math.round(st.hs * kl.k * gl.k), `Iz 3D modela: ${Q.slideN} klizne stijene, ukupno ${f2(Q.slideA)} m².`, os);
  if (Q.doorN) add('stolarija', 'ulazna', 'g10', 'fasada', `Ulazna vrata, ${st.prid}, s dovratnikom i okovom`, 'kom', Q.doorN, st.vrata, `Iz 3D modela: ${Q.doorN} ulazna vrata.`, os);
  return out;
}
// zbroj (količina × okvirna cijena) za zadane slotove
// (beton nosi i svoju armaturu: procjena ARM_KG kg/m³, da usporedba zidane i AB izvedbe bude poštena)
export const ARM_KG = 100;
export function slotCost(m, b, slots) { return buildItems(m, b).filter((i) => slots.includes(i.slot)).reduce((s, i) => s + i.qty * (i.price || 0) + (i.group === 'g03' && i.unit === 'm³' ? i.qty * ARM_KG * PRICE.armatura : 0), 0); }

/* ---------- informativna provjera statike ---------- */
// Najmanji udio presjeka nosivih zidova po smjeru (% tlocrtne površine etaže) za „jednostavne zidane zgrade”,
// omeđeno ziđe, po broju katova i ubrzanju tla a_g·S: EN 1998-1, tablica 9.3 (preporučene vrijednosti; nacionalni dodatak može odrediti druge).
const PA_MIN = { 1: [2.0, 2.5, 3.0, 3.5], 2: [2.0, 2.5, 3.0, 3.5], 3: [2.0, 3.0, 4.0, null], 4: [4.0, 5.0, null, null], 5: [6.0, null, null, null] };
export function wallShare(m, t) {
  const E = edges(m), A = Math.abs(polyArea(m.fp)); let ax = 0, az = 0;
  E.forEach((e) => { const open = m.openings.filter((o) => o.e === e.i && o.s < (levelsOf(m)[1] ?? m.storeyH) - 0.3).reduce((s, o) => s + o.w, 0), len = Math.max(0, e.L - open); ax += len * t * e.dx * e.dx; az += len * t * e.dz * e.dz; });
  return { x: ax / A * 100, z: az / A * 100, A };
}
export function statika(m, b) {
  b = normBuild(b);
  const ks = optOf('konstrukcija', b.konstrukcija), Q = quantities(applyBuild({ ...m }, b)), S = serklazi(m, ks.t), sz = b.seizmika ? optOf('seizmika', b.seizmika) : null;
  const C = [], add = (st, n, v, req) => C.push({ st, n, v, req });
  const hEf = Q.hMax - 0.2, nFl = floorsAll(m);
  if (ks.zid) {
    add(ks.t >= 0.24 ? 'ok' : 'bad', 'Debljina nosivog zida', `${Math.round(ks.t * 100)} cm`, 'najmanje 24 cm za omeđeno ziđe');
    add(hEf / ks.t <= 15 ? 'ok' : 'bad', 'Vitkost zida (visina / debljina)', f2(hEf / ks.t), 'najviše 15');
    const sh = wallShare(m, ks.t), row = PA_MIN[Math.min(5, nFl)] || PA_MIN[5];
    if (!sz) add('info', 'Udio nosivih zidova po smjeru', `uzdužno ${f2(sh.x)} %, poprečno ${f2(sh.z)} % (samo vanjski zidovi)`, 'odaberi potresno područje za usporedbu');
    else if (sz.i >= 4 || row[sz.i] == null) add('bad', 'Potresno područje i broj etaža', `etaža: ${nFl}, a_g·S ${sz.n}`, 'izvan pravila za jednostavne zidane zgrade: obvezan potpuni potresni proračun (ili AB konstrukcija)');
    else {
      const req = row[sz.i], lo = Math.min(sh.x, sh.z), miss = Math.max(0, (req - lo) / 100 * sh.A);
      add(lo >= req ? 'ok' : 'warn', 'Udio nosivih zidova po smjeru', `uzdužno ${f2(sh.x)} %, poprečno ${f2(sh.z)} % (samo vanjski zidovi)`, lo >= req ? `najmanje ${f2(req)} % u svakom smjeru` : `najmanje ${f2(req)} %: unutarnji nosivi zidovi moraju dodati još oko ${f2(miss)} m² presjeka u slabijem smjeru`);
    }
    add('ok', 'Vertikalni serklaži', `${S.nV} kom (${S.nCorner} uglova, ${S.nMid} međuserklaža, ${S.big * 2} uz otvore)`, 'u uglovima, na spojevima zidova, uz otvore veće od 1,5 m², razmak najviše 5 m');
    add(Q.hMax <= 4 ? 'ok' : 'bad', 'Horizontalni serklaži', `u razini svake ploče, najveći razmak ${f2(Q.hMax)} m`, 'visinski razmak najviše 4 m');
    add('info', 'Serklaž: presjek i armatura', `${Math.round(ks.t * 100)}×${Math.round(ks.t * 100)} cm`, 'presjek ≥ 0,02 m² i stranica ≥ 15 cm; uzdužna armatura ≥ 300 mm² ili 1 % (npr. 4Ø10–4Ø12), vilice Ø6 na 15 cm; betonira se nakon zidanja, sa „šmorcem”');
    add('info', 'Zidni elementi i mort', b.konstrukcija === 'puna' ? 'puna opeka (skupina 1)' : 'blok s vertikalnim šupljinama (skupina 2)', 'samo skupina 1 ili 2; mort najmanje M5 (preporuka M10); ispunjene vertikalne sljubnice');
  } else if (b.konstrukcija === 'ab') {
    add(ks.t >= Math.max(0.15, hEf / 20) ? 'ok' : 'bad', 'Debljina AB zida', `${Math.round(ks.t * 100)} cm`, `najmanje 15 cm i 1/20 svijetle visine etaže (${f2(hEf / 20 * 100)} cm)`);
    add('info', 'Armatura', 'obostrane mreže + rubna armatura', 'prema HRN EN 1992-1-1 i HRN EN 1998-1; količina u troškovniku je procjena dok nema proračuna');
    add('ok', 'Potresna otpornost', 'AB zidovi u oba smjera', 'primjenjivo u svim potresnim područjima uz proračun');
  } else {
    add('warn', 'Nosivi sustav', 'AB stupovi 30/30 i grede 30/40', 'okvir se uvijek dokazuje proračunom (potres, čvorovi, temelji samci)');
    add('info', 'Ispuna šupljom opekom', 'nenosiva', 'šuplja opeka s vodoravnim šupljinama ne smije biti nosivi zid u potresnom području; ispunu sidriti u stupove i uzeti u obzir u proračunu okvira');
    add(Q.per / (S.nCorner + S.nMid) <= 6 ? 'ok' : 'warn', 'Razmak stupova', `${S.nCorner + S.nMid} stupova, prosječno ${f2(Q.per / (S.nCorner + S.nMid))} m`, 'uobičajeno do 5–6 m');
  }
  if (Q.parts > 1) add('warn', 'Uvučeni gornji dio zgrade', `${Q.parts} dijela različitog tlocrta`, 'zidovi gornjeg dijela koji ne leže na zidovima donjeg traže prijenosnu konstrukciju (grede, ploču, stupove): obvezan statički proračun');
  if (ks.zid && nFl > 5) add('bad', 'Broj etaža', `etaža: ${nFl}`, 'omeđeno ziđe se u pravilu ne koristi iznad 4–5 etaža: predvidi armirani beton');
  const ratio = Math.min(Q.bw, Q.bd) / Math.max(Q.bw, Q.bd);
  add(ratio >= 0.25 ? 'ok' : 'warn', 'Pravilnost tlocrta', `omjer stranica ${f2(ratio)}`, 'kraća/dulja stranica najmanje 0,25; zidovi u dva okomita smjera, neprekinuti po visini');
  add('info', 'Stropovi', 'AB ploče', 'ploča mora djelovati kao kruta dijafragma i biti povezana sa serklažima');
  if (b.krovOblik === 'flat') add('info', 'Ravni krov', 'veće stalno opterećenje (slojevi, šljunak ili zeleni krov)', 'krovnu ploču i zidove provjeriti na dodatno opterećenje');
  const level = C.some((c) => c.st === 'bad') ? 'bad' : C.some((c) => c.st === 'warn') ? 'warn' : 'ok';
  return { level, checks: C, serklazi: S };
}
