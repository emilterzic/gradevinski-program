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
// okvirni model kad nacrt nije modeliran: pravokutnik, dvostrešni krov, prozori ravnomjerno
export function autoModel({ W = 10, D = 8, floors = 2, storeyH = 2.9, pitch = 30, ov = 0.6 } = {}) {
  const eave = floors * storeyH + 0.2, ridgeX = W / 2, ridge = eave + Math.tan(pitch * Math.PI / 180) * ridgeX;
  const fp = [[0, 0], [W, 0], [W, D], [0, D]];
  const openings = [];
  fp.forEach((p, e) => {
    const q = fp[(e + 1) % 4], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.max(1, Math.floor(L / 3));
    for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
      const u = (k + 0.5) * L / n;
      if (e === 3 && f === 0 && k === Math.floor(n / 2)) openings.push({ e, u, w: 1.1, h: 2.15, s: 0, t: 'door' });
      else openings.push({ e, u, w: 1.2, h: 1.3, s: f * storeyH + 0.9, t: 'win' });
    }
  });
  return { v: 2, src: 'auto', fp, floors, storeyH, eave, ridge, ridgeX, ov, wallT: 0.4, base: 0.4, roof: { type: 'gable' }, openings, balcony: null, canopy: null, chimneys: [{ x: W * 0.35, z: D * 0.4, s: 0.5, top: ridge + 0.6 }], colors: { ...DEFAULT_COLORS }, labels: ['Pročelje 1 (sjever)', 'Pročelje 2 (istok)', 'Pročelje 3 (jug)', 'Pročelje 4 (zapad)'] };
}

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
export function quantities(m) {
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
// vertikalni i horizontalni serklaži omeđenog ziđa (pravila: uglovi, uz otvore > 1,5 m², razmak ≤ 5 m; u razini svake ploče)
export function serklazi(m, side = 0.25) {
  const E = edges(m), per = E.reduce((s, e) => s + e.L, 0);
  const nCorner = m.fp.length, nMid = E.reduce((s, e) => s + Math.max(0, Math.ceil(e.L / 5) - 1), 0);
  const big = m.openings.filter((o) => o.w * o.h > 1.5).length;
  const lenV = (nCorner + nMid) * m.eave + big * 2 * m.storeyH, lenH = per * m.floors;
  return { nCorner, nMid, big, nV: nCorner + nMid + big * 2, lenV, lenH, vol: (lenV + lenH) * side * side };
}
function foundationQ(m, kind, Q) {
  const Lt = Q.per + Math.round(Q.per * 0.25), S = serklazi(m), nS = S.nCorner + S.nMid + 1;
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
export const ALL_SLOTS = ['iskop', 'temelji', 'zid', 'krovK', 'pokrov', 'oluk', 'fasada', 'stolarija'];
export const COST_OF = { tlo: ['iskop'], temelji: ['iskop', 'temelji'], konstrukcija: ['zid'], krovOblik: ['krovK', 'pokrov', 'oluk'], pokrov: ['pokrov'], fasada: ['fasada'], stolarija: ['stolarija'], staklo: ['stolarija'], klizna: ['stolarija'] };
// okvirne cijene stavki koje ne ovise o odabiru
export const PRICE = { odvoz: 10, podna: 110, podlozni: 20, serklazi: 230, krovK: 32, osb: 22, oluk: 22, cijev: 20, padBeton: 18, krovIzol: 38, opsav: 28, slivnik: 120, ispuna: 28, humus: 4.5, sljunak: 27, hidro: 16, stropna: 120, armatura: 1.7 };

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
  m.roof = { ...(m.roof || {}), type: b.krovOblik };
  if (b.krovOblik === 'hip' && !isConvex(m.fp)) m.roof.note = 'Tlocrt nije konveksan: prikazan je dvostrešni krov.'; else delete m.roof.note;
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
  const zb = `Zidovi do krova ${f2(Q.gross)} m² − otvori ${f2(Q.openA)} m² (iz 3D modela: opseg ${f2(Q.per)} m, ${Q.floors} etaže).`;
  if (ks.zid) {
    const Sx = serklazi(mm, ks.t);
    add('zid', 'zid', 'g04', 'konstrukcija', b.konstrukcija === 'puna' ? `Zidanje vanjskih nosivih zidova punom opekom d=${cm} cm u produžnom mortu M10` : `Zidanje vanjskih nosivih zidova opekarskim blokom d=${cm} cm (skupina 2) u mortu M10`, 'm²', Q.net, ks.p, zb, ok);
    add('zid', 'serklazi', 'g03', 'konstrukcija', `Betoniranje AB serklaža ${cm}/${cm} cm (vertikalni i horizontalni) i nadvoja, C25/30, s oplatom`, 'm³', Sx.vol, PRICE.serklazi, `Horizontalni u razini svake ploče: ${f2(Sx.lenH)} m. Vertikalni: ${Sx.nCorner} uglova + ${Sx.nMid} na razmaku ≤ 5 m + uz ${Sx.big} otvora većih od 1,5 m² = ${f2(Sx.lenV)} m. Presjek ${cm}×${cm} cm.`, ok);
  } else if (b.konstrukcija === 'ab') {
    add('zid', 'zid', 'g03', 'konstrukcija', 'Betoniranje AB zidova d=20 cm betonom C25/30 u dvostranoj oplati', 'm³', Q.net * 0.2, ks.p, `${zb} × 0,20 m.`, ok);
  } else {
    const nC = S.nCorner + S.nMid, vol = nC * 0.09 * mm.eave + Q.per * Q.floors * 0.12;
    add('zid', 'skelet', 'g03', 'konstrukcija', 'Betoniranje AB skeleta: stupovi 30/30 i grede 30/40 cm, C30/37, s oplatom', 'm³', vol, ks.p, `${nC} stupova × 0,09 m² × ${f2(mm.eave)} m + grede ${f2(Q.per * Q.floors)} m × 0,12 m².`, ok);
    add('zid', 'zid', 'g04', 'konstrukcija', 'Zidanje ispune AB skeleta šupljom opekom d=25 cm (nenosivo), sa sidrenjem u stupove', 'm²', Q.net, PRICE.ispuna, zb, ok);
  }
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
    add('oluk', 'cijev', 'g08', 'krov', 'Vertikalna odvodna cijev', 'm', Q.pipeL, PRICE.cijev, `${Q.pipes} cijevi × ${f2(mm.eave + 0.2)} m (visina strehe).`, okr);
  }
  const pd = { crijep: 'Pokrivanje krova glinenim utorenim crijepom s letvama, kontraletvama i kišnom branom', lim: 'Pokrivanje krova čeličnim plastificiranim limom (falcani/trapezni) na letvama, s paropropusnom folijom', sljunak: 'Hidroizolacija ravnog krova TPO/PVC membranom s geotekstilom i slojem šljunka 5 cm', zeleni: 'Ekstenzivni zeleni krov (sedum) na hidroizolaciji s protukorijenskom zaštitom i drenažom' }[b.pokrov];
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
  E.forEach((e) => { const open = m.openings.filter((o) => o.e === e.i && o.s < m.storeyH - 0.3).reduce((s, o) => s + o.w, 0), len = Math.max(0, e.L - open); ax += len * t * e.dx * e.dx; az += len * t * e.dz * e.dz; });
  return { x: ax / A * 100, z: az / A * 100, A };
}
export function statika(m, b) {
  b = normBuild(b);
  const ks = optOf('konstrukcija', b.konstrukcija), Q = quantities(applyBuild({ ...m }, b)), S = serklazi(m, ks.t), sz = b.seizmika ? optOf('seizmika', b.seizmika) : null;
  const C = [], add = (st, n, v, req) => C.push({ st, n, v, req });
  const hEf = m.storeyH - 0.2;
  if (ks.zid) {
    add(ks.t >= 0.24 ? 'ok' : 'bad', 'Debljina nosivog zida', `${Math.round(ks.t * 100)} cm`, 'najmanje 24 cm za omeđeno ziđe');
    add(hEf / ks.t <= 15 ? 'ok' : 'bad', 'Vitkost zida (visina / debljina)', f2(hEf / ks.t), 'najviše 15');
    const sh = wallShare(m, ks.t), row = PA_MIN[Math.min(5, m.floors)] || PA_MIN[5];
    if (!sz) add('info', 'Udio nosivih zidova po smjeru', `uzdužno ${f2(sh.x)} %, poprečno ${f2(sh.z)} % (samo vanjski zidovi)`, 'odaberi potresno područje za usporedbu');
    else if (sz.i >= 4 || row[sz.i] == null) add('bad', 'Potresno područje i broj etaža', `${m.floors} etaže, a_g·S ${sz.n}`, 'izvan pravila za jednostavne zidane zgrade: obvezan potpuni potresni proračun (ili AB konstrukcija)');
    else {
      const req = row[sz.i], lo = Math.min(sh.x, sh.z), miss = Math.max(0, (req - lo) / 100 * sh.A);
      add(lo >= req ? 'ok' : 'warn', 'Udio nosivih zidova po smjeru', `uzdužno ${f2(sh.x)} %, poprečno ${f2(sh.z)} % (samo vanjski zidovi)`, lo >= req ? `najmanje ${f2(req)} % u svakom smjeru` : `najmanje ${f2(req)} %: unutarnji nosivi zidovi moraju dodati još oko ${f2(miss)} m² presjeka u slabijem smjeru`);
    }
    add('ok', 'Vertikalni serklaži', `${S.nV} kom (${S.nCorner} uglova, ${S.nMid} međuserklaža, ${S.big * 2} uz otvore)`, 'u uglovima, na spojevima zidova, uz otvore veće od 1,5 m², razmak najviše 5 m');
    add(m.storeyH <= 4 ? 'ok' : 'bad', 'Horizontalni serklaži', `u razini svake ploče, razmak ${f2(m.storeyH)} m`, 'visinski razmak najviše 4 m');
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
  const ratio = Math.min(Q.bw, Q.bd) / Math.max(Q.bw, Q.bd);
  add(ratio >= 0.25 ? 'ok' : 'warn', 'Pravilnost tlocrta', `omjer stranica ${f2(ratio)}`, 'kraća/dulja stranica najmanje 0,25; zidovi u dva okomita smjera, neprekinuti po visini');
  add('info', 'Stropovi', 'AB ploče', 'ploča mora djelovati kao kruta dijafragma i biti povezana sa serklažima');
  if (b.krovOblik === 'flat') add('info', 'Ravni krov', 'veće stalno opterećenje (slojevi, šljunak ili zeleni krov)', 'krovnu ploču i zidove provjeriti na dodatno opterećenje');
  const level = C.some((c) => c.st === 'bad') ? 'bad' : C.some((c) => c.st === 'warn') ? 'warn' : 'ok';
  return { level, checks: C, serklazi: S };
}
