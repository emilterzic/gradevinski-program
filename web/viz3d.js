// 3D prikaz objekta: model iz nacrta (tlocrt, presjek, pročelja) + faze gradnje iz troškovnika.
// Tlocrt: x udesno, z prema dolje (kao na nacrtu); y = visina. Sve u metrima.
// Kvaliteta: nebo i sunce, meke sjene, ambijentalna okluzija (GTAO), MSAA, teksture s reljefom (normal mape),
// arhitektonska perspektiva s ravnim vertikalama, slike s višestrukim uzorkovanjem (SSAA).
// Izvedba: oblik krova, konstrukcija, temelji, fasada i stolarija dolaze iz odabira u model.js (build).
// Brzina: sjene se računaju samo kad se scena promijeni, geometrija je spojena po materijalu (malo poziva crtanja),
// dok se model okreće okluzija ide u pola rezolucije, a kad stane iscrta se jedna slika u punoj kvaliteti.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

import { DEFAULT_COLORS, COLOR_PRESETS, demoModel, autoModel, edges, bbox, centroid, outward, offsetPoly, roofGeom, wallBreaks, openingsIn, normBuild, optOf, BUILD_KEYS, levelsOf, topOf } from './model.js';
export { DEFAULT_COLORS, COLOR_PRESETS, demoModel, autoModel };

/* ---------- proceduralne teksture (boja + reljef) ---------- */
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SN = new SimplexNoise({ random: rand });
function cnv(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; }
function fbm(x, y, oct = 4) { let a = 0, f = 1, w = 0.5; for (let i = 0; i < oct; i++) { a += w * SN.noise(x * f, y * f); f *= 2; w *= 0.5; } return a; }
// boja + visina se crtaju zajedno; iz visine se računa normal mapa
function texPair(size, draw, normalStrength = 2) {
  const col = cnv(size), hei = cnv(size);
  draw(col.getContext('2d'), hei.getContext('2d'), size);
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace;
  const nrm = new THREE.CanvasTexture(heightToNormal(hei, normalStrength));
  [map, nrm].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; });
  return { map, nrm };
}
function heightToNormal(c, k) {
  const s = c.width, src = c.getContext('2d').getImageData(0, 0, s, s).data, out = cnv(s), g = out.getContext('2d'), img = g.createImageData(s, s), d = img.data;
  const H = (x, y) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}
