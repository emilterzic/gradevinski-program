// 3D prikaz objekta: model iz nacrta (tlocrt, presjek, pročelja) + faze gradnje iz troškovnika.
// Tlocrt: x udesno, z prema dolje (kao na nacrtu); y = visina. Sve u metrima.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------- zadani model iz priloženih nacrta (obiteljska kuća P+1) ---------- */
export const DEFAULT_COLORS = { fasada: '#efe9df', cokl: '#7d7a74', krov: '#a2462c', stolarija: '#33363b', limarija: '#4a4f55', teren: '#6f8f4c' };
export const COLOR_PRESETS = [
  { n: 'Klasična (bijela + crveni crijep)', c: { fasada: '#efe9df', cokl: '#7d7a74', krov: '#a2462c', stolarija: '#33363b', limarija: '#4a4f55' } },
  { n: 'Moderna (siva + antracit)', c: { fasada: '#d9d8d4', cokl: '#3f4246', krov: '#3b3e43', stolarija: '#2a2c30', limarija: '#2a2c30' } },
  { n: 'Mediteranska (pijesak + terakota)', c: { fasada: '#ecdcc0', cokl: '#9b8b74', krov: '#b8603a', stolarija: '#f2f0ea', limarija: '#8a6a4a' } },
  { n: 'Alpska (bijela + drvo)', c: { fasada: '#f4f2ec', cokl: '#5d5a55', krov: '#4b4440', stolarija: '#7a5233', limarija: '#4b4440' } },
];
export function demoModel() {
  return {
    v: 1, src: 'nacrt',
    fp: [[0, 0], [8.75, 0], [8.75, 6.06], [3.22, 7.0], [0, 7.0]],
    floors: 2, storeyH: 2.97, eave: 5.78, ridge: 8.43, ridgeX: 4.15, ov: 0.8, wallT: 0.4, base: 0.45,
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
  return { v: 1, src: 'auto', fp, floors, storeyH, eave, ridge, ridgeX, ov, wallT: 0.4, base: 0.4, openings, balcony: null, canopy: null, chimneys: [{ x: W * 0.35, z: D * 0.4, s: 0.5, top: ridge + 0.6 }], colors: { ...DEFAULT_COLORS }, labels: ['Pročelje 1 (sjever)', 'Pročelje 2 (istok)', 'Pročelje 3 (jug)', 'Pročelje 4 (zapad)'] };
}

/* ---------- teksture (po uzoru na Buildscape projekt) ---------- */
function canvasTex(draw, s = 512) {
  const c = document.createElement('canvas'); c.width = c.height = s;
  draw(c.getContext('2d'), s);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let rnd = 1; const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
function noise(c, s, base, amt, n) { c.fillStyle = base; c.fillRect(0, 0, s, s); for (let i = 0; i < n; i++) { const v = rand() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${rand() * amt})`; c.fillRect(rand() * s, rand() * s, 2, 2); } }
function makeTextures() {
  rnd = 7;
  return {
    render: canvasTex((c, s) => noise(c, s, '#f6f6f6', 0.07, 26000)),
    plinth: canvasTex((c, s) => { noise(c, s, '#e6e6e6', 0.12, 20000); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; for (let x = 0; x < s; x += s / 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, s); c.stroke(); } }),
    tiles: canvasTex((c, s) => {
      c.fillStyle = '#5a5a5a'; c.fillRect(0, 0, s, s);
      const rows = 12, cols = 10, h = s / rows, w = s / cols;
      for (let r = 0; r < rows; r++) for (let k = -1; k <= cols; k++) {
        const x = k * w + (r % 2 ? w / 2 : 0), g = c.createLinearGradient(x, 0, x + w, 0), b = 205 + rand() * 40;
        g.addColorStop(0, `rgb(${b - 55},${b - 55},${b - 55})`); g.addColorStop(0.5, `rgb(${b},${b},${b})`); g.addColorStop(1, `rgb(${b - 70},${b - 70},${b - 70})`);
        c.fillStyle = g; c.fillRect(x + 1, r * h + 1, w - 2, h - 3);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 1, r * h + h - 4, w - 2, 3);
      }
    }),
    block: canvasTex((c, s) => {
      c.fillStyle = '#cbbfae'; c.fillRect(0, 0, s, s);
      const rows = 6, h = s / rows, w = h * 1.6;
      for (let r = 0; r < rows; r++) for (let x = -w; x < s + w; x += w) {
        const o = r % 2 ? w / 2 : 0; c.fillStyle = ['#c4683f', '#cc7448', '#bd6239'][Math.floor(rand() * 3)]; c.fillRect(x + o + 3, r * h + 3, w - 6, h - 6);
        c.fillStyle = 'rgba(60,25,10,.45)'; for (let k = 0; k < 4; k++) c.fillRect(x + o + 12 + k * ((w - 24) / 4), r * h + h * 0.38, (w - 24) / 4 - 5, h * 0.24);
      }
    }),
    concrete: canvasTex((c, s) => noise(c, s, '#b8b5ad', 0.14, 22000)),
    soil: canvasTex((c, s) => noise(c, s, '#6e5034', 0.28, 26000)),
    grass: canvasTex((c, s) => { noise(c, s, '#e8e8e8', 0.22, 40000); for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${rand() > .5 ? '0,40,0' : '255,255,200'},${rand() * 0.12})`; c.fillRect(rand() * s, rand() * s, 1, 4 + rand() * 6); } }),
    paving: canvasTex((c, s) => { c.fillStyle = '#9a968d'; c.fillRect(0, 0, s, s); const n = 8, w = s / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const g = 178 + rand() * 30; c.fillStyle = `rgb(${g},${g - 3},${g - 10})`; c.fillRect(x * w + 2, y * w + 2, w - 4, w - 4); } }),
    osb: canvasTex((c, s) => { c.fillStyle = '#c99a5b'; c.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${rand() > .5 ? '120,70,20' : '240,200,140'},${0.2 + rand() * 0.3})`; c.save(); c.translate(rand() * s, rand() * s); c.rotate(rand() * 3.14); c.fillRect(0, 0, 10 + rand() * 18, 3 + rand() * 4); c.restore(); } }),
  };
}

/* ---------- geometrija ---------- */
function edges(m) { return m.fp.map((p, i) => { const q = m.fp[(i + 1) % m.fp.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return { i, p, q, L, dx: (q[0] - p[0]) / L, dz: (q[1] - p[1]) / L }; }); }
function bbox(m) { const xs = m.fp.map((p) => p[0]), zs = m.fp.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; }
function centroid(m) { const b = bbox(m); return [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]; }
function isCW(m) { let a = 0; m.fp.forEach((p, i) => { const q = m.fp[(i + 1) % m.fp.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a > 0; } // y prema dolje
// visina gornje plohe krova iznad točke x
function roofH(m, x) { const b = bbox(m); return x <= m.ridgeX ? m.eave + (x - b.x0) / (m.ridgeX - b.x0) * (m.ridge - m.eave) : m.eave + (b.x1 - x) / (b.x1 - m.ridgeX) * (m.ridge - m.eave); }
function outward(m, e) { const s = isCW(m) ? 1 : -1; return [e.dz * s, -e.dx * s]; }

export class Viz3D {
  constructor(host, api) {
    this.host = host; this.api = api; this.stage = 5; this.parts = []; this.sel = null;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement); r.domElement.style.display = 'block'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
    this.scene = new THREE.Scene();
    this.scene.background = this.skyTexture(); this.scene.fog = new THREE.Fog('#dfe7ee', 60, 160);
    const pm = new THREE.PMREMGenerator(r); this.scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI / 2.04; this.controls.minDistance = 6; this.controls.maxDistance = 80;
    this.tex = makeTextures();
    this.lights();
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); let down = null;
    r.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    r.domElement.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.pick(e); down = null; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.running = true; const loop = () => { if (!this.running) return; requestAnimationFrame(loop); this.controls.update(); r.render(this.scene, this.camera); }; loop();
  }
  dispose() { this.running = false; this.ro.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); }
  skyTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#7fa7cf'); gr.addColorStop(0.55, '#c9dbea'); gr.addColorStop(1, '#eef2f2');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  lights() {
    this.scene.add(new THREE.HemisphereLight('#eaf2ff', '#6b5a43', 0.55));
    const sun = this.sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    sun.position.set(-14, 22, 18); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    this.scene.add(sun); this.scene.add(sun.target);
  }
  resize() { const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  mats(m) {
    const C = m.colors, T = this.tex;
    const rep = (t, k) => { const x = t.clone(); x.needsUpdate = true; x.repeat.set(k, k); return x; };
    return {
      fasada: new THREE.MeshStandardMaterial({ color: C.fasada, map: rep(T.render, 0.35), roughness: 0.92 }),
      cokl: new THREE.MeshStandardMaterial({ color: C.cokl, map: rep(T.plinth, 0.5), roughness: 0.85 }),
      block: new THREE.MeshStandardMaterial({ map: rep(T.block, 0.5), roughness: 0.95 }),
      krov: new THREE.MeshStandardMaterial({ color: C.krov, map: T.tiles, roughness: 0.75 }),
      osb: new THREE.MeshStandardMaterial({ map: T.osb, roughness: 0.9, side: THREE.DoubleSide }),
      soffit: new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.9, side: THREE.DoubleSide }),
      fascia: new THREE.MeshStandardMaterial({ color: C.limarija, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
      frame: new THREE.MeshStandardMaterial({ color: C.stolarija, roughness: 0.45, metalness: 0.15 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#2b3a46', roughness: 0.04, metalness: 0.15, reflectivity: 0.9, envMapIntensity: 1.6, clearcoat: 1 }),
      door: new THREE.MeshStandardMaterial({ color: C.stolarija, roughness: 0.5, metalness: 0.2 }),
      metal: new THREE.MeshStandardMaterial({ color: C.limarija, roughness: 0.35, metalness: 0.6 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#a29f97', map: rep(this.tex.concrete, 0.4), roughness: 0.95 }),
      soil: new THREE.MeshStandardMaterial({ map: rep(this.tex.soil, 0.25), roughness: 1 }),
      grass: new THREE.MeshStandardMaterial({ color: C.teren || DEFAULT_COLORS.teren, map: rep(this.tex.grass, 0.18), roughness: 1 }),
      paving: new THREE.MeshStandardMaterial({ map: rep(this.tex.paving, 0.6), roughness: 0.9 }),
      railGlass: new THREE.MeshPhysicalMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, envMapIntensity: 1.2 }),
      wood: new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.8 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#5a8442', roughness: 0.9 }),
      leaf2: new THREE.MeshStandardMaterial({ color: '#46723a', roughness: 0.9 }),
    };
  }
  add(mesh, part, minStage = 0, maxStage = 9) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { part, minStage, maxStage }; this.root.add(mesh); this.parts.push(mesh); return mesh; }
  box(w, h, d, mat, x, y, z, part, s0, s1) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); g.position.set(x, y, z); return this.add(g, part, s0, s1); }

  build(model) {
    this.model = model;
    this.root.clear(); this.parts = [];
    const m = model, M = this.M = this.mats(m), E = edges(m), b = bbox(m), [cx, cz] = centroid(m);
    // teren
    const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), M.grass); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.01, cz); ground.receiveShadow = true; this.root.add(ground);
    // iskop (faza 0) i temelji (faza 1-…)
    const pad = 1.0;
    this.box(b.x1 - b.x0 + 2 * pad, 0.02, b.z1 - b.z0 + 2 * pad, M.soil, cx, 0.0, cz, 'iskop', 0, 0);
    E.forEach((e) => { const mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[1] + e.q[1]) / 2; const g = this.box(e.L + 0.5, 0.06, 0.9, M.soil, mx, 0.02, mz, 'iskop', 0, 0); g.rotation.y = -Math.atan2(e.dz, e.dx); g.material = new THREE.MeshStandardMaterial({ color: '#3e2c1d', roughness: 1 }); });
    E.forEach((e) => { const [nx, nz] = outward(m, e); const mx = (e.p[0] + e.q[0]) / 2 - nx * 0.2, mz = (e.p[1] + e.q[1]) / 2 - nz * 0.2; const g = this.box(e.L + 0.3, 0.35, 0.6, M.concrete, mx, 0.12, mz, 'temelji', 1, 1); g.rotation.y = -Math.atan2(e.dz, e.dx); });
    const slabShape = new THREE.Shape(m.fp.map((p) => new THREE.Vector2(p[0], -p[1])));
    const slab = (y, t, mat, part, s0, s1) => { const g = new THREE.Mesh(new THREE.ExtrudeGeometry(slabShape, { depth: t, bevelEnabled: false }), mat); g.rotation.x = -Math.PI / 2; g.position.y = y - t; return this.add(g, part, s0, s1); };
    slab(0.15, 0.15, M.concrete, 'temelji', 1, 9);
    for (let f = 1; f < m.floors; f++) slab(f * m.storeyH, 0.2, M.concrete, 'konstrukcija', 2, 3);
    slab(m.eave - 0.02, 0.2, M.concrete, 'konstrukcija', 2, 2);
    // zidovi s otvorima
    E.forEach((e) => this.wall(m, e));
    // krov
    this.roof(m);
    // dimnjaci
    (m.chimneys || []).forEach((c) => { const base = roofH(m, c.x) - 0.3; this.box(c.s, c.top - base, c.s, M.fasada, c.x, (c.top + base) / 2, c.z, 'krov', 3, 9); this.box(c.s + 0.12, 0.08, c.s + 0.12, M.metal, c.x, c.top + 0.04, c.z, 'krov', 4, 9); });
    // balkon
    if (m.balcony) { const B = m.balcony, w = B.x1 - B.x0, d = B.z1 - B.z0;
      this.box(w, 0.2, d, M.fasada, B.x0 + w / 2, B.y - 0.1, B.z0 + d / 2, 'balkon', 2, 9);
      this.box(w, 0.05, d, M.paving, B.x0 + w / 2, B.y + 0.025, B.z0 + d / 2, 'balkon', 4, 9);
      [[w, 0.02, B.x0 + w / 2, B.z0], [w, 0.02, B.x0 + w / 2, B.z1], [0.02, d, B.x1, B.z0 + d / 2]].forEach(([a, c, x, z]) => { this.box(a, 1.0, c, M.railGlass, x, B.y + 0.55, z, 'balkon', 4, 9).castShadow = false; this.box(Math.max(a, 0.05), 0.05, Math.max(c, 0.05), M.metal, x, B.y + 1.06, z, 'balkon', 4, 9); });
    }
    if (m.canopy) { const K = m.canopy, w = K.x1 - K.x0, d = K.z1 - K.z0; this.box(w, 0.18, d, M.fasada, K.x0 + w / 2, K.y, K.z0 + d / 2, 'fasada', 2, 9); this.box(w + 0.04, 0.04, d + 0.04, M.metal, K.x0 + w / 2, K.y + 0.11, K.z0 + d / 2, 'limarija', 4, 9); }
    // okoliš (faza 5): staza, opločenje oko kuće, stabla
    const pv = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([[b.x0 - 1.2, b.z0 - 1.2], [b.x1 + 1.2, b.z0 - 1.2], [b.x1 + 1.2, b.z1 + 1.2], [b.x0 - 1.2, b.z1 + 1.2]].map((p) => new THREE.Vector2(p[0], -p[1]))), { depth: 0.03, bevelEnabled: false }), M.paving);
    pv.rotation.x = -Math.PI / 2; this.add(pv, 'okolis', 5, 9);
    const door = m.openings.find((o) => o.t === 'door');
    if (door) { const e = E[door.e], [nx, nz] = outward(m, e), px = e.p[0] + e.dx * door.u, pz = e.p[1] + e.dz * door.u; const g = this.box(1.4, 0.03, 9, M.paving, px + nx * 5.5, 0.015, pz + nz * 5.5, 'okolis', 5, 9); g.rotation.y = Math.atan2(nx, nz); }
    // stabla izvan osi pogleda na pročelja i perspektive
    [[-40, 16, 1.3], [40, 17, 1.4], [-140, 16, 1.2], [157, 18, 1.25], [-65, 32, 1.6], [20, 34, 1.7], [108, 33, 1.5], [-115, 30, 1.5], [-160, 35, 1.6]].forEach(([a, R, s]) => this.tree(cx + R * Math.cos(a * Math.PI / 180), cz + R * Math.sin(a * Math.PI / 180), s));
    this.setStage(this.stage);
    if (!this.viewed) { this.view('persp'); this.viewed = true; }
  }
  tree(x, z, s) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.2 * s, 8), this.M.wood); t.position.y = 1.1 * s; g.add(t);
    [[0, 3.1, 0, 1.5], [0.7, 2.6, 0.3, 1.1], [-0.6, 2.7, -0.4, 1.15], [0.1, 3.9, -0.1, 1.0]].forEach(([a, b2, c, r], i) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 3), i % 2 ? this.M.leaf2 : this.M.leaf); l.position.set(a * s, b2 * s, c * s); g.add(l); });
    g.position.set(x, 0, z); g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); g.userData = { part: 'okolis', minStage: 5, maxStage: 9 }; this.root.add(g); this.parts.push(g);
  }
  wall(m, e) {
    const M = this.M, T = m.wallT;
    // profil zida: donji rub 0, gornji rub prati krov
    const us = [0, e.L]; const t = (m.ridgeX - e.p[0]) / (e.q[0] - e.p[0] || 1e-9) * e.L; if (t > 0.01 && t < e.L - 0.01 && Math.abs(e.dx) > 1e-6) us.push(t); us.sort((a, b) => a - b);
    const top = (u) => roofH(m, e.p[0] + e.dx * u) - 0.04;
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(e.L, 0)]; for (let k = us.length - 1; k >= 0; k--) pts.push(new THREE.Vector2(us[k], top(us[k])));
    const shape = new THREE.Shape(pts);
    const ops = m.openings.filter((o) => o.e === e.i);
    ops.forEach((o) => { const h = new THREE.Path(); const x0 = o.u - o.w / 2, y0 = Math.max(o.s, 0.001); h.moveTo(x0, y0); h.lineTo(x0, y0 + o.h); h.lineTo(x0 + o.w, y0 + o.h); h.lineTo(x0 + o.w, y0); h.lineTo(x0, y0); shape.holes.push(h); });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
    const [nx, nz] = outward(m, e);
    // lokalni sustav: X uz zid, Y gore, Z = -normala (prema unutra); vanjska ploha na rubu tlocrta
    const place = (obj, off = 0) => { const mtx = new THREE.Matrix4().makeBasis(new THREE.Vector3(e.dx, 0, e.dz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-nx, 0, -nz)); obj.applyMatrix4(mtx); obj.position.add(new THREE.Vector3(e.p[0] + nx * off, 0, e.p[1] + nz * off)); return obj; };
    const raw = this.add(place(new THREE.Mesh(geo, M.block)), 'zidovi', 2, 3);
    const fin = this.add(place(new THREE.Mesh(geo, M.fasada)), 'fasada', 4, 9);
    // podnožje (cokl) izvan zida, prekinuto kod vrata
    const cuts = ops.filter((o) => o.s < m.base).map((o) => [o.u - o.w / 2, o.u + o.w / 2]).sort((a, b) => a[0] - b[0]);
    let a = 0; const segs = []; cuts.forEach(([c0, c1]) => { if (c0 > a) segs.push([a, c0]); a = Math.max(a, c1); }); if (a < e.L) segs.push([a, e.L]);
    segs.forEach(([s0, s1]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0 + 0.04, m.base, 0.04), M.cokl); g.position.set((s0 + s1) / 2, m.base / 2, -0.02); this.add(place(g), 'fasada', 4, 9); });
    // stolarija
    ops.forEach((o) => {
      const grp = new THREE.Group(); const x0 = o.u - o.w / 2, y0 = Math.max(o.s, 0), fw = 0.07, dep = 0.12, inset = 0.14;
      const fr = (w, h, x, y) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), M.frame); g.position.set(x, y, inset + dep / 2); grp.add(g); };
      fr(o.w, fw, x0 + o.w / 2, y0 + o.h - fw / 2); fr(o.w, fw, x0 + o.w / 2, y0 + fw / 2); fr(fw, o.h, x0 + fw / 2, y0 + o.h / 2); fr(fw, o.h, x0 + o.w - fw / 2, y0 + o.h / 2);
      if (o.t === 'door') { const d = new THREE.Mesh(new THREE.BoxGeometry(o.w - 2 * fw, o.h - fw, 0.06), M.door); d.position.set(x0 + o.w / 2, y0 + (o.h - fw) / 2, inset + 0.06); grp.add(d); const gl = new THREE.Mesh(new THREE.BoxGeometry(0.22, o.h * 0.7, 0.07), M.glass); gl.position.set(x0 + o.w * 0.3, y0 + o.h * 0.5, inset + 0.06); grp.add(gl); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.05), M.metal); hd.position.set(x0 + o.w * 0.78, y0 + 1.05, inset - 0.01); grp.add(hd); }
      else {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(o.w - 2 * fw, o.h - 2 * fw, 0.02), M.glass); gl.position.set(x0 + o.w / 2, y0 + o.h / 2, inset + dep / 2); grp.add(gl);
        const nDiv = o.w > 2.4 ? 2 : o.w > 1.4 ? 1 : 0; for (let k = 1; k <= nDiv; k++) fr(fw, o.h, x0 + o.w * k / (nDiv + 1), y0 + o.h / 2);
        if (o.s > 0.2) { const sill = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.06, 0.03, inset + 0.06), M.metal); sill.position.set(x0 + o.w / 2, y0 - 0.015, (inset - 0.06) / 2); grp.add(sill); }
      }
      grp.traverse((c) => { c.castShadow = true; c.receiveShadow = true; });
      place(grp); grp.userData = { part: 'stolarija', minStage: 4, maxStage: 9 }; this.root.add(grp); this.parts.push(grp);
    });
  }
  roof(m) {
    const M = this.M, b = bbox(m), ov = m.ov, t = 0.22, E = edges(m);
    // tlocrt krova = tlocrt zidova pomaknut prema van za prepust (kosi zid → kosi rub krova)
    const n = m.fp.length, off = m.fp.map((v, i) => {
      const e1 = E[(i - 1 + n) % n], e2 = E[i], n1 = outward(m, e1), n2 = outward(m, e2), d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      return [v[0] + ov * (n1[0] + n2[0]) / d, v[1] + ov * (n1[1] + n2[1]) / d];
    });
    const clip = (poly, keepLeft) => { // Sutherland–Hodgman uz pravac x = sljeme
      const X = m.ridgeX, inside = (p) => keepLeft ? p[0] <= X + 1e-9 : p[0] >= X - 1e-9, out = [];
      poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], a = inside(p), c = inside(q); if (a) out.push(p); if (a !== c) { const k = (X - p[0]) / (q[0] - p[0]); out.push([X, p[1] + k * (q[1] - p[1])]); } });
      return out;
    };
    const slope = (keepLeft) => (m.ridge - m.eave) / Math.abs(m.ridgeX - (keepLeft ? b.x0 : b.x1));
    const H = (x) => m.ridge - Math.abs(x - m.ridgeX) * slope(x <= m.ridgeX);
    const plate = (poly, mat, dy, part, s0, s1, tex) => {
      const cosT = Math.cos(Math.atan(slope(poly[0][0] <= m.ridgeX + 1e-6 && poly.every((p) => p[0] <= m.ridgeX + 1e-6))));
      const sg = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1]))));
      const tp = sg.attributes.position, idx = sg.index.array, nv = tp.count, pos = [], uv = [], ind = [];
      const top = (x, z, k) => [x, H(x) + dy - k * t, z];
      for (let i = 0; i < nv; i++) { pos.push(...top(tp.getX(i), tp.getY(i), 0)); uv.push(tp.getY(i) / 3.0, Math.abs(tp.getX(i) - m.ridgeX) / cosT / 3.6); }
      for (let i = 0; i < nv; i++) { pos.push(...top(tp.getX(i), tp.getY(i), 1)); uv.push(0, 0); }
      for (let i = 0; i < idx.length; i += 3) ind.push(idx[i], idx[i + 2], idx[i + 1]);
      for (let i = 0; i < idx.length; i += 3) ind.push(nv + idx[i], nv + idx[i + 1], nv + idx[i + 2]);
      // rubovi (čelne daske)
      poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], o = pos.length / 3; [top(p[0], p[1], 0), top(q[0], q[1], 0), top(q[0], q[1], 1), top(p[0], p[1], 1)].forEach((v) => { pos.push(...v); uv.push(0, 0); }); ind.push(o, o + 2, o + 1, o, o + 3, o + 2); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
      const nTop = idx.length; g.clearGroups(); g.addGroup(0, nTop, 0); g.addGroup(nTop, nTop, 1); g.addGroup(nTop * 2, ind.length - nTop * 2, 2);
      const mesh = new THREE.Mesh(g, [mat, M.soffit, M.fascia]); return this.add(mesh, part, s0, s1);
    };
    const sides = [clip(off, true), clip(off, false)];
    sides.forEach((poly, k) => {
      if (poly.length < 3) return;
      // ShapeGeometry traži smjer suprotan kazaljci (u x–z), inače su normale okrenute
      let a = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }); if (a > 0) poly.reverse();
      const tiles = M.krov.clone(); tiles.map = this.tex.tiles.clone(); tiles.map.needsUpdate = true; tiles.side = THREE.DoubleSide;
      plate(poly, M.osb, 0, 'krov', 3, 3);
      plate(poly, tiles, 0.04, 'krov', 4, 9);
      // oluk i odvodne cijevi uz strehu
      const xe = k === 0 ? Math.min(...poly.map((p) => p[0])) : Math.max(...poly.map((p) => p[0]));
      const zs = poly.filter((p) => Math.abs(p[0] - xe) < 1e-3).map((p) => p[1]);
      if (zs.length >= 2) { const za = Math.min(...zs), zb = Math.max(...zs), L = zb - za, he = H(xe);
        const gut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, L, 14), M.metal); gut.rotation.x = Math.PI / 2; gut.position.set(xe + (k === 0 ? -0.05 : 0.05), he - 0.1, (za + zb) / 2); this.add(gut, 'limarija', 4, 9);
        const wx = k === 0 ? b.x0 : b.x1, corner = m.fp.filter((v) => Math.abs(v[0] - wx) < 1e-6).map((v) => v[1]);
        [Math.min(...corner) + 0.15, Math.max(...corner) - 0.15].forEach((z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, he - 0.1, 12), M.metal); p.position.set(wx + (k === 0 ? -0.1 : 0.1), (he - 0.1) / 2, z); this.add(p, 'limarija', 5, 9); });
      }
    });
    // sljemenjak duž sljemena
    const zr = []; off.forEach((p, i) => { const q = off[(i + 1) % n]; if ((p[0] - m.ridgeX) * (q[0] - m.ridgeX) <= 0 && p[0] !== q[0]) zr.push(p[1] + (m.ridgeX - p[0]) / (q[0] - p[0]) * (q[1] - p[1])); });
    if (zr.length >= 2) { const za = Math.min(...zr), zb = Math.max(...zr); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, zb - za, 16), M.krov); r.rotation.x = Math.PI / 2; r.position.set(m.ridgeX, m.ridge + 0.06, (za + zb) / 2); this.add(r, 'krov', 4, 9); }
  }
  fixRoofUV(g, L, D) { // gornja ploha: u = duž strehe, v = niz krov
    const uv = g.attributes.uv, pos = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { if (n.getY(i) > 0.5) uv.setXY(i, (pos.getZ(i) + D / 2) / D, (pos.getX(i) + L / 2) / L); }
    uv.needsUpdate = true;
  }
  setStage(s) {
    this.stage = s;
    this.parts.forEach((p) => { const u = p.userData; p.visible = s >= u.minStage && s <= u.maxStage; });
  }
  setColors(c) { Object.assign(this.model.colors, c); this.build(this.model); }
  frameBox() { const b = bbox(this.model); return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, r: Math.max(b.x1 - b.x0, b.z1 - b.z0), h: this.model.ridge }; }
  view(kind) {
    const f = this.frameBox(), cam = this.camera, ctl = this.controls, tgt = new THREE.Vector3(f.cx, f.h * 0.45, f.cz);
    let pos;
    if (typeof kind === 'number') { // pročelje: okomito na zid
      const e = edges(this.model)[kind], [nx, nz] = outward(this.model, e); const mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[1] + e.q[1]) / 2;
      const dist = Math.max(e.L, f.h) * 2.15 + 6; tgt.set(mx, f.h * 0.45, mz); pos = new THREE.Vector3(mx + nx * dist, 1.7 + f.h * 0.12, mz + nz * dist);
    } else if (kind === 'top') pos = new THREE.Vector3(f.cx - f.r * 1.4, f.r * 3.2, f.cz + f.r * 1.6);
    else pos = new THREE.Vector3(f.cx - f.r * 1.9, f.h * 0.9, f.cz + f.r * 2.3);
    this.anim(pos, tgt);
  }
  anim(pos, tgt) {
    const cam = this.camera, ctl = this.controls, p0 = cam.position.clone(), t0 = ctl.target.clone(), t1 = performance.now();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { cam.position.copy(pos); ctl.target.copy(tgt); return; }
    const step = () => { const k = Math.min(1, (performance.now() - t1) / 700), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; cam.position.lerpVectors(p0, pos, e); ctl.target.lerpVectors(t0, tgt, e); if (k < 1) requestAnimationFrame(step); };
    step();
  }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const hit = this.ray.intersectObjects(this.parts.filter((p) => p.visible), true)[0];
    let o = hit?.object; while (o && !o.userData?.part) o = o.parent;
    this.api.onPick && this.api.onPick(o ? o.userData.part : null);
  }
  // snimka u visokoj rezoluciji (QHD 2560×1440 zadano) s natpisom
  async snapshot(w = 2560, h = 1440, caption = '') {
    const r = this.renderer, cam = this.camera, oldPR = r.getPixelRatio(), size = r.getSize(new THREE.Vector2()), oldAspect = cam.aspect;
    r.setPixelRatio(1); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    r.render(this.scene, cam);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(r.domElement, 0, 0, w, h);
    r.setPixelRatio(oldPR); r.setSize(size.x, size.y, false); cam.aspect = oldAspect; cam.updateProjectionMatrix();
    if (caption) {
      const lines = caption.split('\n'), fs = Math.round(h / 42), pad = Math.round(h / 40), lh = fs * 1.35, bw = Math.max(...lines.map((l) => { g.font = `600 ${fs}px "IBM Plex Sans", Arial`; return g.measureText(l).width; })) + pad * 2;
      g.fillStyle = 'rgba(16,22,30,.62)'; g.beginPath(); g.roundRect(pad, h - pad - lh * lines.length - pad, bw, lh * lines.length + pad, fs * 0.5); g.fill();
      g.fillStyle = '#fff'; lines.forEach((l, i) => { g.font = `${i ? 400 : 600} ${i ? fs * 0.82 : fs}px "IBM Plex Sans", Arial`; g.fillText(l, pad * 2, h - pad - lh * (lines.length - i - 1) - pad * 0.9); });
    }
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  }
}