function grain(c, h, s, base, amt, n, hamt = 0.5) {
  c.fillStyle = base; c.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { const x = rand() * s, y = rand() * s, v = rand() > 0.5 ? 255 : 0, r = 1 + rand() * 1.5; c.fillStyle = `rgba(${v},${v},${v},${rand() * amt})`; c.fillRect(x, y, r, r); h.fillStyle = `rgba(${v},${v},${v},${rand() * hamt})`; h.fillRect(x, y, r, r); }
}
let TEX_CACHE = null;
const breathe = () => new Promise((r) => setTimeout(r));
async function makeTextures() {
  if (TEX_CACHE) return TEX_CACHE;
  seed = 11;
  const T = {};
  // silikatna žbuka: sitno zrno
  T.render = texPair(1024, (c, h, s) => {
    grain(c, h, s, '#f4f4f4', 0.06, 90000, 0.7);
    for (let y = 0; y < s; y += 2) for (let x = 0; x < s; x += 8) { const v = fbm(x / 160, y / 160, 3); c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) * 0.04})`; c.fillRect(x, y, 8, 2); }
  }, 3.5);
  await breathe();
  // podnožje: kamene ploče
  T.plinth = texPair(1024, (c, h, s) => {
    grain(c, h, s, '#e2e0dc', 0.12, 60000, 0.6);
    const rows = 2, cols = 4;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const x = k * s / cols + (r % 2 ? s / cols / 2 : 0), y = r * s / rows; const g = 205 + rand() * 30; c.fillStyle = `rgba(${g},${g - 2},${g - 6},.35)`; c.fillRect(x + 4, y + 4, s / cols - 8, s / rows - 8); }
    c.strokeStyle = 'rgba(40,40,40,.55)'; h.strokeStyle = '#000'; c.lineWidth = h.lineWidth = 5;
    for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(0, r * s / rows); c.lineTo(s, r * s / rows); c.stroke(); h.beginPath(); h.moveTo(0, r * s / rows); h.lineTo(s, r * s / rows); h.stroke(); }
    for (let r = 0; r < rows; r++) for (let k = 0; k <= cols; k++) { const x = k * s / cols + (r % 2 ? s / cols / 2 : 0); [c, h].forEach((g) => { g.beginPath(); g.moveTo(x % s, r * s / rows); g.lineTo(x % s, (r + 1) * s / rows); g.stroke(); }); }
  }, 4);
  await breathe();
  // glineni utoreni crijep: redovi s preklopom, valovit profil, varijacija boje po crijepu
  T.tiles = texPair(1024, (c, h, s) => {
    c.fillStyle = '#4a4a4a'; c.fillRect(0, 0, s, s); h.fillStyle = '#000'; h.fillRect(0, 0, s, s);
    const rows = 10, cols = 8, th = s / rows, tw = s / cols;
    for (let r = 0; r < rows; r++) for (let k = -1; k <= cols; k++) {
      const x0 = k * tw + (r % 2 ? tw / 2 : 0), y0 = r * th, b = 200 + rand() * 45, hue = (rand() - 0.5) * 18;
      for (let i = 0; i < tw; i++) { // valoviti presjek crijepa
        const t = i / tw, prof = 0.55 + 0.45 * Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.25 * Math.sin(t * Math.PI);
        const L = b * (0.72 + 0.32 * prof);
        c.fillStyle = `rgb(${Math.min(255, L + hue)},${Math.min(255, L)},${Math.min(255, L - hue * 0.5)})`; c.fillRect(x0 + i, y0 + 2, 1, th - 3);
        const v = Math.round(255 * (0.35 + 0.5 * prof)); h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(x0 + i, y0 + 2, 1, th - 3);
      }
      const hg = h.createLinearGradient(0, y0, 0, y0 + th); hg.addColorStop(0, 'rgba(0,0,0,.45)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); h.fillStyle = hg; h.fillRect(x0, y0 + 2, tw, th - 3);
      const gr = c.createLinearGradient(0, y0 + th - 10, 0, y0 + th); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = gr; c.fillRect(x0, y0 + th - 10, tw, 10);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x0, y0, 2, th);
    }
    for (let i = 0; i < 26000; i++) { c.fillStyle = `rgba(${rand() > .5 ? '255,255,255' : '0,0,0'},${rand() * 0.05})`; c.fillRect(rand() * s, rand() * s, 2, 2); }
  }, 6);
  await breathe();
  // opeka (blok) za fazu konstrukcije
  T.block = texPair(1024, (c, h, s) => {
    c.fillStyle = '#c9bfae'; c.fillRect(0, 0, s, s); h.fillStyle = '#202020'; h.fillRect(0, 0, s, s);
    const rows = 4, bh = s / rows, bw = bh * 1.66;
    for (let r = 0; r < rows; r++) for (let x = -bw; x < s + bw; x += bw) {
      const o = r % 2 ? bw / 2 : 0, cl = ['#c4683f', '#cc7448', '#bd6239', '#c86e44'][Math.floor(rand() * 4)];
      c.fillStyle = cl; c.fillRect(x + o + 4, r * bh + 4, bw - 8, bh - 8); h.fillStyle = '#c8c8c8'; h.fillRect(x + o + 4, r * bh + 4, bw - 8, bh - 8);
      c.fillStyle = 'rgba(60,25,10,.42)'; h.fillStyle = '#505050';
      for (let k = 0; k < 5; k++) { const hx = x + o + 16 + k * ((bw - 32) / 5), hy = r * bh + bh * 0.38, hw = (bw - 32) / 5 - 7, hh = bh * 0.24; c.fillRect(hx, hy, hw, hh); h.fillRect(hx, hy, hw, hh); }
    }
    for (let i = 0; i < 30000; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.06})`; c.fillRect(rand() * s, rand() * s, 2, 2); }
  }, 3);
  await breathe();
  T.concrete = texPair(512, (c, h, s) => { grain(c, h, s, '#b9b6ae', 0.14, 40000, 0.5); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.05})`; c.beginPath(); c.arc(rand() * s, rand() * s, 10 + rand() * 40, 0, 7); c.fill(); } }, 2);
  await breathe();
  T.soil = texPair(512, (c, h, s) => { grain(c, h, s, '#6e5034', 0.3, 50000, 0.9); for (let i = 0; i < 300; i++) { const g = 90 + rand() * 60; c.fillStyle = `rgb(${g},${g * 0.8},${g * 0.6})`; c.beginPath(); c.arc(rand() * s, rand() * s, 1 + rand() * 4, 0, 7); c.fill(); } }, 4);
  await breathe();
  // travnjak: vlati + mrlje
  T.grass = texPair(1024, (c, h, s) => {
    c.fillStyle = '#d6d6d6'; c.fillRect(0, 0, s, s); h.fillStyle = '#606060'; h.fillRect(0, 0, s, s);
    for (let i = 0; i < 26000; i++) { const x = rand() * s, y = rand() * s, l = 4 + rand() * 9, a = -0.5 + rand(), g = 150 + rand() * 105; c.strokeStyle = `rgba(${g * 0.9},${g},${g * 0.75},.75)`; h.strokeStyle = `rgba(255,255,255,${0.3 + rand() * 0.5})`; c.lineWidth = h.lineWidth = 1.2; [c, h].forEach((q) => { q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); q.stroke(); }); }
  }, 2.5);
  await breathe();
  // opločnik: betonske ploče 40×40 s fugama
  T.paving = texPair(1024, (c, h, s) => {
    c.fillStyle = '#7d7a73'; c.fillRect(0, 0, s, s); h.fillStyle = '#000'; h.fillRect(0, 0, s, s);
    const n = 5, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const g = 188 + rand() * 26; c.fillStyle = `rgb(${g},${g - 3},${g - 9})`; c.fillRect(x * w + 3, y * w + 3, w - 6, w - 6); h.fillStyle = '#d0d0d0'; h.fillRect(x * w + 3, y * w + 3, w - 6, w - 6); }
    for (let i = 0; i < 50000; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.07})`; c.fillRect(rand() * s, rand() * s, 2, 2); }
  }, 5);
  await breathe();
  T.osb = texPair(512, (c, h, s) => { c.fillStyle = '#c99a5b'; c.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s); for (let i = 0; i < 1600; i++) { const col = rand() > .5 ? '120,70,20' : '240,200,140'; c.fillStyle = `rgba(${col},${0.2 + rand() * 0.3})`; h.fillStyle = `rgba(${rand() > .5 ? '255,255,255' : '0,0,0'},.3)`; const x = rand() * s, y = rand() * s, a = rand() * 3.14, w = 10 + rand() * 18, hh = 3 + rand() * 4; [c, h].forEach((q) => { q.save(); q.translate(x, y); q.rotate(a); q.fillRect(0, 0, w, hh); q.restore(); }); } }, 2);
  await breathe();
  T.leaf = texPair(512, (c, h, s) => { c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, s, s); h.fillStyle = '#404040'; h.fillRect(0, 0, s, s); for (let i = 0; i < 9000; i++) { const x = rand() * s, y = rand() * s, r = 2 + rand() * 5, g = 140 + rand() * 115; c.fillStyle = `rgb(${g * 0.85},${g},${g * 0.7})`; h.fillStyle = `rgba(255,255,255,${0.4 + rand() * 0.6})`; [c, h].forEach((q) => { q.beginPath(); q.ellipse(x, y, r, r * 0.55, rand() * 3.14, 0, 7); q.fill(); }); } }, 5);
  await breathe();
  // fasadna (klinker) i puna opeka: 4 opeke × 13 redova na 1 m
  T.brick = texPair(1024, (c, h, s) => {
    c.fillStyle = '#b9b2a5'; c.fillRect(0, 0, s, s); h.fillStyle = '#2c2c2c'; h.fillRect(0, 0, s, s);
    const rows = 13, bh = s / rows, bw = s / 4, j = 6;
    for (let r = 0; r < rows; r++) for (let x = -bw; x < s + bw; x += bw) {
      const o = r % 2 ? bw / 2 : 0, k = rand(), R = 150 + k * 48, G = 72 + k * 30 + rand() * 12, B = 54 + k * 20;
      c.fillStyle = `rgb(${R},${G},${B})`; c.fillRect(x + o + j / 2, r * bh + j / 2, bw - j, bh - j);
      const hv = 185 + rand() * 50; h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(x + o + j / 2, r * bh + j / 2, bw - j, bh - j);
    }
    for (let i = 0; i < 60000; i++) { const v = rand() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${rand() * 0.07})`; c.fillRect(rand() * s, rand() * s, 2, 2); h.fillStyle = `rgba(${v},${v},${v},${rand() * 0.2})`; h.fillRect(rand() * s, rand() * s, 2, 2); }
  }, 4);
  await breathe();
  // kamena obloga: nepravilni redovi klesanaca, 1,6 m po teksturi
  T.stone = texPair(1024, (c, h, s) => {
    c.fillStyle = '#8d877d'; c.fillRect(0, 0, s, s); h.fillStyle = '#303030'; h.fillRect(0, 0, s, s);
    const hs = [0.2, 0.14, 0.24, 0.16, 0.26]; let y = 0;
    hs.forEach((hh) => {
      const rh = hh * s; let x = -rand() * 0.2 * s;
      while (x < s) {
        const w = (0.16 + rand() * 0.3) * s, g = 196 + rand() * 26, t = rand();
        const col = `rgb(${g},${g - 4 - t * 6},${g - 12 - t * 12})`, hv = 170 + rand() * 60;
        [0, s, -s].forEach((dx) => { c.fillStyle = col; c.fillRect(x + dx + 2.5, y + 2.5, w - 5, rh - 5); h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(x + dx + 2.5, y + 2.5, w - 5, rh - 5); });
        x += w;
      }
      y += rh;
    });
    for (let i = 0; i < 70000; i++) { const v = rand() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${rand() * 0.09})`; c.fillRect(rand() * s, rand() * s, 2 + rand() * 3, 2); h.fillStyle = `rgba(${v},${v},${v},${rand() * 0.25})`; h.fillRect(rand() * s, rand() * s, 3, 3); }
  }, 5);
  await breathe();
  // ventilirana fasada: ploče 1,2 × 0,6 m s fugama (2,4 m po teksturi)
  T.panels = texPair(1024, (c, h, s) => {
    grain(c, h, s, '#ecebe8', 0.035, 40000, 0.25);
    const cols = 2, rows = 4, pw = s / cols, ph = s / rows;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const g = rand() * 0.05; c.fillStyle = `rgba(0,0,0,${g})`; c.fillRect(k * pw, r * ph, pw, ph); }
    c.fillStyle = 'rgba(25,25,25,.85)'; h.fillStyle = '#000';
    for (let r = 0; r <= rows; r++) [c, h].forEach((g) => g.fillRect(0, (r * ph - 3 + s) % s, s, 6));
    for (let k = 0; k <= cols; k++) [c, h].forEach((g) => g.fillRect((k * pw - 3 + s) % s, 0, 6, s));
    c.fillStyle = 'rgba(120,120,120,.9)'; for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) [[0.08, 0.14], [0.92, 0.14], [0.08, 0.86], [0.92, 0.86]].forEach(([a, b]) => { c.beginPath(); c.arc(k * pw + a * pw, r * ph + b * ph, 3, 0, 7); c.fill(); });
  }, 3);
  await breathe();
  // drvena fasada: okomite daske 12 cm (1,2 m po teksturi)
  T.wood = texPair(1024, (c, h, s) => {
    const n = 10, bw = s / n;
    for (let k = 0; k < n; k++) {
      const t = rand(), R = 176 + t * 40, G = 122 + t * 34, B = 72 + t * 26;
      c.fillStyle = `rgb(${R},${G},${B})`; c.fillRect(k * bw, 0, bw, s); h.fillStyle = '#b0b0b0'; h.fillRect(k * bw, 0, bw, s);
      for (let i = 0; i < 46; i++) { const x = k * bw + 3 + rand() * (bw - 6), a = 0.05 + rand() * 0.16; c.fillStyle = `rgba(70,35,10,${a})`; c.fillRect(x, 0, 1 + rand() * 1.6, s); h.fillStyle = `rgba(0,0,0,${a})`; h.fillRect(x, 0, 1.5, s); }
      c.fillStyle = 'rgba(30,15,5,.9)'; c.fillRect(k * bw, 0, 3, s); h.fillStyle = '#000'; h.fillRect(k * bw, 0, 4, s);
    }
  }, 3);
  await breathe();
  // falcani lim: stojeći falcevi svakih 60 cm (2,4 m po teksturi)
  T.seam = texPair(512, (c, h, s) => {
    grain(c, h, s, '#e6e6e6', 0.03, 12000, 0.15);
    const n = 4, w = s / n;
    for (let k = 0; k < n; k++) { const x = k * w + w / 2; c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 3, 0, 6, s); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 3, 0, 5, s); h.fillStyle = '#fff'; h.fillRect(x - 4, 0, 8, s); }
  }, 6);
  await breathe();
  // armirani beton iz oplate: ploče 1,25 × 2,5 m, rupe od spona
  T.formwork = texPair(1024, (c, h, s) => {
    grain(c, h, s, '#c4c1ba', 0.1, 70000, 0.4);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.045})`; c.beginPath(); c.arc(rand() * s, rand() * s, 20 + rand() * 80, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(40,40,40,.5)'; h.fillStyle = '#404040';
    [0, s / 2].forEach((x) => [c, h].forEach((g) => g.fillRect(x, 0, 4, s))); [c, h].forEach((g) => g.fillRect(0, 0, s, 4));
    c.fillStyle = 'rgba(30,30,30,.75)'; h.fillStyle = '#000';
    for (let k = 0; k < 2; k++) for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.25, 0.75]) [c, h].forEach((g) => { g.beginPath(); g.arc(k * s / 2 + fx * s / 2, fy * s, 7, 0, 7); g.fill(); });
  }, 3);
  await breathe();
  T.bark = texPair(256, (c, h, s) => { c.fillStyle = '#6a4a32'; c.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s); for (let i = 0; i < 400; i++) { const x = rand() * s, g = 60 + rand() * 50; c.fillStyle = `rgba(${g},${g * 0.75},${g * 0.55},.7)`; h.fillStyle = `rgba(0,0,0,.5)`; c.fillRect(x, 0, 2 + rand() * 3, s); h.fillRect(x, 0, 2, s); } }, 3);
  await breathe();
  return (TEX_CACHE = T);
}

/* ---------- geometrija ---------- */
// spoji sve mreže u grupi u po jednu mrežu za svaki materijal (manje poziva crtanja, ista slika)
function mergeMeshes(root, noShadow = new Set()) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), by = new Map(), m4 = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    if (!by.has(o.material)) by.set(o.material, { pos: [], nrm: [], uv: [] });
    const b = by.get(o.material); b.pos.push(g.attributes.position.array); b.nrm.push(g.attributes.normal.array); b.uv.push(g.attributes.uv.array);
    g.dispose(); o.geometry.dispose();
  });
  const cat = (arrs) => { const out = new Float32Array(arrs.reduce((n, a) => n + a.length, 0)); let k = 0; arrs.forEach((a) => { out.set(a, k); k += a.length; }); return out; };
  const grp = new THREE.Group();
  by.forEach((b, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat(b.pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(b.nrm), 3)); g.setAttribute('uv', new THREE.BufferAttribute(cat(b.uv), 2));
    const mesh = new THREE.Mesh(g, mat); mesh.userData.noShadow = noShadow.has(mat); grp.add(mesh);
  });
  return grp;
}

export class Viz3D {
  // teksture se pripremaju s predasima, da stranica ne zastane dok se 3D otvara
  static async create(host, api) { return new Viz3D(host, api, await makeTextures()); }
  constructor(host, api, textures) {
    this.host = host; this.api = api; this.stage = 5; this.parts = []; this.needFull = true; this.needFast = false; this.refined = true; this.lastMove = 0; this.level = 0; this.ema = 16; this.nFrames = 0; this.prevT = 0;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.pr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(this.pr);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.85; r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement); Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%' });
    this.maxAniso = r.capabilities.getMaxAnisotropy();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#e7edf0', 90, 650);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 5000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI / 2.03, minDistance: 5, maxDistance: 90 });
    // prigušenje okretanja ima dug „rep” sitnih pomaka: ispod pola piksela se ne crta, pa oštra slika stiže odmah
    this.lp = new THREE.Vector3(); this.dragging = false;
    this.controls.addEventListener('start', () => { this.dragging = true; }); this.controls.addEventListener('end', () => { this.dragging = false; });
    this.tex = textures;
    Object.values(this.tex).forEach((p) => { p.map.anisotropy = p.nrm.anisotropy = this.maxAniso; });
    this.setupSky(); this.lights();
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.setupComposer();
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); let down = null;
    r.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    r.domElement.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.pick(e); down = null; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.running = true;
    // crta se samo kad treba: brza slika dok se model miče, puna kvaliteta čim stane
    const loop = (t) => {
      if (!this.running) return; requestAnimationFrame(loop);
      if (!this.host.clientWidth) return;
      if (this.controls.update()) { const cam = this.camera.position, d = cam.distanceTo(this.lp) / Math.max(1, cam.distanceTo(this.controls.target)); if (this.dragging || d > 4e-4) { this.needFast = true; this.lp.copy(cam); } }
      if (this.needFull) { this.needFull = this.needFast = false; this.refined = true; this.prevT = 0; this.draw(false); }
      else if (this.needFast) { this.needFast = false; this.refined = false; this.lastMove = t; this.pace(t); this.draw(true); }
      else if (!this.refined && t - this.lastMove > 140) { this.refined = true; this.prevT = 0; this.draw(false); }
    };
    requestAnimationFrame(loop);
  }
  get dirty() { return this.needFull; }
  set dirty(v) { if (v) this.needFull = true; }
  draw(moving) {
    this.aoFull.enabled = !moving; this.aoHalf.enabled = moving;
    (moving && this.fast ? this.fast : this.composer).render();
  }
  // ako računalo ne stiže ~35 sličica u sekundi dok se model okreće, smanji rezoluciju samo za vrijeme pomicanja
  pace(t) {
    const prev = this.prevT; this.prevT = t;
    if (!prev || t <= prev) return; // prva sličica nakon mirovanja se ne mjeri
    this.ema = this.ema * 0.85 + Math.min(t - prev, 250) * 0.15; this.nFrames++;
    if (this.nFrames > 14 && this.ema > 29 && this.level < 2) { this.level++; this.nFrames = 0; this.ema = 16; this.setupFast(); }
  }
  aoPass(w, h, half) {
    const ao = new GTAOPass(this.scene, this.camera, w, h);
    ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: half ? 4 : 6, rings: 2, samples: 16 });
    ao.blendIntensity = 0.9;
    if (half) { const full = ao.setSize.bind(ao); ao.setSize = (a, b) => full(Math.max(1, Math.ceil(a / 2)), Math.max(1, Math.ceil(b / 2))); }
    return ao;
  }
  setupFast() {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500, k = this.pr * [1, 0.75, 0.6][this.level];
    if (this.fast) { this.fast.renderTarget1.dispose(); this.fast.renderTarget2.dispose(); this.fastAo.dispose?.(); }
    const c = this.fast = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(Math.ceil(w * k), Math.ceil(h * k), { type: THREE.HalfFloatType, samples: 4 }));
    c.setPixelRatio(k); c.setSize(w, h);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.fastAo = this.aoPass(w, h, true); c.addPass(this.fastAo); c.addPass(new OutputPass());
  }
  dispose() { this.running = false; this.ro.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); }
  syncDpr() { const pr = Math.min(window.devicePixelRatio || 1, 2); if (pr === this.pr) return; this.pr = pr; this.renderer.setPixelRatio(pr); this.composer.setPixelRatio(pr); if (this.fast) this.setupFast(); this.forceResize = true; this.resize(); }
  invalidateShadows() { this.sunLight.shadow.needsUpdate = true; this.needFull = true; }

  // nebo: kontrolirani gradijent (zenit → horizont) + sunčev disk; isti se koristi za odsjaje (PMREM)
  skyDome(radius, withSun) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { zen: { value: new THREE.Color('#4f82c4') }, mid: { value: new THREE.Color('#9fc0e2') }, hor: { value: new THREE.Color('#e7edf0') }, gnd: { value: new THREE.Color('#7d8a68') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunK: { value: withSun ? 1 : 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 zen, mid, hor, gnd, sunDir; uniform float sunK; varying vec3 vD;
        void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(hor, mid, smoothstep(0.0, 0.22, y)) : mix(hor, gnd, smoothstep(0.0, 0.08, -y));
          c = y > 0.22 ? mix(mid, zen, smoothstep(0.22, 0.85, y)) : c;
          float sd = max(dot(normalize(vD), normalize(sunDir)), 0.0);
          c += sunK * (vec3(1.0, 0.93, 0.8) * pow(sd, 900.0) * 18.0 + vec3(1.0, 0.9, 0.75) * pow(sd, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat); m.frustumCulled = false; return m;
  }
  setupSky() {
    this.sky = this.skyDome(3000, true); this.scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envScene = new THREE.Scene(); this.envSky = this.skyDome(50, true); this.envScene.add(this.envSky);
  }
  lights() {
    this.hemi = new THREE.HemisphereLight('#dfeaff', '#5d5140', 0.5); this.scene.add(this.hemi);
    const sun = this.sunLight = new THREE.DirectionalLight('#ffeed6', 2.7);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5; sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    this.scene.add(sun); this.scene.add(sun.target);
    const fill = this.fill = new THREE.DirectionalLight('#cfe0ff', 0.45); this.scene.add(fill); this.scene.add(fill.target);
  }
  // sunce dolazi s lijeve strane promatrača pod ~45°, da svako pročelje dobije lijepo, plastično svjetlo
  placeSun(camPos, target) {
    const v = new THREE.Vector3().subVectors(camPos, target).setY(0).normalize();
    const az = Math.atan2(v.z, v.x) + 1.15, el = 0.58, d = this.sunD || 60;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    this.sunLight.position.copy(target).addScaledVector(dir, d); this.sunLight.target.position.copy(target);
    this.fill.position.copy(target).addScaledVector(new THREE.Vector3(-dir.x, 0.5, -dir.z), d); this.fill.target.position.copy(target);
    this.sky.material.uniforms.sunDir.value.copy(dir); this.envSky.material.uniforms.sunDir.value.copy(dir);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0); this.scene.environment = this.envRT.texture;
    this.invalidateShadows();
  }
  setupComposer() {
    const r = this.renderer, w = this.host.clientWidth || 800, h = this.host.clientHeight || 500;
    const rt = new THREE.WebGLRenderTarget(w * this.pr, h * this.pr, { type: THREE.HalfFloatType, samples: 4 });
    const c = this.composer = new EffectComposer(r, rt);
    c.setPixelRatio(this.pr); c.setSize(w, h);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.aoFull = this.aoPass(w, h, false); this.aoHalf = this.aoPass(w, h, true); this.aoHalf.enabled = false;
    c.addPass(this.aoFull); c.addPass(this.aoHalf); c.addPass(new OutputPass());
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return; // kartica je skrivena
    if (w === this.w && h === this.h && !this.forceResize) return;
    this.w = w; this.h = h; this.forceResize = false;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h); if (this.fast) this.fast.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.needFull = true;
  }

  mats(m) {
    const C = m.colors, T = this.tex, B = this.B;
    const P = (pair, rep, opt = {}) => { const map = pair.map.clone(), nrm = pair.nrm.clone(); [map, nrm].forEach((t) => { t.needsUpdate = true; t.repeat.set(rep, rep); }); return new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(opt.ns ?? 0.6, opt.ns ?? 0.6), roughness: opt.rough ?? 0.9, color: opt.color ?? '#ffffff', metalness: opt.metal ?? 0, side: opt.side ?? THREE.FrontSide }); };
    // materijali ovise o odabranoj izvedbi (fasada, konstrukcija, stolarija, pokrov)
    const plaster = [T.render, 0.45, { rough: 0.94, ns: 1.0 }];
    const FAC = { eticsEps: plaster, eticsVuna: plaster, ventilirana: [T.panels, 1 / 2.4, { rough: 0.55, ns: 0.6 }], kamen: [T.stone, 1 / 1.6, { rough: 0.86, ns: 1.3 }], klinker: [T.brick, 1, { rough: 0.88, ns: 1.0 }], drvo: [T.wood, 1 / 1.2, { rough: 0.72, ns: 0.8 }] }[B.fasada] || plaster;
    const blk = [T.block, 0.6, { rough: 0.95, ns: 0.9 }];
    const BLK = { puna: [T.brick, 1, { rough: 0.92, ns: 1.0 }], ab: [T.formwork, 1 / 2.5, { rough: 0.9, ns: 0.7, color: '#b9b6ae' }] }[B.konstrukcija] || blk;
    const FR = { pvc: [0.38, 0.1], alu: [0.3, 0.65], drvo: [0.62, 0], drvoalu: [0.32, 0.55] }[B.stolarija] || [0.38, 0.1];
    const pk = optOf('pokrov', B.pokrov), dbl = THREE.DoubleSide;
    const cover = B.pokrov === 'sljunak' ? P(T.concrete, 1.6, { color: pk.boja, rough: 1, ns: 1.4 })
      : B.pokrov === 'zeleni' ? P(T.grass, 0.8, { color: pk.boja, rough: 1, ns: 1 })
      : B.pokrov === 'lim' ? new THREE.MeshStandardMaterial({ color: C.krov, map: T.seam.map, normalMap: T.seam.nrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.42, metalness: 0.55, side: dbl, envMapIntensity: 1.0 })
      : new THREE.MeshStandardMaterial({ color: C.krov, map: T.tiles.map, normalMap: T.tiles.nrm, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.72, side: dbl, envMapIntensity: 0.8 });
    const M = {
      fasada: P(FAC[0], FAC[1], { ...FAC[2], color: C.fasada }),
      render: P(T.render, 0.45, { color: C.fasada, rough: 0.94, ns: 1.0 }),
      cokl: P(T.plinth, 0.55, { color: C.cokl, rough: 0.8, ns: 0.8 }),
      block: P(BLK[0], BLK[1], BLK[2]),
      cover, ridge: new THREE.MeshStandardMaterial({ color: C.krov, roughness: B.pokrov === 'lim' ? 0.4 : 0.6, metalness: B.pokrov === 'lim' ? 0.55 : 0 }),
      xps: new THREE.MeshStandardMaterial({ color: '#e3cd72', roughness: 0.9 }),
      trench: new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 1 }),
      osb: P(T.osb, 0.5, { rough: 0.9, side: THREE.DoubleSide }),
      soffit: new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.85, side: THREE.DoubleSide }),
      fascia: new THREE.MeshStandardMaterial({ color: C.limarija, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide }),
      frame: new THREE.MeshStandardMaterial({ color: C.stolarija, roughness: FR[0], metalness: FR[1] }),
      glass: new THREE.MeshPhysicalMaterial({ color: B.staklo === '2' ? '#2b3a45' : '#25323c', roughness: 0.02, metalness: 0.05, transparent: true, opacity: 0.86, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.01, specularIntensity: 1 }),
      room: new THREE.MeshStandardMaterial({ color: '#3a342e', roughness: 1, side: THREE.BackSide, envMapIntensity: 0.2 }),
      curtain: new THREE.MeshStandardMaterial({ color: '#e9e1d2', roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.4 }),
      door: new THREE.MeshStandardMaterial({ color: C.stolarija, roughness: FR[0] + 0.04, metalness: Math.max(0.05, FR[1] * 0.6) }),
      metal: new THREE.MeshStandardMaterial({ color: C.limarija, roughness: 0.32, metalness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: '#a7adb3', roughness: 0.25, metalness: 0.9 }),
      concrete: P(T.concrete, 0.4, { color: '#a7a49c', rough: 0.95 }),
      soil: P(T.soil, 0.35, { rough: 1, ns: 1 }),
      grass: P(T.grass, 0.4, { color: C.teren || DEFAULT_COLORS.teren, rough: 1, ns: 0.8 }),
      paving: P(T.paving, 0.5, { rough: 0.88, ns: 0.9 }),
      gravel: P(T.concrete, 1.6, { color: '#cfc9be', rough: 1, ns: 1.4 }),
      railGlass: new THREE.MeshPhysicalMaterial({ color: '#a9d3e6', transparent: true, opacity: 0.34, roughness: 0.02, envMapIntensity: 1.2, side: THREE.DoubleSide }),
      bark: P(T.bark, 1, { rough: 0.95, ns: 1.2 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#ffe9b0', emissiveIntensity: 0.6 }),
    };
    const kosi = B.krovOblik !== 'flat';
    this.byColor = { fasada: [M.fasada, M.render], cokl: [M.cokl], stolarija: [M.frame, M.door], limarija: [M.metal, M.fascia], teren: [M.grass], krov: kosi ? [M.cover, M.ridge] : [] };
    M.leaf = [0, 1, 2].map((k) => P(T.leaf, 1.5, { color: ['#7aa35a', '#6a9550', '#8aae66'][k], rough: 0.9, ns: 0.45 }));
    // makro varijacija boje travnjaka po svijetu (mrlje), da teren ne izgleda kao tapeta
    M.grass.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat mv = vn(vWp.xz*0.08)*0.6+vn(vWp.xz*0.3)*0.4;\ndiffuseColor.rgb *= mix(0.9, 1.06, mv);');
    };
    return M;
  }
  add(mesh, part, minStage = 0, maxStage = 9) { mesh.traverse((o) => { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; }); mesh.userData = { part, minStage, maxStage }; (this.cur || this.root).add(mesh); this.parts.push(mesh); return mesh; }
  box(w, h, d, mat, x, y, z, part, s0, s1) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); g.position.set(x, y, z); return this.add(g, part, s0, s1); }
  // balkon iz nacrta: konzolna ploča na rubu dijela zgrade, na svakoj zadanoj razini, s ogradom na tri slobodne strane
  balconyAt(v, bk) {
    const M = this.M, e = edges(v)[bk.e]; if (!e) return;
    const [nx, nz] = outward(v, e), ang = -Math.atan2(e.dz, e.dx), P = (u, o) => [e.p[0] + e.dx * u + nx * o, e.p[1] + e.dz * u + nz * o];
    (bk.ys || []).forEach((y) => {
      const [cx, cz] = P(bk.u, bk.d / 2);
      const mk = (w, h, d, mat, yy, s0) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); g.position.set(cx, yy, cz); g.rotation.y = ang; this.add(g, 'balkon', s0, 9); };
      mk(bk.w, 0.2, bk.d, M.render, y - 0.1, 2); mk(bk.w + 0.02, 0.03, bk.d + 0.02, M.metal, y - 0.205, 4); mk(bk.w - 0.04, 0.04, bk.d - 0.04, M.paving, y + 0.02, 4);
      const c = [P(bk.u - bk.w / 2, 0.02), P(bk.u - bk.w / 2, bk.d - 0.03), P(bk.u + bk.w / 2, bk.d - 0.03), P(bk.u + bk.w / 2, 0.02)];
      for (let i = 0; i < 3; i++) {
        const [ax, az] = c[i], [bx, bz] = c[i + 1], L = Math.hypot(bx - ax, bz - az), ra = -Math.atan2(bz - az, bx - ax);
        if (bk.rail === 'zid') { const g = new THREE.Mesh(new THREE.BoxGeometry(L + 0.12, 1.05, 0.12), M.render); g.position.set((ax + bx) / 2, y + 0.52, (az + bz) / 2); g.rotation.y = ra; this.add(g, 'balkon', 4, 9); continue; }
        if (bk.rail === 'metal') { for (let k = 1; k * 0.12 < L; k++) this.box(0.015, 0.92, 0.015, M.steel, ax + (bx - ax) * k * 0.12 / L, y + 0.53, az + (bz - az) * k * 0.12 / L, 'balkon', 4, 9); }
        else { const gl = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 0.95, 0.014), M.railGlass); gl.position.set((ax + bx) / 2, y + 0.54, (az + bz) / 2); gl.rotation.y = ra; gl.userData.noShadow = true; this.add(gl, 'balkon', 4, 9); }
        this.beam(new THREE.Vector3(ax, y + 1.03, az), new THREE.Vector3(bx, y + 1.03, bz), 0.05, 0.04, M.steel, 'balkon', 4, 9);
        this.beam(new THREE.Vector3(ax, y + 0.06, az), new THREE.Vector3(bx, y + 0.06, bz), 0.04, 0.04, M.steel, 'balkon', 4, 9);
        this.box(0.04, 0.98, 0.04, M.steel, bx, y + 0.53, bz, 'balkon', 4, 9);
      }
    });
  }
  // greda između dviju točaka (letve, rubni crijep, ograde)
  beam(a, b, w, h, mat, part, s0, s1) { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, L), mat); g.position.copy(a).addScaledVector(d, 0.5); g.lookAt(b); return this.add(g, part, s0, s1); }

  // model + odabrana izvedba (temelji, konstrukcija, oblik krova, pokrov, fasada, stolarija)
  build(model, build) {
    this.model = model; this.B = normBuild(build); this.buildKey = BUILD_KEYS.map((k) => this.B[k]).join('|');
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    const shared = new Set(Object.values(this.tex).flatMap((p) => [p.map, p.nrm])); // osnovne teksture se dijele, ne brišu se
    (this.oldMats || []).forEach((mt) => { if (mt.map && !shared.has(mt.map)) mt.map.dispose(); if (mt.normalMap && !shared.has(mt.normalMap)) mt.normalMap.dispose(); mt.dispose(); });
    this.root.clear(); this.parts = [];
    const m = model, B = this.B, G = this.G = roofGeom(m), M = this.M = this.mats(m), E = edges(m), b = bbox(m), [cx, cz] = centroid(m);
    this.ops = openingsIn(m, G);
    // veći objekt (stambena zgrada): šire područje sjena, dalja kamera i sunce
    this.topH = topOf(m); this.cur = null;
    const big = Math.max(b.x1 - b.x0, b.z1 - b.z0, this.topH), R = Math.max(20, big * 1.25 + 6), sc = this.sunLight.shadow.camera;
    this.scaleK = Math.max(1, big / 10); this.sunD = Math.max(60, R * 2.4);
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.far = this.sunD * 2; sc.updateProjectionMatrix();
    this.controls.maxDistance = Math.max(90, big * 7);
    this.oldMats = Object.values(M).flat();
    seed = 99;
    // teren
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 128), M.grass); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.01, cz); ground.receiveShadow = true; this.root.add(ground);
    const flatPoly = (poly, y, t, mat, part, s0, s1) => { const g = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], -p[1]))), { depth: t, bevelEnabled: false }), mat); g.rotation.x = -Math.PI / 2; g.position.y = y - t; return this.add(g, part, s0, s1); };
    const inFp = offsetPoly(m, -0.02); // ploče su 2 cm uvučene, da im rub ne treperi u ravnini zida
    const slab = (y, t, mat, part, s0, s1) => flatPoly(inFp, y, t, mat, part, s0, s1);
    // traka uz zid (rov, trakasti temelj, vezna greda)
    const strip = (e, w, h, y, mat, part, s0, s1, inset) => { const [nx, nz] = outward(m, e); const g = this.box(e.L + w * 0.5, h, w, mat, (e.p[0] + e.q[0]) / 2 - nx * inset, y, (e.p[1] + e.q[1]) / 2 - nz * inset, part, s0, s1); g.rotation.y = -Math.atan2(e.dz, e.dx); return g; };
    // stupna mjesta: uglovi + razmak do 5 m (temelji samci, vertikalni serklaži, AB stupovi)
    const postsOf = (EE) => { const out = []; EE.forEach((e) => { const k = Math.max(0, Math.ceil(e.L / 5) - 1); for (let i = 0; i <= k; i++) out.push({ e, u: e.L * i / (k + 1) }); }); return out; };
    const posts = postsOf(E);
    const padAt = (p, w, h, y, mat, part, s0, s1) => { const [nx, nz] = outward(m, p.e); const g = this.box(w, h, w, mat, p.e.p[0] + p.e.dx * p.u - nx * 0.2, y, p.e.p[1] + p.e.dz * p.u - nz * 0.2, part, s0, s1); g.rotation.y = -Math.atan2(p.e.dz, p.e.dx); return g; };
    // faza 0: iskop (rovovi, jama za ploču ili jame za samce)
    this.box(b.x1 - b.x0 + 3, 0.02, b.z1 - b.z0 + 3, M.soil, cx, 0.0, cz, 'iskop', 0, 0);
    if (B.temelji === 'ploca') flatPoly(offsetPoly(m, 1.0), 0.07, 0.05, M.trench, 'iskop', 0, 0);
    else { E.forEach((e) => strip(e, B.temelji === 'samci' ? 0.5 : 0.8, 0.05, 0.02, M.trench, 'iskop', 0, 0, 0)); if (B.temelji === 'samci') posts.forEach((p) => padAt(p, 1.6, 0.06, 0.025, M.trench, 'iskop', 0, 0)); }
    [[b.x1 + 3.0, b.z0 - 1.8, 2.2], [b.x1 + 3.7, b.z0 + 1.0, 1.6]].forEach(([x, z, r]) => { const h = new THREE.Mesh(new THREE.SphereGeometry(r * (B.temelji === 'ploca' ? 1.25 : 1), 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.soil); h.scale.y = 0.45; h.position.set(x, 0, z); this.add(h, 'iskop', 0, 0); });
    // faza 1: temelji
    if (B.temelji === 'ploca') flatPoly(offsetPoly(m, 0.3), 0.149, 0.3, M.concrete, 'temelji', 1, 1);
    else if (B.temelji === 'samci') { posts.forEach((p) => padAt(p, 1.2, 0.4, 0.1, M.concrete, 'temelji', 1, 1)); E.forEach((e) => strip(e, 0.3, 0.3, 0.14, M.concrete, 'temelji', 1, 1, 0.2)); }
    else E.forEach((e) => strip(e, 0.6, 0.35, 0.12, M.concrete, 'temelji', 1, 1, 0.2));
    slab(0.15, 0.15, M.concrete, 'temelji', 1, 9);
    levelsOf(m).slice(1).forEach((y) => slab(y, 0.2, M.concrete, 'konstrukcija', 2, 3));
    if (G.kind === 'flat') slab(m.eave, 0.2, M.concrete, 'konstrukcija', 2, 9); else slab(m.eave - 0.02, 0.2, M.concrete, 'konstrukcija', 2, 2);
    // zidovi (sa serklažima ili stupovima), krov, dimnjaci
    this.struct = new THREE.Group();
    E.forEach((e) => this.wall(m, e, posts.filter((p) => p.e === e)));
    if (this.struct.children.length) this.add(mergeMeshes(this.struct), 'konstrukcija', 2, 3);
    const vols = m.vols || []; this.topVol = vols.length ? vols[vols.length - 1] : m;
    this.roof(m, flatPoly);
    // gornji dijelovi zgrade (uvučeni katovi): vlastiti obris, razine i krov, podignuti na svoju visinu
    vols.forEach((v) => {
      const grp = new THREE.Group(); grp.position.y = v.y0; this.root.add(grp); this.cur = grp;
      this.G = roofGeom(v); this.ops = openingsIn(v, this.G);
      const inV = offsetPoly(v, -0.02), EV = edges(v), pv = postsOf(EV);
      levelsOf(v).forEach((y, i) => flatPoly(inV, y + (i ? 0 : 0.02), 0.2, M.concrete, 'konstrukcija', 2, i ? 3 : 9));
      if (this.G.kind === 'flat') flatPoly(inV, v.eave, 0.2, M.concrete, 'konstrukcija', 2, 9); else flatPoly(inV, v.eave - 0.02, 0.2, M.concrete, 'konstrukcija', 2, 2);
      this.struct = new THREE.Group();
      EV.forEach((e) => this.wall(v, e, pv.filter((p) => p.e === e)));
      if (this.struct.children.length) this.add(mergeMeshes(this.struct), 'konstrukcija', 2, 3);
      this.roof(v, flatPoly);
      (v.balconies || []).forEach((bk) => this.balconyAt(v, bk));
    });
    this.cur = null; this.G = G; this.ops = openingsIn(m, G);
    (m.balconies || []).forEach((bk) => this.balconyAt(m, bk));
    (m.chimneys || []).forEach((c) => {
      const base = G.H(c.x, c.z) - 0.3, top = Math.max(c.top, base + 1.3);
      this.box(c.s, top - base, c.s, M.render, c.x, (top + base) / 2, c.z, 'krov', 3, 9);
      this.box(c.s + 0.04, 0.35, c.s + 0.04, M.cokl, c.x, top - 0.25, c.z, 'krov', 4, 9);
      this.box(c.s + 0.16, 0.06, c.s + 0.16, M.metal, c.x, top + 0.03, c.z, 'krov', 4, 9);
      this.box(0.16, 0.12, 0.16, M.metal, c.x, top + 0.12, c.z, 'krov', 4, 9);
    });
    // balkon: konzolna ploča, staklena ograda sa čeličnim rukohvatom
    if (m.balcony) {
      const B = m.balcony, w = B.x1 - B.x0, d = B.z1 - B.z0;
      this.box(w, 0.2, d, M.render, B.x0 + w / 2, B.y - 0.1, B.z0 + d / 2, 'balkon', 2, 9);
      this.box(w + 0.02, 0.03, d + 0.02, M.metal, B.x0 + w / 2, B.y - 0.205, B.z0 + d / 2, 'balkon', 4, 9);
      this.box(w - 0.04, 0.04, d - 0.04, M.paving, B.x0 + w / 2, B.y + 0.02, B.z0 + d / 2, 'balkon', 4, 9);
      const rail = [[B.x0, B.z0], [B.x1, B.z0], [B.x1, B.z1], [B.x0, B.z1]];
      for (let i = 0; i < 3; i++) {
        const [ax, az] = rail[i], [bx, bz] = rail[i + 1], L = Math.hypot(bx - ax, bz - az);
        const gl = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 0.95, 0.012), M.railGlass); gl.position.set((ax + bx) / 2, B.y + 0.54, (az + bz) / 2); gl.rotation.y = -Math.atan2(bz - az, bx - ax); gl.castShadow = false; this.root.add(gl); gl.userData = { part: 'balkon', minStage: 4, maxStage: 9 }; this.parts.push(gl);
        this.beam(new THREE.Vector3(ax, B.y + 1.03, az), new THREE.Vector3(bx, B.y + 1.03, bz), 0.05, 0.04, M.steel, 'balkon', 4, 9);
        this.beam(new THREE.Vector3(ax, B.y + 0.06, az), new THREE.Vector3(bx, B.y + 0.06, bz), 0.04, 0.04, M.steel, 'balkon', 4, 9);
        this.box(0.04, 0.98, 0.04, M.steel, bx, B.y + 0.53, bz, 'balkon', 4, 9);
      }
    }
    if (m.canopy) { const K = m.canopy, w = K.x1 - K.x0, d = K.z1 - K.z0; this.box(w, 0.16, d, M.render, K.x0 + w / 2, K.y, K.z0 + d / 2, 'fasada', 2, 9); this.box(w + 0.04, 0.05, d + 0.04, M.metal, K.x0 + w / 2, K.y + 0.1, K.z0 + d / 2, 'limarija', 4, 9); }
    this.landscape(m, b, E, cx, cz);
    this.setStage(this.stage);
    if (!this.viewed) { this.view('persp', true); this.viewed = true; } else this.placeSun(this.camera.position, this.controls.target);
    this.invalidateShadows();
  }

  landscape(m, b, E, cx, cz) {
    const M = this.M;
    // opločenje oko kuće (1,0 m) i šljunčani rub
    const ring = (pad, h, mat, s0, y = 0) => { const sh = new THREE.Shape([[b.x0 - pad, b.z0 - pad], [b.x1 + pad, b.z0 - pad], [b.x1 + pad, b.z1 + pad], [b.x0 - pad, b.z1 + pad]].map((p) => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }), mat); g.rotation.x = -Math.PI / 2; g.position.y = y; return this.add(g, 'okolis', s0, 9); };
    ring(1.35, 0.025, M.gravel, 5); ring(1.0, 0.04, M.paving, 5);
    // staza do ulaza + stepenica
    const door = m.openings.find((o) => o.t === 'door');
    if (door) {
      const e = E[door.e], [nx, nz] = outward(m, e), px = e.p[0] + e.dx * door.u, pz = e.p[1] + e.dz * door.u;
      const g = this.box(1.3, 0.04, 10, M.paving, px + nx * 6, 0.025, pz + nz * 6, 'okolis', 5, 9); g.rotation.y = Math.atan2(nx, nz);
      const st = this.box(door.w + 0.6, 0.16, 0.45, M.concrete, px + nx * 0.23, 0.08, pz + nz * 0.23, 'okolis', 4, 9); st.rotation.y = -Math.atan2(e.dz, e.dx);
      // zidna svjetiljka i kućni broj uz vrata
      const lx = px + e.dx * (door.w / 2 + 0.35) + nx * 0.06, lz = pz + e.dz * (door.w / 2 + 0.35) + nz * 0.06;
      const lamp = this.box(0.12, 0.22, 0.1, M.metal, lx, 2.2, lz, 'stolarija', 4, 9); lamp.rotation.y = -Math.atan2(e.dz, e.dx);
      const gl = this.box(0.08, 0.14, 0.11, M.lamp, lx, 2.2, lz, 'stolarija', 4, 9); gl.rotation.y = lamp.rotation.y; gl.castShadow = false;
    }
    // grmlje uz kuću i živica
    const green = new THREE.Group();
    const bush = (x, z, r, k) => { const mesh = new THREE.Mesh(this.blob(r, 3, 0.28), M.leaf[k % 3]); mesh.position.set(x, r * 0.55, z); mesh.scale.y = 0.75; green.add(mesh); };
    const corners = m.fp; corners.forEach((v, i) => { const [nx, nz] = outward(m, E[i]), [px, pz] = outward(m, E[(i - 1 + E.length) % E.length]); bush(v[0] + (nx + px) * 1.9, v[1] + (nz + pz) * 1.9, 0.55 + rand() * 0.25, i); });
    // živica uz rub parcele (iza kuće)
    const hedge = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.9); for (let i = 0; i <= n; i++) { const t = i / n; const mm = new THREE.Mesh(this.blob(0.62, 2, 0.22), M.leaf[i % 3]); mm.position.set(x0 + (x1 - x0) * t, 0.75, z0 + (z1 - z0) * t); mm.scale.set(1, 1.3, 1); green.add(mm); } };
    hedge(b.x0 - 10, b.z0 - 15 * this.scaleK, b.x1 + 10, b.z0 - 15 * this.scaleK);
    this.add(mergeMeshes(green), 'okolis', 5, 9);
    // stabla izvan osi pogleda na pročelja i perspektive
    [[-40, 15, 1.25, 0], [40, 16, 1.4, 1], [-140, 16, 1.15, 0], [158, 18, 1.2, 1], [-65, 30, 1.6, 2], [18, 33, 1.7, 0], [106, 32, 1.45, 2], [-112, 29, 1.5, 1], [-160, 34, 1.6, 2], [70, 42, 1.8, 0], [-25, 45, 1.6, 1]]
      .forEach(([a, R, s, k]) => (k === 2 ? this.conifer : this.tree).call(this, cx + R * this.scaleK * Math.cos(a * Math.PI / 180), cz + R * this.scaleK * Math.sin(a * Math.PI / 180), s));
  }
  // nepravilna kugla krošnje (šum na verteksima), s glatkim normalama
  blob(r, detail = 3, amp = 0.25) {
    const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3(), o = rand() * 100, keys = new Array(p.count);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); keys[i] = Math.round(v.x / r * 2000) + '_' + Math.round(v.y / r * 2000) + '_' + Math.round(v.z / r * 2000);
      const n = SN.noise3d(v.x * 1.1 + o, v.y * 1.1, v.z * 1.1) * amp + SN.noise3d(v.x * 3 + o, v.y * 3, v.z * 3) * amp * 0.15; v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const nr = g.attributes.normal, acc = new Map();
    for (let i = 0; i < p.count; i++) { const a = acc.get(keys[i]) || [0, 0, 0]; a[0] += nr.getX(i); a[1] += nr.getY(i); a[2] += nr.getZ(i); acc.set(keys[i], a); }
    for (let i = 0; i < p.count; i++) { const a = acc.get(keys[i]), l = Math.hypot(a[0], a[1], a[2]) || 1; nr.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    return g;
  }
  tree(x, z, s) {
    const M = this.M, g = new THREE.Group(), h = 2.6 * s;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.2 * s, h, 10), M.bark); t.position.y = h / 2; g.add(t);
    [[0.5, 0.9, 0.2, -0.6], [-0.4, 0.8, -0.3, 0.7], [0.1, 0.95, 0.5, 0.3]].forEach(([dx, y, dz, rz]) => { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.07 * s, 1.1 * s, 6), M.bark); br.position.set(dx * s * 0.5, h * y, dz * s * 0.5); br.rotation.set(dz, 0, rz); g.add(br); });
    const cl = [[0, 3.3, 0, 1.45], [0.85, 2.85, 0.3, 1.05], [-0.75, 2.95, -0.35, 1.1], [0.2, 4.1, -0.2, 1.0], [-0.3, 3.6, 0.7, 0.95], [0.5, 3.7, -0.7, 0.9]];
    cl.forEach(([a, b2, c, r], i) => { const l = new THREE.Mesh(this.blob(r * s, 3, 0.2), M.leaf[(i + Math.floor(rand() * 3)) % 3]); l.position.set(a * s, b2 * s, c * s); g.add(l); });
    const mg = mergeMeshes(g); mg.position.set(x, 0, z); mg.rotation.y = rand() * 6.28; this.add(mg, 'okolis', 5, 9);
  }
  conifer(x, z, s) {
    const M = this.M, g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.4 * s, 8), M.bark); t.position.y = 0.7 * s; g.add(t);
    for (let i = 0; i < 4; i++) { const r = (1.5 - i * 0.32) * s, hh = (1.9 - i * 0.25) * s; const geo = new THREE.ConeGeometry(r, hh, 20, 4); const p = geo.attributes.position, v = new THREE.Vector3(); for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const n = 1 + SN.noise3d(v.x * 2, v.y * 2, v.z * 2) * 0.12; p.setXYZ(k, v.x * n, v.y, v.z * n); } geo.computeVertexNormals(); const c = new THREE.Mesh(geo, M.leaf[1]); c.position.y = 1.4 * s + i * 0.95 * s + hh / 2 - 0.3 * s; g.add(c); }
    const mg = mergeMeshes(g); mg.position.set(x, 0, z); this.add(mg, 'okolis', 5, 9);
  }

  wall(m, e, posts) {
    const M = this.M, T = m.wallT, G = this.G, B = this.B;
    const us = wallBreaks(m, e, G), top = (u) => G.wallTop(e.p[0] + e.dx * u, e.p[1] + e.dz * u);
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(e.L, 0)]; for (let k = us.length - 1; k >= 0; k--) pts.push(new THREE.Vector2(us[k], top(us[k])));
    const shape = new THREE.Shape(pts);
    const ops = this.ops.filter((o) => o.e === e.i);
    ops.forEach((o) => { const h = new THREE.Path(); const x0 = o.u - o.w / 2, y0 = Math.max(o.s, 0.001); h.moveTo(x0, y0); h.lineTo(x0, y0 + o.h); h.lineTo(x0 + o.w, y0 + o.h); h.lineTo(x0 + o.w, y0); h.lineTo(x0, y0); shape.holes.push(h); });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
    const [nx, nz] = outward(m, e);
    const place = (obj) => { const mtx = new THREE.Matrix4().makeBasis(new THREE.Vector3(e.dx, 0, e.dz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-nx, 0, -nz)); obj.applyMatrix4(mtx); obj.position.add(new THREE.Vector3(e.p[0], 0, e.p[1])); return obj; };
    this.add(place(new THREE.Mesh(geo, M.block)), 'zidovi', 2, 3);
    this.add(place(new THREE.Mesh(geo, M.fasada)), 'fasada', 4, 9);
    // dijelovi zida koji nisu prekinuti otvorima na zadanoj visini
    const freeSegs = (y0, y1) => { const cuts = ops.filter((o) => o.s < y1 && o.s + o.h > y0).map((o) => [o.u - o.w / 2, o.u + o.w / 2]).sort((a, c) => a[0] - c[0]); let a = 0; const segs = []; cuts.forEach(([c0, c1]) => { if (c0 > a) segs.push([a, c0]); a = Math.max(a, c1); }); if (a < e.L) segs.push([a, e.L]); return segs; };
    // AB serklaži (omeđeno ziđe) ili AB skelet: vidljivi u fazi konstrukcije, malo istaknuti iz zida
    if (B.konstrukcija !== 'ab') {
      const sk = B.konstrukcija === 'skelet', cw = sk ? 0.32 : optOf('konstrukcija', B.konstrukcija).t + 0.02, pr = sk ? 0.03 : 0.012, bh = sk ? 0.4 : 0.25, sg = new THREE.Group();
      posts.forEach((p) => {
        let u = p.u;
        if (u > 0) { const hit = ops.find((o) => Math.abs(u - o.u) < o.w / 2 + cw / 2 + 0.05); if (hit) u = hit.u - hit.w / 2 - cw / 2 - 0.08; if (u < cw * 1.5 || ops.some((o) => Math.abs(u - o.u) < o.w / 2 + cw / 2)) return; }
        const hgt = top(u) - 0.02, g = new THREE.Mesh(new THREE.BoxGeometry(cw, hgt, cw), M.concrete); g.position.set(p.u === 0 ? cw / 2 - pr : u, hgt / 2, cw / 2 - pr); sg.add(g);
      });
      const levels = levelsOf(m).slice(1); levels.push(m.eave - 0.03);
      levels.forEach((y) => freeSegs(y - bh, y).forEach(([s0, s1]) => { if (s1 - s0 < 0.1) return; const g = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, bh, 0.05), M.concrete); g.position.set((s0 + s1) / 2, y - bh / 2, 0.025 - pr); sg.add(g); }));
      this.struct.add(place(sg));
    }
    // podnožje (cokl) izvan zida, prekinuto kod vrata
    if (m.base > 0) freeSegs(0, m.base).forEach(([s0, s1]) => { const g = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0 + 0.06, m.base, 0.05), M.cokl); g.position.set((s0 + s1) / 2, m.base / 2, -0.025); this.add(place(g), 'fasada', 4, 9); });
    // ravni krov: limena poklopnica atike
    if (G.kind === 'flat') { const g = new THREE.Mesh(new THREE.BoxGeometry(e.L + 0.12, 0.05, T + 0.1), M.metal); g.position.set(e.L / 2, top(0) + 0.025, T / 2); this.add(place(g), 'limarija', 4, 9); }
    // stolarija s krilima, staklom, unutrašnjošću prostorije i zavjesama
    const grp = new THREE.Group(), fw = { pvc: 0.075, alu: 0.055, drvo: 0.088, drvoalu: 0.07 }[B.stolarija] || 0.075;
    ops.forEach((o) => {
      const x0 = o.u - o.w / 2, y0 = Math.max(o.s, 0), dep = 0.1, inset = 0.13, xm = x0 + o.w / 2;
      const bx = (w, h, d, mat, x, y, z) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); g.position.set(x, y, z); grp.add(g); return g; };
      const fr = (w, h, x, y, z = inset + dep / 2, d = dep) => bx(w, h, d, M.frame, x, y, z);
      // vanjski okvir
      fr(o.w, fw, xm, y0 + o.h - fw / 2); fr(o.w, fw, xm, y0 + fw / 2); fr(fw, o.h, x0 + fw / 2, y0 + o.h / 2); fr(fw, o.h, x0 + o.w - fw / 2, y0 + o.h / 2);
      // unutrašnjost prostorije iza stakla (daje dubinu)
      const room = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.6, Math.min(o.h + 0.6, 2.7), 1.6), M.room); room.position.set(xm, y0 + o.h / 2, T + 0.8); room.castShadow = false; grp.add(room);
      if (o.t === 'door') {
        const dw = o.w - 2 * fw, dh = o.h - fw;
        bx(dw, dh, 0.06, M.door, xm, y0 + dh / 2, inset + 0.05);
        [0.25, 0.5, 0.75].forEach((k) => bx(dw * 0.7, 0.012, 0.012, M.metal, xm, y0 + dh * k, inset + 0.015));
        bx(0.16, dh * 0.72, 0.065, M.glass, x0 + fw + 0.2, y0 + dh * 0.52, inset + 0.05);
        bx(0.03, 1.1, 0.04, M.steel, x0 + o.w - fw - 0.16, y0 + 1.05, inset - 0.02);
      } else {
        const nDiv = o.t === 'slide' ? (o.w > 3 ? 3 : 2) : (o.w > 2.4 ? 2 : o.w > 1.4 ? 1 : 0), cw = (o.w - 2 * fw) / (nDiv + 1);
        for (let k = 0; k <= nDiv; k++) {
          const cx0 = x0 + fw + k * cw, sw = fw * 0.66, zz = inset + dep * (o.t === 'slide' && k % 2 ? 0.25 : 0.6);
          // krilo
          fr(cw, sw, cx0 + cw / 2, y0 + o.h - fw - sw / 2, zz, 0.06); fr(cw, sw, cx0 + cw / 2, y0 + fw + sw / 2, zz, 0.06); fr(sw, o.h - 2 * fw, cx0 + sw / 2, y0 + o.h / 2, zz, 0.06); fr(sw, o.h - 2 * fw, cx0 + cw - sw / 2, y0 + o.h / 2, zz, 0.06);
          const gl = bx(cw - 2 * sw, o.h - 2 * fw - 2 * sw, 0.012, M.glass, cx0 + cw / 2, y0 + o.h / 2, zz); gl.castShadow = false;
          bx(0.02, 0.14, 0.03, M.steel, cx0 + (k % 2 ? sw + 0.04 : cw - sw - 0.04), y0 + Math.min(o.h / 2, 1.05), zz - 0.04);
        }
        if (rand() > 0.45) { const cu = new THREE.Mesh(new THREE.PlaneGeometry(o.w * (0.25 + rand() * 0.2), o.h * 0.92), M.curtain); cu.position.set(x0 + o.w * (rand() > 0.5 ? 0.2 : 0.8), y0 + o.h / 2, T + 0.12); cu.castShadow = false; grp.add(cu); }
        if (o.s > 0.2) { bx(o.w + 0.08, 0.025, inset + 0.07, M.metal, xm, y0 - 0.012, (inset - 0.07) / 2); bx(o.w + 0.08, 0.06, 0.012, M.metal, xm, y0 - 0.04, -0.064); }
        else bx(o.w, 0.03, 0.3, M.metal, xm, 0.015, 0.05);
      }
    });
    if (ops.length) this.add(place(mergeMeshes(grp, new Set([M.glass, M.room, M.curtain]))), 'stolarija', 4, 9);
  }

  // krov iz ploha: dvostrešni, jednostrešni, četverostrešni (viševodni) ili ravni s atikom
  roof(m, flatPoly) {
    const M = this.M, G = this.G, B = this.B, t = 0.26, H = G.H, lim = B.pokrov === 'lim';
    if (G.kind === 'flat') {
      const inner = offsetPoly(m, -m.wallT);
      flatPoly(inner, m.eave + 0.1, 0.1, M.xps, 'krov', 3, 3);
      flatPoly(inner, m.eave + 0.16, 0.16, m === this.topVol ? M.cover : M.gravel, 'krov', 4, 9);
      return;
    }
    const V3 = (p, dy = 0) => new THREE.Vector3(p[0], H(p[0], p[1]) + dy, p[1]);
    const plate = (f, mat, dy, part, s0, s1) => {
      const cosT = 1 / Math.sqrt(1 + f.tan * f.tan), [ux, uz] = f.up, poly = f.poly;
      const sg = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1]))));
      const tp = sg.attributes.position, idx = sg.index.array, nv = tp.count, pos = [], uv = [], ind = [];
      const top = (x, z, k) => [x, H(x, z) + dy - k * t, z];
      for (let i = 0; i < nv; i++) { const x = tp.getX(i), z = tp.getY(i); pos.push(...top(x, z, 0)); uv.push((z * ux - x * uz) / 2.4, -(x * ux + z * uz) / cosT / 3.0); }
      for (let i = 0; i < nv; i++) { pos.push(...top(tp.getX(i), tp.getY(i), 1)); uv.push(tp.getY(i), tp.getX(i)); }
      for (let i = 0; i < idx.length; i += 3) ind.push(idx[i], idx[i + 2], idx[i + 1]);
      for (let i = 0; i < idx.length; i += 3) ind.push(nv + idx[i], nv + idx[i + 1], nv + idx[i + 2]);
      poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], o = pos.length / 3; [top(p[0], p[1], 0), top(q[0], q[1], 0), top(q[0], q[1], 1), top(p[0], p[1], 1)].forEach((v) => { pos.push(...v); uv.push(0, 0); }); ind.push(o, o + 2, o + 1, o, o + 3, o + 2); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
      const nTop = idx.length; g.addGroup(0, nTop, 0); g.addGroup(nTop, nTop, 1); g.addGroup(nTop * 2, ind.length - nTop * 2, 2);
      sg.dispose();
      return this.add(new THREE.Mesh(g, [mat, M.soffit, M.fascia]), part, s0, s1);
    };
    const rod = (a, c, r0, r1, mat, part, s0, s1) => { const d = new THREE.Vector3().subVectors(c, a), L = d.length(); const g = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, L, 16), mat); g.position.copy(a).addScaledVector(d, 0.5); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return this.add(g, part, s0, s1); };
    const many = G.faces.length > 2, seen = new Set(), ridge = new THREE.Group();
    G.faces.forEach((f) => {
      plate(f, M.osb, 0, 'krov', 3, 3);
      plate(f, M.cover, 0.05, 'krov', 4, 9);
      // rubni (zabatni) crijep ili limeni opšav duž kosih rubova
      f.verges.forEach(([p, q]) => this.beam(V3(p, 0.1), V3(q, 0.1), lim ? 0.16 : 0.22, lim ? 0.05 : 0.09, lim ? M.ridge : M.cover, 'krov', 4, 9));
      // oluk i odvodne cijevi uz strehu
      const [ux, uz] = f.up;
      f.eaves.forEach(([p, q]) => {
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]), dx = (q[0] - p[0]) / L, dz = (q[1] - p[1]) / L, he = H(p[0], p[1]) - t, gx = -ux * 0.07, gz = -uz * 0.07;
        rod(new THREE.Vector3(p[0] + gx, he - 0.02, p[1] + gz), new THREE.Vector3(q[0] + gx, he - 0.02, q[1] + gz), 0.068, 0.068, M.metal, 'limarija', 4, 9);
        (many ? [0] : [0, 1]).forEach((end) => {
          const a = end ? q : p, sgn = end ? -1 : 1, k = G.ov + 0.15, wx = a[0] + dx * k * sgn + ux * (G.ov - 0.1), wz = a[1] + dz * k * sgn + uz * (G.ov - 0.1);
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, he - 0.25, 14), M.metal); pipe.position.set(wx, (he - 0.25) / 2, wz); this.add(pipe, 'limarija', 5, 9);
          this.beam(new THREE.Vector3(wx, he - 0.25, wz), new THREE.Vector3(a[0] + dx * k * sgn + gx, he - 0.05, a[1] + dz * k * sgn + gz), 0.07, 0.07, M.metal, 'limarija', 5, 9);
          [1, 3].forEach((y) => this.box(0.06, 0.03, 0.06, M.metal, wx + ux * 0.06, y, wz + uz * 0.06, 'limarija', 5, 9));
        });
      });
      // sljeme i grebeni (unutarnji rubovi ploha), svaki samo jednom
      f.inner.forEach(([p, q]) => {
        const key = [p, q].map((v) => v.map((n) => n.toFixed(1)).join(',')).sort().join('|'); if (seen.has(key)) return; seen.add(key);
        const a = V3(p, 0.06), c = V3(q, 0.06), d = new THREE.Vector3().subVectors(c, a), L = d.length(); if (L < 0.2) return;
        if (lim) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, L), M.ridge); g.position.copy(a).addScaledVector(d, 0.5); g.lookAt(c); ridge.add(g); return; }
        const k = Math.ceil(L / 0.42), dir = d.clone().normalize(), qt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        for (let i = 0; i < k; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, L / k - 0.012, 18), M.ridge); seg.quaternion.copy(qt); seg.position.copy(a).addScaledVector(dir, (i + 0.5) * L / k); ridge.add(seg); }
      });
    });
    if (ridge.children.length) this.add(mergeMeshes(ridge), 'krov', 4, 9);
  }

  setStage(s) { this.stage = s; this.parts.forEach((p) => { const u = p.userData; p.visible = s >= u.minStage && s <= u.maxStage; }); this.invalidateShadows(); }
  // promjena boje mijenja samo materijale (bez ponovne izgradnje modela)
  setColors(c) { Object.assign(this.model.colors, c); Object.entries(this.byColor).forEach(([k, mats]) => { const v = this.model.colors[k] || DEFAULT_COLORS[k]; mats.forEach((mt) => mt.color.set(v)); }); this.needFull = true; }
  frameBox() { const b = bbox(this.model); return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, r: Math.max(b.x1 - b.x0, b.z1 - b.z0), h: Math.max(...(this.model.chimneys || []).map((c) => c.top), this.topH) }; }
  // arhitektonska perspektiva: kamera gleda vodoravno (vertikale ostaju ravne)
  view(kind, instant) {
    const f = this.frameBox(), eye = f.h * 0.5, tgt = new THREE.Vector3(f.cx, eye, f.cz);
    const fit = (w, h) => { const vf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), hf = vf * Math.max(this.camera.aspect, 1.2); return Math.max((h * 0.5 + 0.9) / vf, (w * 0.5 + 1.5) / hf); };
    let pos;
    if (typeof kind === 'number') {
      const e = edges(this.model)[kind], [nx, nz] = outward(this.model, e), mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[1] + e.q[1]) / 2;
      const d = fit(Math.max(e.L, f.r) + 2 * this.G.ov, f.h) + 1; tgt.set(mx - nx * 2, eye, mz - nz * 2); pos = new THREE.Vector3(mx + nx * d, eye, mz + nz * d);
    } else if (kind === 'top') { tgt.y = 2; pos = new THREE.Vector3(f.cx - f.r * 1.5, f.r * 3.0, f.cz + f.r * 1.7); }
    else { const d = fit(f.r * 1.45, f.h) + 2; const dir = new THREE.Vector3(-0.64, 0, 0.77).normalize(); pos = tgt.clone().addScaledVector(dir, d); pos.y = eye; }
    this.placeSun(pos, tgt);
    this.anim(pos, tgt, instant);
  }
  anim(pos, tgt, instant) {
    const cam = this.camera, ctl = this.controls, p0 = cam.position.clone(), t0 = ctl.target.clone(), t1 = performance.now();
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { cam.position.copy(pos); ctl.target.copy(tgt); ctl.update(); this.needFull = true; return; }
    const step = () => { const k = Math.min(1, (performance.now() - t1) / 750), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; cam.position.lerpVectors(p0, pos, e); ctl.target.lerpVectors(t0, tgt, e); this.needFast = true; if (k < 1) requestAnimationFrame(step); };
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
  // slika visoke rezolucije: višestruko uzorkovanje (SSAA 8×) + ambijentalna okluzija, s natpisom
  async snapshot(w = 2560, h = 1440, caption = '') {
    const r = this.renderer, cam = this.camera, oldAspect = cam.aspect;
    cam.aspect = w / h; cam.updateProjectionMatrix();
    r.setPixelRatio(1); r.setSize(w, h, false);
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    const c2 = new EffectComposer(r, rt); c2.setPixelRatio(1); c2.setSize(w, h);
    const ss = new SSAARenderPass(this.scene, cam); ss.sampleLevel = 3; ss.unbiased = true; c2.addPass(ss);
    const ao = new GTAOPass(this.scene, cam, w, h); ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 24, distanceFallOff: 1.0 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 16 }); ao.blendIntensity = 0.9; c2.addPass(ao);
    c2.addPass(new OutputPass());
    c2.render();
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(r.domElement, 0, 0, w, h);
    c2.dispose?.(); rt.dispose(); ao.dispose?.(); ss.dispose?.();
    cam.aspect = oldAspect; cam.updateProjectionMatrix(); r.setPixelRatio(this.pr); this.forceResize = true; this.resize();
    if (caption) {
      const lines = caption.split('\n'), fs = Math.round(h / 44), pad = Math.round(h / 38), lh = fs * 1.4;
      g.font = `600 ${fs}px "IBM Plex Sans", Arial`; const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2;
      g.fillStyle = 'rgba(16,22,30,.58)'; g.beginPath(); g.roundRect(pad, h - pad - lh * lines.length - pad * 0.8, bw, lh * lines.length + pad * 0.8, fs * 0.45); g.fill();
      g.fillStyle = '#fff'; lines.forEach((l, i) => { g.font = `${i ? 400 : 600} ${i ? Math.round(fs * 0.82) : fs}px "IBM Plex Sans", Arial`; g.fillText(l, pad * 2, h - pad - lh * (lines.length - i - 1) - pad * 0.75); });
    }
    this.dirty = true;
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  }
}
