// Građevinski program – prototip v0.4
// Nacrt (PDF + mjerenje) → stavke (AI prijedlog / ručno / izmjereno / potvrđeno) → troškovnik → ugovor, uz AI asistenta.
import * as pdfjsLib from './lib/pdf.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.js', import.meta.url).href;

const DEMO_PDF_URL = '/_blob/bae2a8cc1f83b4982451d63eb012771a';
const PDV = 0.25;

/* ---------- šifrarnici ---------- */
const PHASES = [
  { id: 'pripremni', n: 'Pripremni radovi' },
  { id: 'iskop', n: 'Iskop i zemljani radovi' },
  { id: 'temelji', n: 'Temelji' },
  { id: 'konstrukcija', n: 'Konstrukcija' },
  { id: 'krov', n: 'Krovište' },
  { id: 'instalacije', n: 'Instalacije' },
  { id: 'fasada', n: 'Fasada' },
  { id: 'zavrsni', n: 'Završni radovi' },
];
const GROUPS = [
  { id: 'g01', n: 'Pripremni radovi', ph: 'pripremni' },
  { id: 'g02', n: 'Zemljani radovi', ph: 'iskop' },
  { id: 'g03', n: 'Betonski i armiranobetonski radovi', ph: 'konstrukcija' },
  { id: 'g04', n: 'Zidarski radovi', ph: 'konstrukcija' },
  { id: 'g05', n: 'Izolaterski radovi', ph: 'zavrsni' },
  { id: 'g06', n: 'Tesarski radovi', ph: 'krov' },
  { id: 'g07', n: 'Krovopokrivački radovi', ph: 'krov' },
  { id: 'g08', n: 'Limarski radovi', ph: 'krov' },
  { id: 'g09', n: 'Fasaderski radovi', ph: 'fasada' },
  { id: 'g10', n: 'Stolarski i bravarski radovi', ph: 'zavrsni' },
  { id: 'g11', n: 'Podopolagački i keramičarski radovi', ph: 'zavrsni' },
  { id: 'g12', n: 'Soboslikarski i ličilački radovi', ph: 'zavrsni' },
  { id: 'g13', n: 'Instalacije', ph: 'instalacije' },
  { id: 'g14', n: 'Ostali radovi', ph: 'zavrsni' },
];
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'];
const UNITS = ['m', 'm²', 'm³', 'kom', 'kg', 't', 'kompl', 'paušal', 'h'];
const STATUS = {
  ai: { n: 'AI prijedlog', c: 'ai' },
  ok: { n: 'Potvrđeno', c: 'ok' },
  rucno: { n: 'Ručno', c: 'rucno' },
  mjereno: { n: 'Izmjereno', c: 'mjereno' },
};
const CATALOG = {
  g01: [['Uređenje gradilišta: ograda, gradilišna ploča, priključci vode i struje, sanitarni čvor', 'paušal'], ['Iskolčenje građevine od ovlaštenog geodeta', 'paušal']],
  g02: [['Strojni iskop humusa d=30 cm s odlaganjem na gradilištu', 'm²'], ['Strojni iskop zemlje III. kategorije za temelje', 'm³'], ['Nasip i nabijanje šljunka ispod podne ploče', 'm³'], ['Odvoz viška materijala na deponiju', 'm³']],
  g03: [['Betoniranje trakastih temelja betonom C25/30', 'm³'], ['Betoniranje AB podne ploče betonom C25/30', 'm³'], ['Betoniranje AB stropne ploče betonom C25/30', 'm³'], ['Betoniranje AB serklaža i nadvoja', 'm³'], ['Armatura B500B, dobava, savijanje i postava', 'kg']],
  g04: [['Zidanje vanjskih zidova opekarskim blokom d=25 cm', 'm²'], ['Zidanje pregradnih zidova blok opekom d=10–15 cm', 'm²'], ['Unutarnja vapneno-cementna žbuka zidova', 'm²'], ['Unutarnja žbuka stropova', 'm²']],
  g05: [['Hidroizolacija podne ploče bitumenskom trakom s uloškom', 'm²'], ['Toplinska izolacija poda XPS', 'm²'], ['Toplinska izolacija EPS ispod estriha', 'm²'], ['Toplinska izolacija stropa tavana kamenom vunom', 'm²']],
  g06: [['Izrada drvene krovne konstrukcije (rogovi, podrožnice)', 'm²'], ['Postava OSB ploča na rogove', 'm²']],
  g07: [['Pokrivanje krova glinenim utorenim crijepom s letvama, kontraletvama i kišnom branom', 'm²']],
  g08: [['Horizontalni oluk od pocinčanog lima', 'm'], ['Vertikalna odvodna cijev', 'm'], ['Opšav dimnjaka i prodora', 'kom']],
  g09: [['Kontaktna fasada (ETICS) EPS d=15 cm sa silikatnom žbukom', 'm²'], ['Obrada špaleta otvora', 'm']],
  g10: [['PVC prozor s trostrukim staklom, dobava i ugradnja', 'kom'], ['Unutarnja vrata s dovratnikom', 'kom'], ['Ulazna vrata', 'kom'], ['Ograda balkona', 'm']],
  g11: [['Cementni estrih d=6 cm', 'm²'], ['Keramičke pločice na pod', 'm²'], ['Keramičke pločice na zid (kupaonica)', 'm²'], ['Parket hrast, lijepljeni', 'm²']],
  g12: [['Gletanje i bojanje zidova i stropova disperzivnom bojom', 'm²']],
  g13: [['Vodovod i odvodnja prema projektu instalacija', 'kompl'], ['Elektroinstalacije prema projektu', 'kompl'], ['Podno grijanje s razdjelnicima', 'm²'], ['Dizalica topline zrak–voda', 'kom']],
  g14: [['Završno čišćenje građevine', 'paušal']],
};

/* ---------- pomoćne ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf2 = new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfq = new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 2 });
const eur = (n) => nf2.format(n || 0) + ' €';
const fq = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : nfq.format(n);
const fp = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : nf2.format(n);
function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return isNaN(n) ? null : n;
}
const r2 = (n) => Math.round(n * 100) / 100;
const groupOf = (id) => GROUPS.find((g) => g.id === id) || GROUPS[GROUPS.length - 1];
const phaseName = (id) => (P.phases.find((p) => p.id === id) || {}).n || id;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }

/* ---------- primjer projekta (iz priloženih nacrta) ---------- */
function demoItems() {
  const A = (group, desc, unit, qty, basis, phase) => ({ id: uid(), group, desc, unit, qty, price: null, priceSrc: null, phase: phase || groupOf(group).ph, status: 'ai', qtyMode: 'manual', basis });
  return [
    A('g01', 'Uređenje gradilišta: ograda, gradilišna ploča, priključci vode i struje, sanitarni čvor', 'paušal', 1, 'Standardna stavka za svako gradilište.'),
    A('g01', 'Iskolčenje građevine od ovlaštenog geodeta', 'paušal', 1, 'Obvezno prije početka radova.'),
    A('g02', 'Strojni iskop humusa d=30 cm s odlaganjem na gradilištu', 'm²', 96.75, 'Tlocrt 8,75 × 7,00 m (str. 1) + 1 m radnog prostora sa svake strane: 10,75 × 9,00 m = 96,75 m².', 'iskop'),
    A('g02', 'Strojni iskop zemlje III. kategorije za trakaste temelje', 'm³', 21.33, 'Opseg 2 × (8,75 + 7,00) = 31,5 m + unutarnji temelj ≈ 8 m = 39,5 m; širina 0,60 m × dubina 0,90 m (presjek, min −0,90).', 'iskop'),
    A('g02', 'Nasip i nabijanje šljunka ispod podne ploče d=20 cm', 'm³', 11.55, 'Sloj P1 (str. 6): nabijeni šljunak 20 cm × GBP prizemlja 57,74 m².', 'temelji'),
    A('g02', 'Odvoz viška materijala na deponiju', 'm³', 25.6, 'Iskop temelja 21,33 m³ × 1,2 (rastresitost).', 'iskop'),
    A('g03', 'Betoniranje trakastih temelja betonom C25/30', 'm³', 7.9, 'Duljina temelja 39,5 m × 0,50 × 0,40 m (procjena iz presjeka; provjeriti s konstrukcijom).', 'temelji'),
    A('g03', 'Betoniranje AB podne ploče d=15 cm betonom C25/30', 'm³', 8.66, 'Sloj P1: AB ploča 15 cm × 57,74 m².', 'temelji'),
    A('g03', 'Betoniranje AB stropne ploče nad prizemljem d=18 cm', 'm³', 10.39, 'Sloj MK: AB ploča 18 cm × 57,74 m².'),
    A('g03', 'Betoniranje AB stropne ploče nad katom d=20 cm', 'm³', 11.55, 'Sloj M1: AB ploča 20 cm × 57,74 m².'),
    A('g03', 'Betoniranje AB serklaža i nadvoja 25/25 cm', 'm³', 3.94, 'Opseg 31,5 m × 2 etaže × 0,25 × 0,25 m.'),
    A('g03', 'Armatura B500B, dobava, savijanje i postava', 'kg', 4244, 'Približno 100 kg/m³ × 42,44 m³ betona (procjena dok nema statičkog proračuna).'),
    A('g04', 'Zidanje vanjskih zidova opekarskim blokom d=25 cm', 'm²', 159.0, 'Opseg 31,5 m × visina 2 × 2,97 m = 187,1 m², umanjeno 15 % za otvore.'),
    A('g04', 'Zidanje pregradnih zidova blok opekom d=10–15 cm', 'm²', 130.0, 'Procjena ≈ 25 m pregradnih zidova po etaži × 2,60 m; provjeriti mjerenjem na tlocrtima.'),
    A('g04', 'Unutarnja vapneno-cementna žbuka zidova', 'm²', 419.0, 'Unutarnja strana vanjskih zidova 159 m² + obje strane pregradnih 2 × 130 m².', 'zavrsni'),
    A('g04', 'Unutarnja žbuka stropova', 'm²', 84.77, 'Neto površine prizemlja 40,41 + kata 44,36 m² (str. 1 i 2).', 'zavrsni'),
    A('g05', 'Hidroizolacija podne ploče bitumenskom trakom s uloškom poliesterskog filca', 'm²', 63.51, 'Sloj P1: 57,74 m² + 10 % preklopi i podizanje uz zid.', 'temelji'),
    A('g05', 'Toplinska izolacija poda prema tlu XPS d=10 cm', 'm²', 40.41, 'Sloj P1 × neto površina prizemlja 40,41 m².'),
    A('g05', 'Toplinska izolacija EPS100 d=6 cm za podno grijanje', 'm²', 82.97, 'Slojevi P1 i MK: neto 84,77 m² − balkon 1,80 m².'),
    A('g05', 'Toplinska izolacija poda tavana kamenom vunom d=18 cm', 'm²', 42.56, 'Sloj M1: neto kat 44,36 − balkon 1,80 m².'),
    A('g06', 'Izrada drvene krovne konstrukcije (rogovi 10/14, podrožnice)', 'm²', 88.3, 'Tlocrt krova ≈ 9,75 × 8,00 m s prepustima, nagib 23–33° (presjek): 78 m² / cos 28°.'),
    A('g06', 'Postava OSB ploča d=1,5 cm na rogove', 'm²', 88.3, 'Sloj K1 × krovna ploha.'),
    A('g07', 'Pokrivanje krova glinenim utorenim crijepom s letvama, kontraletvama i kišnom branom', 'm²', 88.3, 'Sloj K1 × krovna ploha.'),
    A('g08', 'Horizontalni oluk od pocinčanog lima', 'm', 19.5, 'Dvije strehe × 9,75 m.'),
    A('g08', 'Vertikalna odvodna cijev', 'm', 24, '4 cijevi × 6 m (visina strehe +5,78).'),
    A('g09', 'Kontaktna fasada (ETICS) EPS d=15 cm sa silikatnom žbukom', 'm²', 176.0, 'Sloj Z1: zidovi 159 m² + dva zabata ≈ 17 m².'),
    A('g10', 'PVC prozori i balkonska vrata s trostrukim staklom', 'kom', 0, 'AI ne može pouzdano prebrojati otvore: prebroj alatom Komad na tlocrtima.'),
    A('g10', 'Unutarnja vrata s dovratnikom', 'kom', 0, 'Prebroj alatom Komad na tlocrtima.'),
    A('g11', 'Cementni estrih d=6 cm', 'm²', 82.97, 'Slojevi P1 i MK: neto 84,77 − balkon 1,80 m².'),
    A('g11', 'Keramičke pločice na pod (ulaz, kuhinja, hodnik, kotlovnica, kupaonice)', 'm²', 23.14, 'Prizemlje 3,19 + 6,04 + 2,69 + 2,04 + 4,11; kat kupaonica i vešeraj 5,07 m².'),
    A('g11', 'Parket hrast, lijepljeni', 'm²', 59.83, 'Blagovaonica 7,08 + dnevni boravak 15,26 + sobe 8,77 + 12,41 + 9,01 + predsoblje 3,82 + stubište 3,48 m².'),
    A('g12', 'Gletanje i bojanje zidova i stropova disperzivnom bojom', 'm²', 501.97, 'Žbuka zidova 419 m² + stropova 82,97 m².'),
    A('g13', 'Vodovod i odvodnja prema projektu instalacija', 'kompl', 1, 'Prema strojarskom projektu.'),
    A('g13', 'Elektroinstalacije prema projektu', 'kompl', 1, 'Prema elektrotehničkom projektu.'),
    A('g13', 'Podno grijanje s razdjelnicima', 'm²', 82.97, 'Slojevi P1 i MK predviđaju podno grijanje.'),
  ];
}
function newProject(name, demo) {
  return {
    v: 1, id: uid(), name: name || 'Novi projekt', createdAt: Date.now(), updatedAt: Date.now(),
    meta: { gradjevina: demo ? 'Stambena zgrada s jednim stanom i garažom (P+1)' : '', lokacija: '', investitor: '', investitorOib: '', investitorAdr: '', izvodjac: '', izvodjacOib: '', izvodjacAdr: '', projektant: '', nadzor: '', pocetak: '', trajanjeDana: 180, jamstvoIzvrsenje: 10, jamstvoNedostaci: 5, jamstveniRokGod: 2, kaznaPromila: 1, mjesto: 'Zagreb' },
    pdf: demo ? { url: DEMO_PDF_URL, name: 'Primjer: nacrti obiteljske kuće (10 str.)', demo: true } : null,
    pageScale: {}, // page -> {mPerPt, src}
    phases: PHASES.map((p) => ({ ...p })),
    items: demo ? demoItems() : [],
    meas: [],
    contract: null,
    chat: demo ? [{ role: 'assistant', content: 'Pozdrav! Pročitao sam primjer nacrta (tlocrti 1:100, presjek sa slojevima, neto površine) i predložio 35 stavki s količinama. Svaka ima obrazloženje izračuna. Žute su AI prijedlozi: potvrdi ih, ispravi ručno ili izmjeri na nacrtu.\n\nMožeš mi pisati ili govoriti, npr. „dodaj stavku ograde balkona 7 m” ili „povećaj fasadu na 180 m²”.' }] : [],
  };
}

/* ---------- stanje ---------- */
let P = newProject('Primjer: obiteljska kuća P+1', true);
let role = 'projektant';
let view = 'nacrt';
const cap = { db: null, user: null, uid: null, sample: null, dict: null, dl: null, assets: null, imagesOk: false };
let projectsIndex = []; // [{id,name,updatedAt}]
let undoStack = [];

try { role = localStorage.getItem('gp.role') || 'projektant'; } catch {}

/* ---------- spremanje ---------- */
let saveTimer = null, saving = false, dirtyAgain = false;
function touch(render = true) {
  P.updatedAt = Date.now();
  setSave('Spremam…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
  if (render) renderCounts();
}
function setSave(t) { $('#saveState').textContent = t; }
async function saveNow() {
  if (saving) { dirtyAgain = true; return; }
  saving = true;
  const body = { name: P.name, updatedAt: P.updatedAt, data: JSON.parse(JSON.stringify(P)) };
  try {
    if (cap.db && cap.uid) {
      await cap.db.collection('data/users/' + cap.uid).doc('p_' + P.id).set(body);
      setSave('Spremljeno u oblak');
    } else {
      localStorage.setItem('gp.p_' + P.id, JSON.stringify(body));
      localStorage.setItem('gp.last', P.id);
      setSave('Spremljeno u ovom pregledniku');
    }
    const ix = projectsIndex.find((x) => x.id === P.id);
    if (ix) { ix.name = P.name; ix.updatedAt = P.updatedAt; } else projectsIndex.push({ id: P.id, name: P.name, updatedAt: P.updatedAt });
    try { localStorage.setItem('gp.last', P.id); } catch {}
  } catch (e) {
    setSave('Spremanje nije uspjelo');
    if (e && e.code === 'quota_exceeded') toast('Prostor za spremanje je pun. Izvezi projekt i obriši stare.');
  }
  saving = false;
  if (dirtyAgain) { dirtyAgain = false; saveNow(); }
}
async function loadProjectsList() {
  projectsIndex = [];
  if (cap.db && cap.uid) {
    const snap = await cap.db.collection('data/users/' + cap.uid).get();
    for (const d of snap.docs) { if (!d.id.startsWith('p_')) continue; const x = d.data(); projectsIndex.push({ id: d.id.slice(2), name: x.name, updatedAt: x.updatedAt }); }
  } else {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('gp.p_')) { const x = JSON.parse(localStorage.getItem(k)); projectsIndex.push({ id: k.slice(5), name: x.name, updatedAt: x.updatedAt }); } } } catch {}
  }
  projectsIndex.sort((a, b) => b.updatedAt - a.updatedAt);
}
async function openProject(id) {
  let body = null;
  if (cap.db && cap.uid) { const s = await cap.db.collection('data/users/' + cap.uid).doc('p_' + id).get(); if (s.exists) body = s.data(); }
  else { try { body = JSON.parse(localStorage.getItem('gp.p_' + id)); } catch {} }
  if (!body) return toast('Projekt nije pronađen.');
  P = JSON.parse(JSON.stringify(body.data));
  migrate(P);
  undoStack = [];
  try { localStorage.setItem('gp.last', P.id); } catch {}
  setSave(cap.db ? 'Spremljeno u oblak' : 'Spremljeno u ovom pregledniku');
  await loadPdfForProject();
  renderAll();
}
function migrate(p) {
  p.phases ||= PHASES.map((x) => ({ ...x })); p.items ||= []; p.meas ||= []; p.pageScale ||= {}; p.chat ||= []; p.meta ||= {};
  if (p.pdf && p.pdf.demo) p.pdf.url = DEMO_PDF_URL;
}

/* ---------- PDF ---------- */
let pdfDoc = null, curPage = 1, zoom = 1, pageInfo = {}, renderTask = null, pageView = null;
async function loadPdfForProject() {
  pdfDoc = null; pageInfo = {}; curPage = 1;
  if (P.pdf && P.pdf.url && !P.pdf.url.startsWith('__')) {
    try { pdfDoc = await pdfjsLib.getDocument({ url: P.pdf.url, isEvalSupported: false }).promise; }
    catch (e) { console.warn(e); toast('Nacrt se ne može otvoriti. Učitaj PDF ponovno.'); }
  } else if (P.pdf && P.pdf.session && sessionPdf[P.id]) {
    pdfDoc = await pdfjsLib.getDocument({ data: sessionPdf[P.id].slice(0), isEvalSupported: false }).promise;
  }
  if (pdfDoc) { await analyzeAllPages(); zoom = 0; }
}
const sessionPdf = {};
async function analyzeAllPages() {
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter((t) => t.str && t.str.trim());
    // tekst u redoslijedu čitanja (odozgo prema dolje, slijeva nadesno)
    const sorted = items.slice().sort((a, b) => (Math.round((b.transform[5] - a.transform[5]) / 4)) || (a.transform[4] - b.transform[4]));
    const text = sorted.map((t) => t.str).join(' ');
    // naziv nacrta: najveći tekst u donjih 25 % stranice koji nije broj
    let title = '';
    let best = 0;
    for (const t of items) {
      const y = vp.height - t.transform[5];
      const h = Math.hypot(t.transform[2], t.transform[3]);
      if (y > vp.height * 0.75 && h > best && /[A-ZČĆŠĐŽ]{3,}/.test(t.str) && !/SAGRADA|GRAĐEVINA|INVESTITOR|LOKACIJA|NAMJENA|RAZINA|PROJEKT/i.test(t.str)) { best = h; title = t.str.trim(); }
    }
    // mjerilo: oznaka „1:N” najbliža riječi „mjerilo”, inače bilo koja samostalna oznaka 1:N
    let ratio = null;
    const scaleItems = items.filter((t) => /^\s*(M\s*)?1\s*:\s*\d{2,4}\s*$/.test(t.str));
    const lbl = items.find((t) => /mjerilo|scale|ma(ß|ss)stab/i.test(t.str));
    const inLbl = lbl && lbl.str.match(/1\s*:\s*(\d{2,4})/);
    if (inLbl) ratio = Number(inLbl[1]);
    else if (scaleItems.length) {
      const near = lbl ? scaleItems.slice().sort((a, b) => Math.hypot(a.transform[4] - lbl.transform[4], a.transform[5] - lbl.transform[5]) - Math.hypot(b.transform[4] - lbl.transform[4], b.transform[5] - lbl.transform[5]))[0] : scaleItems[0];
      ratio = Number(near.str.match(/:\s*(\d+)/)[1]);
    }
    pageInfo[i] = { w: vp.width, h: vp.height, text, title: title || ('Stranica ' + i), ratio };
    if (ratio && !P.pageScale[i]) P.pageScale[i] = { mPerPt: (0.0254 / 72) * ratio, src: 'Iz nacrta 1:' + ratio };
  }
}
function scaleOf(page) { return P.pageScale[page]?.mPerPt || null; }

// Platno nacrta se crta točno u fizičkim pikselima zaslona (bez razvlačenja), izvan ekrana, pa se zamijeni odjednom (bez treperenja).
let renderSeq = 0;
function pdfSizes(base) {
  const dpr = window.devicePixelRatio || 1, cssW = Math.round(base.width * zoom), cssH = Math.round(base.height * zoom);
  let k = dpr; const MAXPX = 24e6; if (cssW * cssH * k * k > MAXPX) k = Math.sqrt(MAXPX / (cssW * cssH));
  return { cssW, cssH, pxW: Math.round(cssW * k), pxH: Math.round(cssH * k) };
}
async function renderPdfPage() {
  const paper = $('#paper');
  if (!pdfDoc) { paper.hidden = true; $('#emptyStage').hidden = false; drawOverlay(); return; }
  $('#emptyStage').hidden = true; paper.hidden = false;
  const seq = ++renderSeq, pageNo = curPage;
  const page = await pdfDoc.getPage(pageNo);
  if (seq !== renderSeq) return;
  const base = page.getViewport({ scale: 1 });
  if (!zoom) { const st = $('#stage'); zoom = Math.max(0.3, Math.min(4, (st.clientWidth - 48) / base.width)); }
  const { cssW, cssH, pxW, pxH } = pdfSizes(base);
  const cv = $('#pdfCanvas'), firstPaint = cv.dataset.page !== String(pageNo) + '|' + (P.pdf?.url || P.pdf?.name || '');
  cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  pageView = base;
  $('#zoomLbl').textContent = Math.round(zoom * 100) + '%';
  drawOverlay();
  if (renderTask) { try { renderTask.cancel(); } catch {} }
  const off = document.createElement('canvas'); off.width = pxW; off.height = pxH;
  const octx = off.getContext('2d', { alpha: false }); octx.fillStyle = '#fff'; octx.fillRect(0, 0, pxW, pxH);
  if (firstPaint) { cv.width = pxW; cv.height = pxH; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, pxW, pxH); }
  const task = renderTask = page.render({ canvasContext: octx, viewport: page.getViewport({ scale: pxW / base.width }) });
  try { await task.promise; } catch (e) { if (e?.name !== 'RenderingCancelledException') console.warn(e); return; }
  if (seq !== renderSeq) return;
  cv.width = pxW; cv.height = pxH; cv.getContext('2d').drawImage(off, 0, 0);
  cv.dataset.page = String(pageNo) + '|' + (P.pdf?.url || P.pdf?.name || '');
}
async function pageImageBlob(pageNo, maxW = 1600) {
  const page = await pdfDoc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const s = Math.min(3, maxW / base.width);
  const vp = page.getViewport({ scale: s });
  const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return await new Promise((res) => c.toBlob(res, 'image/png'));
}
let thumbsKey = '';
async function renderThumbs() {
  const box = $('#pages');
  const key = (P.pdf?.url || P.pdf?.name || '') + '|' + (pdfDoc?.numPages || 0) + '|' + P.id;
  if (key === thumbsKey && pdfDoc) {
    $$('.pg[data-page]', box).forEach((b, k) => { const i = k + 1; b.setAttribute('aria-current', String(i === curPage)); const cnt = P.meas.filter((m) => m.page === i).length; $('span', b).textContent = (pageInfo[i]?.ratio ? '1:' + pageInfo[i].ratio : 'mjerilo ?') + (cnt ? ' · ' + cnt + ' izmjera' : ''); });
    return;
  }
  thumbsKey = pdfDoc ? key : '';
  box.innerHTML = '';
  const up = document.createElement('button');
  up.className = 'upload'; up.textContent = P.pdf ? 'Zamijeni nacrt (PDF)' : 'Učitaj nacrt (PDF)';
  up.onclick = () => $('#pdfFile').click();
  box.append(up);
  if (P.pdf) { const n = document.createElement('div'); n.className = 'note'; n.textContent = P.pdf.name + (P.pdf.session ? ' · samo za ovu sesiju' : ''); box.append(n); }
  if (!pdfDoc) return;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const b = document.createElement('button');
    b.className = 'pg'; b.dataset.page = i; b.setAttribute('aria-current', String(i === curPage));
    const cnt = P.meas.filter((m) => m.page === i).length;
    b.innerHTML = `<canvas width="140" height="190"></canvas><b>${i}. ${esc(pageInfo[i]?.title || '')}</b><span>${pageInfo[i]?.ratio ? '1:' + pageInfo[i].ratio : 'mjerilo ?'}${cnt ? ' · ' + cnt + ' izmjera' : ''}</span>`;
    b.onclick = () => { curPage = i; cancelDraw(); renderNacrt(); };
    box.append(b);
    pdfDoc.getPage(i).then((page) => {
      const base = page.getViewport({ scale: 1 }), tw = Math.round(160 * Math.min(window.devicePixelRatio || 1, 3)); const vp = page.getViewport({ scale: tw / base.width });
      const c = $('canvas', b); c.width = tw; c.height = Math.round(vp.height); page.render({ canvasContext: c.getContext('2d'), viewport: vp });
    });
  }
  const v3 = document.createElement('button'); v3.className = 'pg v3d-card';
  v3.innerHTML = '<b>3D vizualizacija objekta</b><span>Pogled sa svih strana, faze gradnje i slike visoke rezolucije</span>';
  v3.onclick = () => showView('3d'); box.append(v3);
}

/* ---------- mjerenje ---------- */
let tool = 'pan', draft = null, hoverPt = null, selMeas = null;
const TOOL_HINT = {
  pan: 'Povuci nacrt mišem. Kotačić + Ctrl za zum.',
  length: 'Klikni točke duž zida ili kote. Dvoklik ili Enter za kraj.',
  area: 'Klikni kutove površine. Dvoklik ili Enter za kraj.',
  count: 'Klikni svaki komad (prozor, vrata…). Enter za kraj.',
  calib: 'Klikni dva kraja poznate kote, zatim upiši njezinu duljinu.',
};
function setTool(t) {
  tool = t; draft = null;
  $$('.vtools [data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  $('#stage').classList.toggle('pan', t === 'pan'); $('#stage').classList.toggle('draw', t !== 'pan');
  $('#toolHint').textContent = TOOL_HINT[t];
  if (t !== 'pan' && pdfDoc && !scaleOf(curPage) && t !== 'calib') toast('Ova stranica nema mjerilo. Postavi ga alatom Mjerilo.');
  updateDrawBtns(); drawOverlay();
}
function updateDrawBtns() { const on = !!draft && draft.pts.length > 0; $('#finishBtn').hidden = !on || tool === 'calib'; $('#cancelBtn').hidden = !on; }
function cancelDraw() { draft = null; updateDrawBtns(); drawOverlay(); }
function evtPt(e) { const r = $('#overlay').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * pageView.width, (e.clientY - r.top) / r.height * pageView.height]; }
function measValue(type, pts, page) {
  const k = scaleOf(page) || 0;
  if (type === 'count') return pts.length;
  if (type === 'length' || type === 'calib') { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L * k; }
  if (type === 'area') { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2) * k * k; }
  return 0;
}
const UNIT_OF = { length: 'm', area: 'm²', count: 'kom' };
function drawOverlay() {
  const svg = $('#overlay');
  if (!pageView) { svg.innerHTML = ''; return; }
  svg.setAttribute('viewBox', `0 0 ${pageView.width} ${pageView.height}`);
  const sw = 1.6 / zoom, fs = 9 / Math.max(zoom, 0.6);
  let h = '';
  for (const m of P.meas.filter((m) => m.page === curPage)) {
    const it = P.items.find((i) => i.id === m.itemId);
    const col = m.id === selMeas ? '#e8590c' : '#1d5fd0';
    const pts = m.pts.map((p) => p.join(',')).join(' ');
    if (m.type === 'length') h += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${sw * 1.6}" stroke-linejoin="round" opacity=".9"/>`;
    if (m.type === 'area') h += `<polygon points="${pts}" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="${sw}"/>`;
    if (m.type === 'count') h += m.pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${5 / zoom + 2}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="${sw}"/>`).join('');
    const c = m.type === 'area' ? centroid(m.pts) : m.pts[m.pts.length - 1];
    const lbl = fq(r2(m.value)) + ' ' + UNIT_OF[m.type] + (it ? ' · ' + it.desc.slice(0, 26) : '');
    h += `<text x="${c[0] + 4 / zoom}" y="${c[1] - 4 / zoom}" font-size="${fs}" font-family="IBM Plex Sans, sans-serif" fill="${col}" stroke="#fff" stroke-width="${2.4 / zoom}" paint-order="stroke">${esc(lbl)}</text>`;
  }
  if (draft) {
    const pts = draft.pts.concat(hoverPt && draft.type !== 'count' ? [hoverPt] : []);
    const s = pts.map((p) => p.join(',')).join(' ');
    if (draft.type === 'area' && pts.length > 2) h += `<polygon points="${s}" fill="#e8590c" fill-opacity=".14" stroke="#e8590c" stroke-width="${sw}" stroke-dasharray="${4 / zoom}"/>`;
    else if (draft.type !== 'count') h += `<polyline points="${s}" fill="none" stroke="#e8590c" stroke-width="${sw * 1.4}" stroke-dasharray="${4 / zoom}"/>`;
    h += draft.pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${3 / zoom + 1}" fill="#e8590c"/>`).join('');
    if (draft.type !== 'calib' && scaleOf(curPage)) {
      const v = measValue(draft.type, pts, curPage); const last = pts[pts.length - 1];
      if (last) h += `<text x="${last[0] + 6 / zoom}" y="${last[1] + 14 / zoom}" font-size="${fs * 1.15}" font-weight="600" fill="#e8590c" stroke="#fff" stroke-width="${2.4 / zoom}" paint-order="stroke">${fq(r2(v))} ${UNIT_OF[draft.type]}</text>`;
    }
  }
  svg.innerHTML = h;
}
function centroid(pts) { let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
function finishDraw() {
  if (!draft) return;
  const { type, pts } = draft;
  if ((type === 'length' && pts.length < 2) || (type === 'area' && pts.length < 3) || (type === 'count' && pts.length < 1)) return toast('Premalo točaka.');
  if (!scaleOf(curPage)) { toast('Prvo postavi mjerilo stranice.'); return; }
  const value = measValue(type, pts, curPage);
  draft = null; updateDrawBtns(); drawOverlay();
  assignMeasModal({ id: uid(), page: curPage, type, pts, value, factor: 1, itemId: null });
}
function setupStage() {
  const stage = $('#stage'), svg = $('#overlay');
  let panning = null;
  stage.addEventListener('pointerdown', (e) => {
    if (tool !== 'pan' || !pdfDoc) return;
    panning = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop }; stage.setPointerCapture(e.pointerId); stage.style.cursor = 'grabbing';
  });
  stage.addEventListener('pointermove', (e) => { if (panning) { stage.scrollLeft = panning.sl - (e.clientX - panning.x); stage.scrollTop = panning.st - (e.clientY - panning.y); } });
  const endPan = () => { panning = null; stage.style.cursor = ''; };
  stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);
  svg.addEventListener('click', (e) => {
    if (tool === 'pan' || !pageView) return;
    const p = evtPt(e);
    if (!draft) draft = { type: tool, pts: [] };
    if (e.detail > 1 && (tool === 'length' || tool === 'area')) return; // dvoklik obrađuje dblclick
    draft.pts.push(p);
    if (tool === 'calib' && draft.pts.length === 2) { const pts = draft.pts; draft = null; drawOverlay(); calibModal(pts); return; }
    updateDrawBtns(); drawOverlay();
  });
  svg.addEventListener('dblclick', (e) => { if (tool === 'length' || tool === 'area') { e.preventDefault(); finishDraw(); } });
  svg.addEventListener('pointermove', (e) => { if (draft && pageView) { hoverPt = evtPt(e); drawOverlay(); } });
  stage.addEventListener('wheel', (e) => { if (!e.ctrlKey || !pdfDoc) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (view !== 'nacrt' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || $('#modalBg').classList.contains('open')) return;
    if (e.key === 'Enter' && draft) { e.preventDefault(); finishDraw(); }
    if (e.key === 'Escape') cancelDraw();
    if (e.key === 'Backspace' && draft?.pts.length) { draft.pts.pop(); drawOverlay(); updateDrawBtns(); }
  });
  $$('.vtools [data-tool]').forEach((b) => b.onclick = () => setTool(b.dataset.tool));
  $('#zoomIn').onclick = () => setZoom(zoom * 1.25);
  $('#zoomOut').onclick = () => setZoom(zoom / 1.25);
  $('#zoomFit').onclick = () => { zoom = 0; renderPdfPage(); };
  $('#finishBtn').onclick = finishDraw; $('#cancelBtn').onclick = cancelDraw;
}
let zoomTimer = null;
function setZoom(z) {
  zoom = Math.max(0.25, Math.min(6, z));
  if (pageView) { const { cssW, cssH } = pdfSizes(pageView), cv = $('#pdfCanvas'); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px'; $('#zoomLbl').textContent = Math.round(zoom * 100) + '%'; drawOverlay(); }
  clearTimeout(zoomTimer); zoomTimer = setTimeout(renderPdfPage, 130);
}

function recalcItem(it) {
  if (it.qtyMode !== 'meas') return;
  const ms = P.meas.filter((m) => m.itemId === it.id);
  it.qty = r2(ms.reduce((s, m) => s + m.value * (m.factor || 1), 0));
}

/* ---------- modal ---------- */
function openModal(html, onReady) {
  $('#modal').innerHTML = html; $('#modalBg').classList.add('open');
  const first = $('#modal input, #modal select, #modal textarea, #modal button'); if (first) setTimeout(() => first.focus(), 30);
  onReady && onReady($('#modal'));
}
function closeModal() { $('#modalBg').classList.remove('open'); $('#modal').innerHTML = ''; }
function confirmModal(title, text, okText, onOk) {
  openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="btns"><button class="btn" id="mNo">Odustani</button><button class="btn primary" id="mOk">${esc(okText)}</button></div>`, (m) => {
    $('#mNo', m).onclick = closeModal; $('#mOk', m).onclick = () => { closeModal(); onOk(); };
  });
}
function calibModal(pts) {
  const lenPt = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  openModal(`<h3>Postavi mjerilo</h3><p class="note">Upiši stvarnu duljinu linije koju si označio (npr. kotu „875” upiši kao 8,75 m).</p>
  <label for="calLen">Stvarna duljina (m)</label><input id="calLen" inputmode="decimal" placeholder="8,75">
  <div class="btns"><button class="btn" id="mNo">Odustani</button><button class="btn primary" id="mOk">Postavi mjerilo</button></div>`, (m) => {
    $('#mNo', m).onclick = closeModal;
    $('#mOk', m).onclick = () => {
      const L = parseNum($('#calLen', m).value); if (!L || L <= 0) return toast('Upiši duljinu u metrima.');
      P.pageScale[curPage] = { mPerPt: L / lenPt, src: 'Ručno postavljeno' };
      P.meas.filter((x) => x.page === curPage).forEach((x) => { x.value = measValue(x.type, x.pts, curPage); });
      P.items.forEach(recalcItem);
      closeModal(); touch(); setTool('length'); renderNacrt(); toast('Mjerilo postavljeno.');
    };
  });
}
function itemOptions(selected, unitFilter) {
  return GROUPS.map((g) => {
    const its = P.items.filter((i) => i.group === g.id && (!unitFilter || unitFilter.includes(i.unit)));
    if (!its.length) return '';
    return `<optgroup label="${esc(g.n)}">${its.map((i) => `<option value="${i.id}" ${i.id === selected ? 'selected' : ''}>${esc(i.desc.slice(0, 70))} (${esc(i.unit)})</option>`).join('')}</optgroup>`;
  }).join('');
}
function assignMeasModal(m, existing) {
  const unit = UNIT_OF[m.type];
  const units = m.type === 'length' ? ['m', 'm²', 'm³'] : m.type === 'area' ? ['m²', 'm³'] : ['kom'];
  const guess = { length: 'g04', area: 'g11', count: 'g10' }[m.type];
  openModal(`<h3>${existing ? 'Izmjera' : 'Nova izmjera'}: ${fq(r2(m.value))} ${unit}</h3>
  <label for="mItem">Pridruži stavci troškovnika</label>
  <select id="mItem"><option value="__new">+ Nova stavka…</option>${itemOptions(m.itemId, units)}</select>
  <div id="newItemBox" class="box">
    <label for="nDesc">Opis nove stavke</label><textarea id="nDesc" rows="2" placeholder="npr. Zidanje vanjskih zidova opekarskim blokom d=25 cm"></textarea>
    <div class="row2" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label for="nGroup">Vrsta radova<select id="nGroup">${GROUPS.map((g) => `<option value="${g.id}" ${g.id === guess ? 'selected' : ''}>${esc(g.n)}</option>`).join('')}</select></label>
      <label for="nUnit">Jed. mjere<select id="nUnit">${UNITS.map((u) => `<option ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    </div>
  </div>
  <label for="mFactor">Faktor (množi izmjeru)${m.type === 'length' ? ' – npr. visina zida 2,60 da duljina postane m²' : m.type === 'area' ? ' – npr. debljina 0,15 da površina postane m³' : ''}</label>
  <input id="mFactor" inputmode="decimal" value="${fq(m.factor || 1)}">
  <p class="note" id="mRes"></p>
  <div class="btns">${existing ? '<button class="btn" id="mDel">Obriši izmjeru</button>' : ''}<button class="btn" id="mNo">Odustani</button><button class="btn primary" id="mOk">Spremi</button></div>`, (md) => {
    const sel = $('#mItem', md), box = $('#newItemBox', md), fac = $('#mFactor', md), res = $('#mRes', md);
    const upd = () => { box.style.display = sel.value === '__new' ? '' : 'none'; const f = parseNum(fac.value) || 1; res.textContent = `Količina iz ove izmjere: ${fq(r2(m.value * f))}`; };
    sel.onchange = upd; fac.oninput = upd;
    if (m.itemId) sel.value = m.itemId; upd();
    $('#mNo', md).onclick = closeModal;
    if (existing) $('#mDel', md).onclick = () => { const it = P.items.find((i) => i.id === m.itemId); P.meas = P.meas.filter((x) => x.id !== m.id); if (it) { recalcItem(it); } closeModal(); touch(); renderNacrt(); };
    $('#mOk', md).onclick = () => {
      m.factor = parseNum(fac.value) || 1;
      let it;
      if (sel.value === '__new') {
        const d = $('#nDesc', md).value.trim(); if (!d) return toast('Upiši opis stavke.');
        const g = $('#nGroup', md).value;
        it = { id: uid(), group: g, desc: d, unit: $('#nUnit', md).value, qty: 0, price: null, priceSrc: null, phase: groupOf(g).ph, status: 'mjereno', qtyMode: 'meas', basis: 'Izmjereno na nacrtu.' };
        P.items.push(it);
      } else it = P.items.find((i) => i.id === sel.value);
      const old = P.items.find((i) => i.id === m.itemId);
      m.itemId = it.id;
      if (!existing) P.meas.push(m);
      if (it.qtyMode !== 'meas') { it.qtyMode = 'meas'; it.status = 'mjereno'; it.basis = (it.basis ? it.basis + ' ' : '') + '→ Zamijenjeno izmjerom na nacrtu.'; }
      recalcItem(it); if (old && old !== it) recalcItem(old);
      closeModal(); touch(); renderNacrt(); toast(`Stavka „${it.desc.slice(0, 40)}”: ${fq(it.qty)} ${it.unit}`);
    };
  });
}

/* ---------- NACRT render ---------- */
async function renderNacrt() {
  await renderThumbs();
  const sc = P.pageScale[curPage];
  $('#scaleChip').textContent = sc ? 'Mjerilo: ' + (sc.src || '') : 'Mjerilo: nije postavljeno';
  $('#toolHint').textContent = TOOL_HINT[tool];
  renderMPanel();
  await renderPdfPage();
}
function renderMPanel() {
  const el = $('#mpanel');
  const ms = P.meas.filter((m) => m.page === curPage);
  const title = pdfDoc ? (pageInfo[curPage]?.title || '') : 'Nema nacrta';
  el.innerHTML = `
  <div><h3>${esc(title)}</h3><div class="note">Stranica ${pdfDoc ? curPage + ' / ' + pdfDoc.numPages : '–'}</div></div>
  <div class="box">
    <b>AI izmjera ove stranice</b>
    <span class="note">AI čita nacrt (sliku i tekst) i predlaže stavke s količinama. Sve prijedloge potvrđuješ ili ispravljaš ručno.</span>
    <button class="btn ai" id="aiPage" ${pdfDoc ? '' : 'disabled'}>Predloži količine s ove stranice</button>
  </div>
  <div><h3>Izmjere na stranici (${ms.length})</h3></div>
  <div class="mlist">${ms.length ? ms.map((m) => { const it = P.items.find((i) => i.id === m.itemId); return `<div class="mrow ${m.id === selMeas ? 'sel' : ''}" data-m="${m.id}">
      <span>${{ length: 'Duljina', area: 'Površina', count: 'Komadi' }[m.type]}</span><span class="v">${fq(r2(m.value))} ${UNIT_OF[m.type]}${m.factor && m.factor !== 1 ? ' × ' + fq(m.factor) : ''}</span>
      <span class="it">${it ? esc(it.desc.slice(0, 60)) + ' → ' + fq(it.qty) + ' ' + esc(it.unit) : 'Nije pridruženo stavci'}</span></div>`; }).join('') : '<p class="note">Odaberi alat Duljina, Površina ili Komad i klikaj po nacrtu. Svaka izmjera ide u stavku troškovnika.</p>'}</div>`;
  $('#aiPage', el).onclick = () => aiFromPage();
  $$('.mrow', el).forEach((r) => r.onclick = () => { const m = P.meas.find((x) => x.id === r.dataset.m); selMeas = m.id; drawOverlay(); renderMPanel(); assignMeasModal(m, true); });
}

/* ---------- TROŠKOVNIK ---------- */
const filters = { onlyAi: false, q: '' };
function totals() {
  let sum = 0, missing = 0;
  const byGroup = {}, byPhase = {};
  for (const it of P.items) {
    const v = (it.qty || 0) * (it.price || 0);
    sum += v; byGroup[it.group] = (byGroup[it.group] || 0) + v; byPhase[it.phase] = (byPhase[it.phase] || 0) + v;
    if ((it.qty || 0) > 0 && !(it.price > 0)) missing++;
  }
  return { sum, pdv: sum * PDV, total: sum * (1 + PDV), byGroup, byPhase, missing, ai: P.items.filter((i) => i.status === 'ai' || i.priceSrc === 'ai').length };
}
function rbMap() {
  const map = {}; let gi = 0;
  for (const g of GROUPS) { const its = P.items.filter((i) => i.group === g.id); if (!its.length) continue; its.forEach((it, k) => { map[it.id] = ROMAN[gi] + '.' + (k + 1); }); gi++; }
  return map;
}
function renderTroskovnik() {
  const t = totals(), rb = rbMap(), isI = role === 'izvodjac';
  const priceLbl = isI ? 'Jed. cijena (€)' : 'Proc. cijena (€)';
  let gi = 0;
  const groupsHtml = GROUPS.map((g) => {
    let its = P.items.filter((i) => i.group === g.id);
    if (!its.length) return '';
    const roman = ROMAN[gi++];
    if (filters.onlyAi) its = its.filter((i) => i.status === 'ai' || i.priceSrc === 'ai');
    if (filters.q) its = its.filter((i) => i.desc.toLowerCase().includes(filters.q));
    if (!its.length) return '';
    return `<section class="grp" data-g="${g.id}">
      <div class="grp-h"><h2>${roman}. ${esc(g.n)}</h2><span class="sum">${eur(t.byGroup[g.id])}</span></div>
      <div class="tbl-wrap"><table class="items"><colgroup><col class="c-rb"><col><col class="c-unit"><col class="c-q"><col class="c-p"><col class="c-t"><col class="c-ph"><col class="c-st"></colgroup><thead><tr><th>Rb</th><th>Opis stavke</th><th>Jed.</th><th style="text-align:right">Količina</th><th style="text-align:right">${priceLbl}</th><th style="text-align:right">Iznos (€)</th><th>Faza</th><th>Status</th></tr></thead><tbody>
      ${its.map((it) => rowHtml(it, rb[it.id])).join('')}
      </tbody></table></div>
      <div class="grp-f"><button class="btn small" data-add="${g.id}">+ Stavka</button><button class="btn small" data-cat="${g.id}">+ Iz kataloga</button></div>
    </section>`;
  }).join('');
  const recapG = GROUPS.map((g, i) => t.byGroup[g.id] !== undefined ? `<tr><td>${esc(g.n)}</td><td class="n">${eur(t.byGroup[g.id])}</td></tr>` : '').join('');
  const recapP = P.phases.map((p) => t.byPhase[p.id] ? `<tr><td>${esc(p.n)}</td><td class="n">${eur(t.byPhase[p.id])}</td><td class="n">${t.sum ? nfq.format(t.byPhase[p.id] / t.sum * 100) + ' %' : ''}</td></tr>` : '').join('');
  $('#trosWrap').innerHTML = `
  <div class="tiles">
    <div class="tile"><div class="k">${isI ? 'Ponuda bez PDV-a' : 'Procjena bez PDV-a'}</div><div class="v">${eur(t.sum)}</div></div>
    <div class="tile"><div class="k">PDV 25 %</div><div class="v">${eur(t.pdv)}</div></div>
    <div class="tile"><div class="k">Ukupno s PDV-om</div><div class="v">${eur(t.total)}</div></div>
    <div class="tile ${t.ai ? 'warn' : ''}"><div class="k">Čeka tvoju potvrdu</div><div class="v">${t.ai} ${t.ai === 1 ? 'stavka' : 'stavki'}</div></div>
  </div>
  ${isI && t.missing ? `<div class="warnbar">${t.missing} stavki ima količinu, a nema cijenu. Upiši cijene ili pitaj AI asistenta za okvirnu procjenu.</div>` : ''}
  ${!isI ? `<div class="note">Uloga Projektant: radiš opise i količine (projektantski troškovnik). Cijene su neobavezne procjene; izvođač upisuje svoje u ulozi Izvođač.</div>` : ''}
  <div class="toolbar">
    <button class="btn primary" id="confirmAll" ${t.ai ? '' : 'disabled'}>Potvrdi sve AI prijedloge (${t.ai})</button>
    <label class="btn ghost" for="onlyAi"><input type="checkbox" id="onlyAi" ${filters.onlyAi ? 'checked' : ''}> Samo za potvrdu</label>
    <input class="btn" id="q" placeholder="Traži stavku…" value="${esc(filters.q)}" style="min-width:180px">
    <div class="spacer"></div>
    <button class="btn" id="expCsv">Preuzmi za Excel (.csv)</button>
    <button class="btn" id="expDoc">Preuzmi za Word (.docx)</button>
    <button class="btn" id="expJson">Izvezi projekt</button>
    <button class="btn" id="impJson">Uvezi projekt</button>
  </div>
  ${groupsHtml || '<p class="note">Troškovnik je prazan. Dodaj stavku, izmjeri je na nacrtu ili zamoli AI asistenta da predloži stavke.</p>'}
  <div class="toolbar"><button class="btn" id="addAny">+ Nova stavka</button></div>
  <section class="grp"><div class="grp-h"><h2>Rekapitulacija po vrstama radova</h2></div>
    <table class="recap"><tbody>${recapG}
    <tr><td>Ukupno bez PDV-a</td><td class="n">${eur(t.sum)}</td></tr><tr><td>PDV 25 %</td><td class="n">${eur(t.pdv)}</td></tr>
    <tr class="total"><td>SVEUKUPNO</td><td class="n">${eur(t.total)}</td></tr></tbody></table></section>
  <section class="grp"><div class="grp-h"><h2>Po fazama gradnje (osnova za plaćanje u ugovoru)</h2></div>
    <table class="recap"><thead><tr><th>Faza</th><th class="n">Iznos bez PDV-a</th><th class="n">Udio</th></tr></thead><tbody>${recapP || '<tr><td colspan="3" class="note">Upiši cijene da se vidi raspodjela po fazama.</td></tr>'}</tbody></table></section>`;
  bindTroskovnik();
}
function rowHtml(it, rb) {
  const st = STATUS[it.status] || STATUS.rucno;
  const amt = (it.qty || 0) * (it.price || 0);
  const hasMeas = P.meas.some((m) => m.itemId === it.id);
  return `<tr class="st-${it.status}" data-id="${it.id}">
    <td class="rb">${rb}</td>
    <td><textarea class="cell" data-f="desc" rows="2">${esc(it.desc)}</textarea>${it.basis ? `<div class="basis" title="Obrazloženje količine">ⓘ ${esc(it.basis)}</div>` : ''}</td>
    <td><select class="cell" data-f="unit">${UNITS.concat(UNITS.includes(it.unit) ? [] : [it.unit]).map((u) => `<option ${u === it.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></td>
    <td><input class="cell n" data-f="qty" inputmode="decimal" value="${fq(it.qty)}" title="${it.qtyMode === 'meas' ? 'Količina iz izmjera na nacrtu. Upiši broj da je nadjačaš.' : 'Upiši količinu'}">${hasMeas && it.qtyMode !== 'meas' ? '<button class="btn small" data-remeas style="margin-top:2px">Vrati na izmjeru</button>' : ''}</td>
    <td><input class="cell n" data-f="price" inputmode="decimal" value="${fp(it.price)}" placeholder="–">${it.priceSrc === 'ai' ? '<span class="dot-ai" title="Cijenu je predložio AI"></span>' : ''}</td>
    <td class="tot">${amt ? nf2.format(amt) : '–'}</td>
    <td><select class="cell" data-f="phase">${P.phases.map((p) => `<option value="${p.id}" ${p.id === it.phase ? 'selected' : ''}>${esc(p.n)}</option>`).join('')}</select></td>
    <td><div class="acts"><span class="pill ${st.c}">${st.n}</span>${it.status === 'ai' || it.priceSrc === 'ai' ? '<button class="icon-btn okb" data-ok title="Potvrdi">✓</button>' : ''}<button class="icon-btn" data-ask title="Pitaj AI o ovoj stavci">?</button><button class="icon-btn del" data-del title="Obriši stavku">×</button></div></td>
  </tr>`;
}
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
function bindTroskovnik() {
  const w = $('#trosWrap');
  $$('textarea.cell', w).forEach((ta) => { autoGrow(ta); ta.addEventListener('input', () => autoGrow(ta)); });
  $$('tr[data-id]', w).forEach((tr) => {
    const it = P.items.find((i) => i.id === tr.dataset.id);
    $$('[data-f]', tr).forEach((inp) => {
      inp.onchange = () => {
        const f = inp.dataset.f;
        if (f === 'qty') { const n = parseNum(inp.value); it.qty = n ?? 0; it.qtyMode = 'manual'; it.status = 'rucno'; }
        else if (f === 'price') { const n = parseNum(inp.value); it.price = n; it.priceSrc = n === null ? null : 'rucno'; }
        else if (f === 'desc') { it.desc = inp.value; if (it.status === 'ai') it.status = 'rucno'; }
        else it[f] = inp.value;
        touch(); renderTroskovnik();
      };
    });
    const ok = $('[data-ok]', tr); if (ok) ok.onclick = () => { if (it.status === 'ai') it.status = 'ok'; if (it.priceSrc === 'ai') it.priceSrc = 'ok'; touch(); renderTroskovnik(); };
    $('[data-del]', tr).onclick = () => confirmModal('Obriši stavku?', it.desc, 'Obriši', () => { P.items = P.items.filter((x) => x !== it); P.meas.forEach((m) => { if (m.itemId === it.id) m.itemId = null; }); touch(); renderTroskovnik(); });
    $('[data-ask]', tr).onclick = () => { openChat(); $('#chatInput').value = `Stavka „${it.desc}” (${fq(it.qty)} ${it.unit}): `; $('#chatInput').focus(); };
    const rm = $('[data-remeas]', tr); if (rm) rm.onclick = () => { it.qtyMode = 'meas'; it.status = 'mjereno'; recalcItem(it); touch(); renderTroskovnik(); };
  });
  $$('[data-add]', w).forEach((b) => b.onclick = () => addItemModal(b.dataset.add));
  $$('[data-cat]', w).forEach((b) => b.onclick = () => catalogModal(b.dataset.cat));
  $('#addAny', w).onclick = () => addItemModal('g14');
  $('#confirmAll', w).onclick = () => confirmModal('Potvrdi sve AI prijedloge?', 'Sve žute stavke postat će potvrđene. Količine i cijene i dalje možeš mijenjati.', 'Potvrdi sve', () => { P.items.forEach((i) => { if (i.status === 'ai') i.status = 'ok'; if (i.priceSrc === 'ai') i.priceSrc = 'ok'; }); touch(); renderTroskovnik(); });
  $('#onlyAi', w).onchange = (e) => { filters.onlyAi = e.target.checked; renderTroskovnik(); };
  $('#q', w).oninput = (e) => { filters.q = e.target.value.toLowerCase(); clearTimeout(bindTroskovnik._t); bindTroskovnik._t = setTimeout(() => { renderTroskovnik(); const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350); };
  $('#expCsv', w).onclick = exportCsv; $('#expDoc', w).onclick = exportDoc; $('#expJson', w).onclick = exportJson; $('#impJson', w).onclick = () => $('#jsonFile').click();
}
function addItemModal(group, preset = {}) {
  openModal(`<h3>Nova stavka</h3>
  <label for="aDesc">Opis</label><textarea id="aDesc" rows="3">${esc(preset.desc || '')}</textarea>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <label for="aGroup">Vrsta radova<select id="aGroup">${GROUPS.map((g) => `<option value="${g.id}" ${g.id === group ? 'selected' : ''}>${esc(g.n)}</option>`).join('')}</select></label>
    <label for="aUnit">Jed. mjere<select id="aUnit">${UNITS.map((u) => `<option ${u === (preset.unit || 'm²') ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label for="aQty">Količina<input id="aQty" inputmode="decimal"></label>
    <label for="aPrice">Jed. cijena (€)<input id="aPrice" inputmode="decimal" placeholder="neobavezno"></label>
  </div>
  <div class="btns"><button class="btn" id="mNo">Odustani</button><button class="btn primary" id="mOk">Dodaj</button></div>`, (m) => {
    $('#mNo', m).onclick = closeModal;
    $('#mOk', m).onclick = () => {
      const d = $('#aDesc', m).value.trim(); if (!d) return toast('Upiši opis stavke.');
      const g = $('#aGroup', m).value, price = parseNum($('#aPrice', m).value);
      P.items.push({ id: uid(), group: g, desc: d, unit: $('#aUnit', m).value, qty: parseNum($('#aQty', m).value) || 0, price, priceSrc: price === null ? null : 'rucno', phase: groupOf(g).ph, status: 'rucno', qtyMode: 'manual', basis: '' });
      closeModal(); touch(); renderTroskovnik();
    };
  });
}
function catalogModal(group) {
  const list = CATALOG[group] || [];
  openModal(`<h3>Katalog: ${esc(groupOf(group).n)}</h3><div class="mlist">${list.map((c, i) => `<button class="mrow" data-i="${i}" style="text-align:left"><span>${esc(c[0])}</span><span class="v">${esc(c[1])}</span></button>`).join('')}</div><div class="btns"><button class="btn" id="mNo">Zatvori</button></div>`, (m) => {
    $('#mNo', m).onclick = closeModal;
    $$('[data-i]', m).forEach((b) => b.onclick = () => { const c = list[b.dataset.i]; closeModal(); addItemModal(group, { desc: c[0], unit: c[1] }); });
  });
}

/* ---------- izvoz ---------- */
async function saveFile(filename, data, mime) {
  if (cap.dl) {
    try { await cap.dl.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime }) }); toast('Datoteka je spremljena.'); return; }
    catch (e) { if (e?.code === 'declined') return; if (e?.code === 'rate_limited') return toast('Već je otvoren prozor za spremanje.'); console.warn(e); }
  }
  if (typeof data !== 'string') return toast('Preuzimanje nije dostupno u ovom prikazu. Otvori program na claude.ai.');
  try { await navigator.clipboard.writeText(data); toast('Preuzimanje nije dostupno ovdje: sadržaj je kopiran u međuspremnik.'); }
  catch { toast('Preuzimanje nije dostupno u ovom prikazu.'); }
}
function safeName(s) { return (s || 'projekt').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40); }
function exportCsv() {
  const rb = rbMap(), withPrice = role === 'izvodjac' || P.items.some((i) => i.price);
  const rows = [['Rb', 'Vrsta radova', 'Opis', 'Jed. mjere', 'Količina'].concat(withPrice ? ['Jed. cijena (EUR)', 'Iznos (EUR)'] : []).concat(['Faza', 'Status'])];
  for (const g of GROUPS) for (const it of P.items.filter((i) => i.group === g.id)) {
    rows.push([rb[it.id], g.n, it.desc, it.unit, fq(it.qty)].concat(withPrice ? [fp(it.price), fp((it.qty || 0) * (it.price || 0))] : []).concat([phaseName(it.phase), STATUS[it.status]?.n || '']));
  }
  const t = totals();
  if (withPrice) { rows.push([]); rows.push(['', '', 'Ukupno bez PDV-a', '', '', '', fp(t.sum)]); rows.push(['', '', 'PDV 25 %', '', '', '', fp(t.pdv)]); rows.push(['', '', 'SVEUKUPNO', '', '', '', fp(t.total)]); }
  const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  saveFile(`Troskovnik_${safeName(P.name)}.csv`, csv, 'text/csv');
}
function troskovnikDocHtml() {
  const rb = rbMap(), t = totals(), isI = role === 'izvodjac', withPrice = isI || P.items.some((i) => i.price);
  let body = `<h1 style="text-align:center">${isI ? 'PONUDBENI' : 'PROJEKTANTSKI'} TROŠKOVNIK</h1><p style="text-align:center">${esc(P.name)}${P.meta.lokacija ? ', ' + esc(P.meta.lokacija) : ''}</p>`;
  let gi = 0;
  for (const g of GROUPS) {
    const its = P.items.filter((i) => i.group === g.id); if (!its.length) continue;
    body += `<h3>${ROMAN[gi++]}. ${esc(g.n)}</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%"><tr><th>Rb</th><th>Opis</th><th>Jed.</th><th>Količina</th>${withPrice ? '<th>Jed. cijena</th><th>Iznos</th>' : ''}</tr>` +
      its.map((it) => `<tr><td>${rb[it.id]}</td><td>${esc(it.desc)}</td><td>${esc(it.unit)}</td><td align="right">${fq(it.qty)}</td>${withPrice ? `<td align="right">${fp(it.price)}</td><td align="right">${fp((it.qty || 0) * (it.price || 0))}</td>` : ''}</tr>`).join('') +
      (withPrice ? `<tr><td colspan="5" align="right"><b>Ukupno ${esc(g.n)}</b></td><td align="right"><b>${fp(t.byGroup[g.id])}</b></td></tr>` : '') + '</table>';
  }
  if (withPrice) body += `<h3>REKAPITULACIJA</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%">${GROUPS.filter((g) => t.byGroup[g.id] !== undefined).map((g) => `<tr><td>${esc(g.n)}</td><td align="right">${fp(t.byGroup[g.id])} €</td></tr>`).join('')}<tr><td>Ukupno bez PDV-a</td><td align="right">${fp(t.sum)} €</td></tr><tr><td>PDV 25 %</td><td align="right">${fp(t.pdv)} €</td></tr><tr><td><b>SVEUKUPNO</b></td><td align="right"><b>${fp(t.total)} €</b></td></tr></table>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troškovnik</title></head><body style="font-family:Arial;font-size:11pt">${body}</body></html>`;
}
function exportDoc() { saveFile(`Troskovnik_${safeName(P.name)}.docx`, makeDocx(troskovnikDocHtml()), DOCX_MIME); }
function exportJson() { saveFile(`Projekt_${safeName(P.name)}.json`, JSON.stringify(P, null, 1), 'application/json'); }


/* ---------- .docx (pravi Word dokument) ---------- */
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const [name, content] of files) {
    const nb = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + data.length;
  }
  const cs = central.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: DOCX_MIME });
}
// mali HTML parser (naš HTML i HTML iz uređivača ugovora) → WordprocessingML
function parseHtml(html) {
  const root = { tag: 'root', kids: [], attrs: '' }, stack = [root];
  const VOID = /^(br|hr|img|input|meta|link|col)$/i;
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g; let m;
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  while ((m = re.exec(body))) {
    if (m[3] !== undefined) { stack[stack.length - 1].kids.push({ text: m[3] }); continue; }
    if (!m[1]) continue;
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    const node = { tag, attrs: m[2] || '', kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!VOID.test(tag) && !/\/\s*$/.test(m[2] || '')) stack.push(node);
  }
  return root;
}
const decodeEnt = (t) => t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&');
const xmlEsc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function runsOf(node, fmt = {}) {
  let out = '';
  for (const k of node.kids || []) {
    if (k.text !== undefined) { const t = decodeEnt(k.text).replace(/\s+/g, ' '); if (!t) continue; out += `<w:r><w:rPr>${fmt.b ? '<w:b/>' : ''}${fmt.i ? '<w:i/>' : ''}${fmt.u ? '<w:u w:val="single"/>' : ''}${fmt.sz ? `<w:sz w:val="${fmt.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`; continue; }
    if (k.tag === 'br') { out += '<w:r><w:br/></w:r>'; continue; }
    const f = { ...fmt }; if (/^(b|strong|th)$/.test(k.tag)) f.b = true; if (/^(i|em)$/.test(k.tag)) f.i = true; if (k.tag === 'u') f.u = true;
    out += runsOf(k, f);
  }
  return out;
}
function para(node, opt = {}) {
  const center = opt.center || /text-align:\s*center|align="center"/i.test(node.attrs || '');
  const right = /text-align:\s*right|align="right"|class="n"/i.test(node.attrs || '');
  const jc = center ? '<w:jc w:val="center"/>' : right ? '<w:jc w:val="right"/>' : '';
  const sp = opt.before ? `<w:spacing w:before="${opt.before}" w:after="80"/>` : '<w:spacing w:after="80"/>';
  return `<w:p><w:pPr>${sp}${jc}</w:pPr>${runsOf(node, opt.fmt || {})}</w:p>`;
}
function blocksXml(node) {
  let out = '', inline = { kids: [] };
  const flush = () => { if (inline.kids.some((k) => k.text === undefined || k.text.trim())) out += para(inline); inline = { kids: [] }; };
  for (const k of node.kids || []) {
    const t = k.tag;
    if (k.text !== undefined || /^(b|strong|i|em|u|span|a|br)$/.test(t)) { inline.kids.push(k); continue; }
    flush();
    if (/^h[1-6]$/.test(t)) { const lvl = +t[1]; out += para(k, { center: lvl <= 2 || lvl === 4, before: 200, fmt: { b: true, sz: [0, 32, 28, 24, 22, 22, 22][lvl] } }); }
    else if (t === 'p') out += para(k);
    else if (t === 'table') {
      const rows = []; const walk = (n) => (n.kids || []).forEach((c) => { if (c.tag === 'tr') rows.push(c); else if (c.kids) walk(c); }); walk(k);
      const ncol = Math.max(1, ...rows.map((r) => r.kids.filter((c) => c.tag === 'td' || c.tag === 'th').length));
      const border = /border:\s*0/.test(k.attrs) ? 'none' : 'single';
      const b = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((x) => `<w:${x} w:val="${border}" w:sz="4" w:space="0" w:color="999999"/>`).join('');
      out += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${b}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(ncol)}</w:tblGrid>` +
        rows.map((r) => '<w:tr>' + r.kids.filter((c) => c.tag === 'td' || c.tag === 'th').map((c) => { const span = +((c.attrs.match(/colspan="?(\d+)/) || [])[1] || 1); const inner = ((c.kids || []).some((x) => x.tag && /^(p|div|h\d|table|ul|ol)$/.test(x.tag)) ? blocksXml(c) : para(c)) || '<w:p/>'; return `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}</w:tcPr>${c.tag === 'th' ? inner.replace(/<w:rPr>/g, '<w:rPr><w:b/>') : inner}</w:tc>`; }).join('') + '</w:tr>').join('') + '</w:tbl><w:p/>';
    }
    else if (t === 'ul' || t === 'ol') (k.kids || []).filter((c) => c.tag === 'li').forEach((li, i) => { out += para({ attrs: '', kids: [{ text: (t === 'ol' ? (i + 1) + '. ' : '• ') }, ...li.kids] }); });
    else if (/^(div|article|section|li|td|th|body|html|tbody|thead)$/.test(t)) {
      const hasBlock = (k.kids || []).some((c) => c.tag && /^(p|div|h\d|table|ul|ol)$/.test(c.tag));
      out += hasBlock ? blocksXml(k) : para(k);
    }
    else if (/^(style|script|title|head|meta)$/.test(t)) continue;
    else out += blocksXml(k);
  }
  flush();
  return out;
}
function makeDocx(html) {
  const bodyXml = blocksXml(parseHtml(html));
  return zipStore([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:lang w:val="hr-HR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`],
  ]);
}
/* ---------- UGOVOR ---------- */
const MF = [
  ['investitor', 'Investitor (naziv / ime)'], ['investitorOib', 'OIB investitora'], ['investitorAdr', 'Adresa investitora'],
  ['izvodjac', 'Izvođač (naziv)'], ['izvodjacOib', 'OIB izvođača'], ['izvodjacAdr', 'Adresa izvođača'],
  ['gradjevina', 'Građevina'], ['lokacija', 'Lokacija (k.č., k.o., adresa)'], ['projektant', 'Projektant / glavni projekt'], ['nadzor', 'Nadzorni inženjer'],
];
function contractHtml() {
  const M = P.meta, t = totals(), d = (x) => esc(x || '______________');
  const phases = P.phases.filter((p) => t.byPhase[p.id] > 0);
  const payRows = phases.map((p, i) => `<tr><td>${i + 1}.</td><td>${esc(p.n)}</td><td class="n">${fp(t.byPhase[p.id])} €</td><td class="n">${nfq.format(t.byPhase[p.id] / (t.sum || 1) * 100)} %</td></tr>`).join('');
  return `<h2>UGOVOR O GRAĐENJU</h2><p style="text-align:center">br. ______ / ${new Date().getFullYear()}.</p>
<p>Mjesto i datum sklapanja: ${d(M.mjesto)}, ______________. Ugovorne strane su:</p>
<p><b>${d(M.investitor)}</b>, OIB: ${d(M.investitorOib)}, ${d(M.investitorAdr)} (dalje: <b>Investitor</b>)</p>
<p>i</p>
<p><b>${d(M.izvodjac)}</b>, OIB: ${d(M.izvodjacOib)}, ${d(M.izvodjacAdr)} (dalje: <b>Izvođač</b>).</p>
<h4>Članak 1. Predmet ugovora</h4>
<p>Izvođač se obvezuje izvesti radove na građevini: <b>${d(M.gradjevina)}</b>, na lokaciji ${d(M.lokacija)}, prema glavnom projektu (${d(M.projektant)}) i ugovornom troškovniku, koji je sastavni dio ovog Ugovora (Prilog 1).</p>
<h4>Članak 2. Cijena</h4>
<p>Ugovorna cijena utvrđena je na temelju jediničnih cijena iz troškovnika i iznosi:</p>
<table><tr><td>Iznos bez PDV-a</td><td class="n">${fp(t.sum)} €</td></tr><tr><td>PDV 25 %</td><td class="n">${fp(t.pdv)} €</td></tr><tr><td><b>Ukupno</b></td><td class="n"><b>${fp(t.total)} €</b></td></tr></table>
<p>Jedinične cijene su nepromjenjive. Konačna cijena utvrđuje se prema stvarno izvedenim količinama upisanima u građevinsku knjigu i ovjerenima od nadzornog inženjera.</p>
<h4>Članak 3. Rokovi</h4>
<p>Izvođač počinje s radovima ${M.pocetak ? 'dana ' + esc(new Date(M.pocetak).toLocaleDateString('hr-HR')) : 'u roku od 8 dana od uvođenja u posao'} i dovršava ih u roku od <b>${esc(M.trajanjeDana || '___')}</b> kalendarskih dana od uvođenja u posao.</p>
<h4>Članak 4. Plaćanje po fazama</h4>
<p>Investitor plaća izvedene radove na temelju privremenih situacija, ovjerenih od nadzornog inženjera, u roku od 15 dana od zaprimanja eRačuna. Okvirna raspodjela po fazama gradnje:</p>
<table><tr><th>#</th><th>Faza</th><th>Iznos bez PDV-a</th><th>Udio</th></tr>${payRows || '<tr><td colspan="4">Raspodjela se popunjava kad troškovnik ima cijene.</td></tr>'}</table>
<p>Okončana situacija ispostavlja se nakon tehničkog pregleda i primopredaje.</p>
<h4>Članak 5. Jamstva</h4>
<p>Izvođač predaje jamstvo za uredno ispunjenje ugovora u iznosu od ${esc(M.jamstvoIzvrsenje)} % ugovorne cijene bez PDV-a, a prije okončane situacije jamstvo za otklanjanje nedostataka u jamstvenom roku u iznosu od ${esc(M.jamstvoNedostaci)} %.</p>
<h4>Članak 6. Jamstveni rok</h4>
<p>Jamstveni rok za izvedene radove iznosi ${esc(M.jamstveniRokGod)} godine od primopredaje. Za nedostatke koji se tiču ispunjavanja temeljnih zahtjeva za građevinu Izvođač odgovara u roku od 10 godina, sukladno Zakonu o obveznim odnosima.</p>
<h4>Članak 7. Ugovorna kazna</h4>
<p>Ako Izvođač krivnjom zakasni s dovršetkom radova, plaća ugovornu kaznu od ${esc(M.kaznaPromila)} ‰ ugovorne cijene za svaki dan zakašnjenja, najviše 10 % ugovorne cijene.</p>
<h4>Članak 8. Nadzor i građevinski dnevnik</h4>
<p>Stručni nadzor provodi ${d(M.nadzor)}. Izvođač vodi građevinski dnevnik i građevinsku knjigu sukladno Zakonu o gradnji i pripadajućem pravilniku.</p>
<h4>Članak 9. Više i nepredviđeni radovi</h4>
<p>Više i nepredviđene radove Izvođač izvodi samo uz pisani nalog Investitora, po jediničnim cijenama iz troškovnika, a za radove kojih nema u troškovniku po cijenama dogovorenima prije izvođenja.</p>
<h4>Članak 10. Završne odredbe</h4>
<p>Na sve što nije uređeno ovim Ugovorom primjenjuju se odredbe Zakona o obveznim odnosima i Zakona o gradnji. Sporove stranke rješavaju sporazumno, a ako to nije moguće, nadležan je stvarno nadležni sud prema mjestu gradnje. Ugovor je sastavljen u 4 istovjetna primjerka, po 2 za svaku stranu.</p>
<table style="border:0;margin-top:40px"><tr><td style="border:0;text-align:center">INVESTITOR<br><br>______________________</td><td style="border:0;text-align:center">IZVOĐAČ<br><br>______________________</td></tr></table>
<p style="font-size:12px;color:#666;margin-top:24px">Prilog 1: Ugovorni troškovnik. Predložak je radna verzija: prije potpisa ga treba provjeriti pravnik.</p>`;
}
function renderUgovor() {
  const M = P.meta;
  if (!P.contract) P.contract = { html: contractHtml(), edited: false, at: Date.now() };
  $('#ugWrap').innerHTML = `
  ${role === 'projektant' ? '<div class="note">Ugovor o građenju sklapaju investitor i izvođač. Kao projektant ga možeš pripremiti uz troškovnik za natječaj; cijene upisuje izvođač.</div>' : ''}
  <div class="ug-grid">
    <form class="form" id="ugForm">
      <h3>Podaci za ugovor</h3>
      ${MF.map(([k, l]) => `<label for="mf_${k}">${l}<input id="mf_${k}" data-k="${k}" value="${esc(M[k])}"></label>`).join('')}
      <div class="row2"><label for="mf_mjesto">Mjesto<input id="mf_mjesto" data-k="mjesto" value="${esc(M.mjesto)}"></label><label for="mf_pocetak">Početak radova<input type="date" id="mf_pocetak" data-k="pocetak" value="${esc(M.pocetak)}"></label></div>
      <div class="row2"><label for="mf_trajanjeDana">Rok (dana)<input id="mf_trajanjeDana" data-k="trajanjeDana" inputmode="numeric" value="${esc(M.trajanjeDana)}"></label><label for="mf_jamstveniRokGod">Jamstveni rok (god.)<input id="mf_jamstveniRokGod" data-k="jamstveniRokGod" inputmode="numeric" value="${esc(M.jamstveniRokGod)}"></label></div>
      <div class="row2"><label for="mf_jamstvoIzvrsenje">Jamstvo izvršenja (%)<input id="mf_jamstvoIzvrsenje" data-k="jamstvoIzvrsenje" inputmode="decimal" value="${esc(M.jamstvoIzvrsenje)}"></label><label for="mf_jamstvoNedostaci">Jamstvo nedostataka (%)<input id="mf_jamstvoNedostaci" data-k="jamstvoNedostaci" inputmode="decimal" value="${esc(M.jamstvoNedostaci)}"></label></div>
      <label for="mf_kaznaPromila">Ugovorna kazna (‰ dnevno)<input id="mf_kaznaPromila" data-k="kaznaPromila" inputmode="decimal" value="${esc(M.kaznaPromila)}"></label>
      <button type="button" class="btn primary" id="regen">Generiraj ugovor iz troškovnika</button>
      <button type="button" class="btn ai" id="aiContract">AI: provjeri i doradi ugovor</button>
      <button type="button" class="btn" id="expUg">Preuzmi za Word (.docx)</button>
    </form>
    <div>
      ${P.contract.edited ? '<div class="warnbar" style="margin-bottom:8px">Ugovor je ručno uređen. Ponovno generiranje zamijenit će tvoje izmjene.</div>' : '<div class="note" style="margin-bottom:8px">Tekst ugovora možeš uređivati izravno, klikom u dokument.</div>'}
      <article class="doc" id="ugDoc" contenteditable="true" spellcheck="true">${P.contract.html}</article>
    </div>
  </div>`;
  $$('#ugForm [data-k]').forEach((inp) => inp.onchange = () => { P.meta[inp.dataset.k] = inp.value; touch(false); if (!P.contract.edited) { P.contract.html = contractHtml(); $('#ugDoc').innerHTML = P.contract.html; } });
  $('#regen').onclick = () => {
    const go = () => { P.contract = { html: contractHtml(), edited: false, at: Date.now() }; touch(); renderUgovor(); toast('Ugovor generiran iz troškovnika.'); };
    P.contract.edited ? confirmModal('Generirati ponovno?', 'Tvoje ručne izmjene teksta ugovora bit će zamijenjene.', 'Generiraj', go) : go();
  };
  $('#aiContract').onclick = () => { openChat(); sendChat('Provjeri ugovor o građenju u ovom projektu: što nedostaje ili je rizično za izvođača i investitora prema hrvatskom pravu? Predloži konkretne izmjene članaka.'); };
  $('#expUg').onclick = () => saveFile(`Ugovor_${safeName(P.name)}.docx`, makeDocx(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ugovor</title></head><body style="font-family:'Times New Roman';font-size:12pt">${P.contract.html}</body></html>`), DOCX_MIME);
  const doc = $('#ugDoc');
  doc.oninput = () => { P.contract.html = doc.innerHTML; if (!P.contract.edited) { P.contract.edited = true; } touch(false); };
}


/* ---------- 3D PRIKAZ ---------- */
let VZ = null, V = null, V3P = null, v3dStage = 5;
const STAGES3D = [
  { n: 'Iskop', ph: ['pripremni', 'iskop'] }, { n: 'Temelji', ph: ['temelji'] }, { n: 'Konstrukcija', ph: ['konstrukcija'] },
  { n: 'Krovište', ph: ['krov'] }, { n: 'Fasada i stolarija', ph: ['fasada', 'instalacije'] }, { n: 'Gotov objekt', ph: ['zavrsni'] },
];
const PARTS3D = {
  iskop: { n: 'Iskop i zemljani radovi', f: (i) => i.group === 'g02' },
  temelji: { n: 'Temelji i podna ploča', f: (i) => i.phase === 'temelji' },
  zidovi: { n: 'Zidovi', f: (i) => i.group === 'g04' },
  konstrukcija: { n: 'AB konstrukcija', f: (i) => i.group === 'g03' && i.phase !== 'temelji' },
  fasada: { n: 'Fasada', f: (i) => i.group === 'g09' || (i.group === 'g04' && /vanjsk/i.test(i.desc)) },
  krov: { n: 'Krovište i pokrov', f: (i) => i.group === 'g06' || i.group === 'g07' },
  limarija: { n: 'Limarija (oluci, opšavi)', f: (i) => i.group === 'g08' },
  stolarija: { n: 'Prozori i vrata', f: (i) => i.group === 'g10' },
  balkon: { n: 'Balkon', f: (i) => /balkon|ograd/i.test(i.desc) },
  okolis: { n: 'Gradilište i okoliš', f: (i) => i.group === 'g01' || i.group === 'g14' },
};
const COLOR_LBL = [['fasada', 'Fasada'], ['cokl', 'Podnožje'], ['krov', 'Krov (crijep)'], ['stolarija', 'Stolarija'], ['limarija', 'Limarija'], ['teren', 'Travnjak']];
function stagePhaseIds(i) { const known = STAGES3D.flatMap((s) => s.ph); return i === STAGES3D.length - 1 ? STAGES3D[i].ph.concat(P.phases.map((p) => p.id).filter((id) => !known.includes(id))) : STAGES3D[i].ph; }
function v3dViews() {
  const m = P.model, out = []; let last = '';
  (m.labels || []).forEach((l, i) => { if (i < m.fp.length && l !== last) out.push([i, l.replace('Pročelje ', '')]); last = l; });
  if (!out.length) m.fp.forEach((_, i) => out.push([i, 'Pročelje ' + (i + 1)]));
  return out.concat([['persp', 'Perspektiva'], ['top', 'Odozgo']]);
}
async function render3D() {
  try { if (!VZ) VZ = await import('./viz3d.js'); }
  catch (e) { console.warn(e); $('#v3dLoad').textContent = '3D prikaz se nije mogao učitati u ovom pregledniku.'; return; }
  if (!P.model) { P.model = P.pdf?.demo ? VZ.demoModel() : VZ.autoModel(P.modelDims || {}); touch(false); }
  if (!V) {
    try { V = await (V3P ||= VZ.Viz3D.create($('#v3dHost'), { onPick: show3dInfo })); }
    catch (e) { console.warn(e); $('#v3dLoad').textContent = 'Ovaj preglednik ne podržava WebGL 3D prikaz.'; return; }
    $('#v3dLoad')?.remove();
  }
  V.resize();
  if (V.model !== P.model) { V.viewed = false; V.stage = v3dStage; V.build(P.model); }
  renderSide3d(); renderStages3d();
}
function renderStages3d() {
  const t = totals(); let cum = 0;
  $('#v3dStages').innerHTML = STAGES3D.map((s, i) => {
    const ids = stagePhaseIds(i), sum = ids.reduce((a, id) => a + (t.byPhase[id] || 0), 0); cum += sum;
    const n = P.items.filter((it) => ids.includes(it.phase)).length;
    return `<button data-st="${i}" class="${i < v3dStage ? 'done' : ''}" aria-current="${i === v3dStage}"><b>${i + 1}. ${esc(s.n)}</b><span>${t.sum ? 'do sada ' + eur(cum) : n + ' stavki'}</span></button>`;
  }).join('');
  $$('#v3dStages [data-st]').forEach((b) => b.onclick = () => { v3dStage = +b.dataset.st; V?.setStage(v3dStage); renderStages3d(); });
}
function renderSide3d() {
  const m = P.model, C = m.colors, auto = m.src === 'auto', d = P.modelDims || {};
  const nOpen = m.openings.length;
  $('#v3dSide').innerHTML = `
  <div><h3>Pogled</h3><div class="viewgrid" style="margin-top:6px">${v3dViews().map(([k, l]) => `<button class="btn small" data-vw="${k}">${esc(l)}</button>`).join('')}</div>
    <p class="note" style="margin-top:6px">Mišem okreći model, kotačićem približi. Klikni dio kuće (krov, fasadu, prozor) i vidjet ćeš njegove stavke iz troškovnika.</p></div>
  <div class="box"><h3>Slike visoke rezolucije</h3>
    <label class="note" for="v3dRes">Rezolucija</label>
    <select id="v3dRes" class="btn"><option value="2560x1440" selected>2560 × 1440 (QHD)</option><option value="3200x1800">3200 × 1800 (najoštrije)</option><option value="1920x1080">1920 × 1080 (Full HD)</option></select>
    <button class="btn primary" id="v3dShot">Spremi trenutni pogled (PNG)</button>
    <button class="btn" id="v3dAll" title="Sprema sva pročelja i perspektivu, sliku po sliku">Spremi sve poglede</button></div>
  <div><h3>Boje</h3><div class="viewgrid" style="margin:6px 0 8px">${VZ.COLOR_PRESETS.map((p, i) => `<button class="btn small" data-pre="${i}" title="${esc(p.n)}">${esc(p.n.split(' (')[0])}</button>`).join('')}</div>
    <div class="swatches">${COLOR_LBL.map(([k, l]) => `<label for="c_${k}"><input type="color" id="c_${k}" data-col="${k}" value="${esc(C[k] || VZ.DEFAULT_COLORS[k])}">${l}</label>`).join('')}</div></div>
  <div class="box"><h3>Model</h3>
    ${auto ? `<p class="note">Okvirni model iz dimenzija. Prozori su raspoređeni okvirno.</p>
      <div class="swatches">${[['W', 'Širina (m)', 10], ['D', 'Dubina (m)', 8], ['floors', 'Etaže', 2], ['storeyH', 'Visina etaže (m)', 2.9], ['pitch', 'Nagib krova (°)', 30], ['ov', 'Prepust (m)', 0.6]].map(([k, l, dv]) => `<label for="md_${k}" style="flex-direction:column;align-items:flex-start;gap:2px">${l}<input class="btn" style="width:100%" id="md_${k}" data-md="${k}" inputmode="decimal" value="${fq(d[k] ?? dv)}"></label>`).join('')}</div>
      <button class="btn" id="v3dApply">Primijeni dimenzije</button>`
    : `<p class="note">Model je složen iz nacrta: tlocrti, presjek 1-1 i pročelja (1:100). Tlocrt ${fq(bboxW(m))} × ${fq(bboxD(m))} m, streha +${fq(m.eave)}, sljeme +${fq(m.ridge)}, ${nOpen} otvora, balkon i nadstrešnica.</p>`}
    <button class="btn small" id="v3dSwitch">${auto && P.pdf?.demo ? 'Vrati model iz nacrta' : 'Okvirni model iz dimenzija'}</button></div>`;
  $$('[data-vw]').forEach((b) => b.onclick = () => V.view(isNaN(+b.dataset.vw) ? b.dataset.vw : +b.dataset.vw));
  $$('[data-pre]').forEach((b) => b.onclick = () => { V.setColors(VZ.COLOR_PRESETS[b.dataset.pre].c); touch(false); renderSide3d(); });
  $$('[data-col]').forEach((inp) => inp.oninput = () => { clearTimeout(inp._t); inp._t = setTimeout(() => { V.setColors({ [inp.dataset.col]: inp.value }); touch(false); }, 30); });
  $('#v3dShot').onclick = () => shot3d(null);
  $('#v3dAll').onclick = () => shotAll3d();
  const ap = $('#v3dApply'); if (ap) ap.onclick = () => { const nd = {}; $$('[data-md]').forEach((i) => { const v = parseNum(i.value); if (v) nd[i.dataset.md] = v; }); P.modelDims = nd; const cols = P.model.colors; P.model = VZ.autoModel(nd); P.model.colors = cols; touch(false); render3D(); };
  $('#v3dSwitch').onclick = () => { const cols = P.model.colors; P.model = (auto && P.pdf?.demo) ? VZ.demoModel() : VZ.autoModel(P.modelDims || {}); P.model.colors = cols; touch(false); render3D(); };
}
function bboxW(m) { const xs = m.fp.map((p) => p[0]); return r2(Math.max(...xs) - Math.min(...xs)); }
function bboxD(m) { const zs = m.fp.map((p) => p[1]); return r2(Math.max(...zs) - Math.min(...zs)); }
function show3dInfo(part) {
  const box = $('#v3dInfo');
  if (!part || !PARTS3D[part]) { box.hidden = true; return; }
  const def = PARTS3D[part], its = P.items.filter(def.f), sum = its.reduce((a, i) => a + (i.qty || 0) * (i.price || 0), 0);
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b>${esc(def.n)}</b><span class="spacer"></span><button class="icon-btn" id="v3dInfoX" aria-label="Zatvori">×</button></div>
  ${its.length ? `<table>${its.map((i) => `<tr><td>${esc(i.desc)} ${i.status === 'ai' ? '<span class="pill ai">AI</span>' : ''}</td><td class="n">${fq(i.qty)} ${esc(i.unit)}</td><td class="n">${i.price ? nf2.format((i.qty || 0) * i.price) + ' €' : '–'}</td></tr>`).join('')}</table>
  <div style="display:flex;justify-content:space-between"><span class="note">${its.length} stavki</span><b>${sum ? eur(sum) + ' bez PDV-a' : 'cijene nisu upisane'}</b></div>` : '<p class="note">U troškovniku još nema stavki za ovaj dio.</p>'}
  <div style="display:flex;gap:6px"><button class="btn small" id="v3dGoT">Otvori u troškovniku</button><button class="btn small ai" id="v3dAskAi">Pitaj AI</button></div>`;
  $('#v3dInfoX').onclick = () => { box.hidden = true; };
  $('#v3dGoT').onclick = () => { filters.q = ''; showView('troskovnik'); };
  $('#v3dAskAi').onclick = () => { openChat(); $('#chatInput').value = `${def.n}: `; $('#chatInput').focus(); };
}
function shotCaption(label) {
  const t = totals();
  return `${P.name}\n${label} · ${t.sum ? 'troškovnik ' + eur(t.total) + ' s PDV-om' : 'prema nacrtima i troškovniku'} · ${new Date().toLocaleDateString('hr-HR')}`;
}
async function shot3d(label) {
  if (!V) return;
  const [w, h] = $('#v3dRes').value.split('x').map(Number);
  setSave('Izrađujem sliku…');
  const blob = await V.snapshot(w, h, shotCaption(label || 'Pogled'));
  setSave('Slika je spremna');
  await saveFile(`3D_${safeName(P.name)}_${safeName(label || 'pogled')}.png`, blob, 'image/png');
}
async function shotAll3d() {
  for (const [k, l] of v3dViews().filter(([k]) => k !== 'top')) { V.view(isNaN(+k) ? k : +k); await new Promise((r) => setTimeout(r, 900)); await shot3d(l); }
}

/* ---------- AI asistent ---------- */
const CHIPS = [
  { t: 'Predloži količine s nacrta', strong: true, run: () => aiFromPage() },
  { t: 'Dodaj stavku…', fill: 'Dodaj stavku: ' },
  { t: 'Promijeni količinu…', fill: 'Promijeni količinu stavke ' },
  { t: 'Dodaj fazu…', fill: 'Dodaj fazu gradnje: ' },
  { t: 'Što nedostaje u troškovniku?', send: 'Pregledaj troškovnik za ovu građevinu i reci koje stavke nedostaju od iskopa do fasade. Dodaj ih kao AI prijedloge s obrazloženjem količine.' },
  { t: 'Procijeni cijene', send: 'Za stavke bez cijene upiši okvirne jedinične cijene u EUR bez PDV-a za Zagreb 2026. Označi ih kao AI procjenu i reci koliko su pouzdane.' },
  { t: 'Prikaži 3D', run: () => showView('3d') },
  { t: 'Napravi ugovor', run: () => { P.contract = null; showView('ugovor'); addMsg('assistant', 'Ugovor je generiran iz troškovnika (kartica Ugovor). Upiši podatke stranaka lijevo, a ja ga mogu provjeriti ako klikneš „AI: provjeri i doradi ugovor”.'); } },
];
function openChat() { $('#chat').classList.remove('hidden'); try { localStorage.setItem('gp.chat', '1'); } catch {} }
function addMsg(role, content, extra = {}) { P.chat.push({ role, content, ...extra }); if (P.chat.length > 60) P.chat = P.chat.slice(-60); touch(false); renderChat(); }
function renderChat() {
  const box = $('#msgs');
  box.innerHTML = P.chat.map((m, i) => `<div class="msg ${m.role}" data-i="${i}">${esc(m.content)}${m.log?.length ? `<div class="acts-log">${m.log.map(esc).join('<br>')}</div>` : ''}</div>`).join('');
  box.scrollTop = box.scrollHeight;
  $('#chips').innerHTML = CHIPS.map((c, i) => `<button class="chip ${c.strong ? 'strong' : ''}" data-c="${i}">${esc(c.t)}</button>`).join('');
  $$('#chips [data-c]').forEach((b) => b.onclick = () => {
    const c = CHIPS[b.dataset.c];
    if (c.run) return c.run();
    if (c.send) return sendChat(c.send);
    const ta = $('#chatInput'); ta.value = c.fill; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  $('#undoAi').disabled = !undoStack.length;
}
function itemsForAi() {
  const rb = rbMap();
  return P.items.map((i) => ({ id: i.id, rb: rb[i.id], grupa: groupOf(i.group).n, opis: i.desc, jed: i.unit, kolicina: i.qty, cijena: i.price, faza: i.phase, status: i.status }));
}
function systemPrompt() {
  const t = totals();
  return `Ti si AI asistent u građevinskom programu za izradu troškovnika i ugovora (Hrvatska, EU). Korisnik je ${role === 'izvodjac' ? 'IZVOĐAČ radova (upisuje jedinične cijene, radi ponudu i ugovor)' : 'PROJEKTANT (radi opise stavki i količine, projektantski troškovnik)'}.
Odgovaraj kratko, na hrvatskom. Kad korisnik traži promjenu troškovnika (dodaj, promijeni, obriši, cijena, faza), ODMAH je napravi alatima, a u odgovoru kratko reci što si napravio. Sve što ti dodaš ili promijeniš ostaje označeno kao AI prijedlog dok korisnik ne potvrdi.
Pravila: količine računaj iz podataka s nacrta (kote, površine, sastavi slojeva) i UVIJEK upiši obrazloženje izračuna u polje "obrazlozenje". Ako podatak ne možeš pouzdano odrediti, upiši količinu 0 i u obrazloženju reci kako je izmjeriti. Ne izmišljaj: jasno razlikuj izračun od procjene. Cijene su u EUR bez PDV-a (PDV 25 %). Ne obećavaj pravnu valjanost ugovora.
Vrste radova (grupa): ${GROUPS.map((g) => g.id + ' = ' + g.n).join('; ')}.
Faze: ${P.phases.map((p) => p.id + ' = ' + p.n).join('; ')}.
Projekt: "${P.name}". Građevina: ${P.meta.gradjevina || 'nije upisano'}. Lokacija: ${P.meta.lokacija || 'nije upisano'}.
Trenutno: ${P.items.length} stavki, ${t.ai} čeka potvrdu, ukupno bez PDV-a ${eur(t.sum)}. Otvorena kartica: ${view}${pdfDoc ? `, nacrt stranica ${curPage}/${pdfDoc.numPages} "${pageInfo[curPage]?.title}"` : ', nema nacrta'}.`;
}
let aiLog = [];
function aiTools() {
  const findItem = (id) => P.items.find((i) => i.id === id);
  return [
    { name: 'popis_stavki', description: 'Vrati sve stavke troškovnika (id, rb, grupa, opis, jedinica, količina, cijena, faza, status).', inputSchema: { type: 'object', properties: {} }, execute: () => itemsForAi() },
    { name: 'dodaj_stavke', description: 'Dodaj jednu ili više stavki u troškovnik. Svaka stavka postaje AI prijedlog.', inputSchema: { type: 'object', properties: { stavke: { type: 'array', items: { type: 'object', properties: { grupa: { type: 'string', description: 'id grupe, npr. g04' }, opis: { type: 'string' }, jed: { type: 'string', description: 'm, m², m³, kom, kg, kompl, paušal' }, kolicina: { type: 'number' }, cijena: { type: 'number', description: 'neobavezno, EUR bez PDV-a' }, faza: { type: 'string' }, obrazlozenje: { type: 'string' } }, required: ['grupa', 'opis', 'jed', 'kolicina', 'obrazlozenje'] } } }, required: ['stavke'] },
      execute: ({ stavke }) => { const ids = []; for (const s of stavke || []) { const g = GROUPS.some((x) => x.id === s.grupa) ? s.grupa : 'g14'; const it = { id: uid(), group: g, desc: s.opis, unit: s.jed || 'kom', qty: Number(s.kolicina) || 0, price: s.cijena ?? null, priceSrc: s.cijena != null ? 'ai' : null, phase: P.phases.some((p) => p.id === s.faza) ? s.faza : groupOf(g).ph, status: 'ai', qtyMode: 'manual', basis: s.obrazlozenje || '' }; P.items.push(it); ids.push(it.id); aiLog.push('+ ' + it.desc.slice(0, 60) + ': ' + fq(it.qty) + ' ' + it.unit); } touch(); return { dodano: ids.length, ids }; } },
    { name: 'promijeni_stavku', description: 'Promijeni postojeću stavku po id-u. Pošalji samo polja koja mijenjaš.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, opis: { type: 'string' }, jed: { type: 'string' }, kolicina: { type: 'number' }, cijena: { type: 'number' }, faza: { type: 'string' }, grupa: { type: 'string' }, obrazlozenje: { type: 'string' } }, required: ['id'] },
      execute: (a) => { const it = findItem(a.id); if (!it) throw new Error('Nema stavke s tim id-em'); const ch = []; if (a.opis) { it.desc = a.opis; ch.push('opis'); } if (a.jed) { it.unit = a.jed; ch.push('jedinica'); } if (a.kolicina != null) { it.qty = Number(a.kolicina); it.qtyMode = 'manual'; it.status = 'ai'; ch.push('količina ' + fq(it.qty)); } if (a.cijena != null) { it.price = Number(a.cijena); it.priceSrc = 'ai'; ch.push('cijena ' + fp(it.price)); } if (a.faza && P.phases.some((p) => p.id === a.faza)) { it.phase = a.faza; ch.push('faza'); } if (a.grupa && GROUPS.some((g) => g.id === a.grupa)) { it.group = a.grupa; ch.push('grupa'); } if (a.obrazlozenje) it.basis = a.obrazlozenje; aiLog.push('~ ' + it.desc.slice(0, 50) + ': ' + ch.join(', ')); touch(); return { ok: true }; } },
    { name: 'obrisi_stavke', description: 'Obriši stavke po id-u (samo kad korisnik to jasno traži).', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
      execute: ({ ids }) => { const del = P.items.filter((i) => ids.includes(i.id)); P.items = P.items.filter((i) => !ids.includes(i.id)); del.forEach((d) => aiLog.push('− ' + d.desc.slice(0, 60))); touch(); return { obrisano: del.length }; } },
    { name: 'upisi_cijene', description: 'Upiši jedinične cijene (EUR bez PDV-a) za više stavki odjednom. Označene su kao AI procjena.', inputSchema: { type: 'object', properties: { cijene: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, cijena: { type: 'number' } }, required: ['id', 'cijena'] } } }, required: ['cijene'] },
      execute: ({ cijene }) => { let n = 0; for (const c of cijene || []) { const it = findItem(c.id); if (it) { it.price = Number(c.cijena); it.priceSrc = 'ai'; n++; } } aiLog.push('€ cijene upisane za ' + n + ' stavki (AI procjena)'); touch(); return { upisano: n }; } },
    { name: 'dodaj_fazu', description: 'Dodaj novu fazu gradnje.', inputSchema: { type: 'object', properties: { naziv: { type: 'string' } }, required: ['naziv'] },
      execute: ({ naziv }) => { const id = 'f_' + uid().slice(0, 5); P.phases.push({ id, n: naziv }); aiLog.push('+ faza: ' + naziv); touch(); return { id }; } },
    { name: 'tekst_nacrta', description: 'Vrati tekst s jedne stranice nacrta (kote, nazivi prostorija, površine, slojevi). Bez argumenta: trenutna stranica.', inputSchema: { type: 'object', properties: { stranica: { type: 'number' } } },
      execute: ({ stranica } = {}) => { if (!pdfDoc) return { greska: 'Nema učitanog nacrta' }; const p = stranica || curPage; const inf = pageInfo[p]; if (!inf) return { greska: 'Nema te stranice' }; return { stranica: p, naziv: inf.title, mjerilo: inf.ratio ? '1:' + inf.ratio : null, tekst: inf.text.slice(0, 6000) }; } },
    { name: 'popis_nacrta', description: 'Popis stranica nacrta s nazivom i mjerilom.', inputSchema: { type: 'object', properties: {} }, execute: () => pdfDoc ? Object.entries(pageInfo).map(([k, v]) => ({ stranica: Number(k), naziv: v.title, mjerilo: v.ratio ? '1:' + v.ratio : null })) : [] },
    { name: 'podaci_projekta', description: 'Upiši podatke projekta za ugovor (investitor, izvođač, OIB, adrese, lokacija, građevina, rok u danima, jamstva).', inputSchema: { type: 'object', properties: { investitor: { type: 'string' }, investitorOib: { type: 'string' }, investitorAdr: { type: 'string' }, izvodjac: { type: 'string' }, izvodjacOib: { type: 'string' }, izvodjacAdr: { type: 'string' }, gradjevina: { type: 'string' }, lokacija: { type: 'string' }, nadzor: { type: 'string' }, trajanjeDana: { type: 'number' } } },
      execute: (a) => { Object.entries(a || {}).forEach(([k, v]) => { if (k in P.meta) P.meta[k] = v; }); if (P.contract && !P.contract.edited) P.contract.html = contractHtml(); aiLog.push('✎ podaci projekta: ' + Object.keys(a || {}).join(', ')); touch(); return { ok: true }; } },
    { name: 'model_3d', description: 'Promijeni 3D prikaz objekta: boje (hex, npr. #d9d8d4) za fasada, cokl, krov, stolarija, limarija, teren; ili okvirne dimenzije (sirina, dubina, etaze, visinaEtaze, nagib) za okvirni model.', inputSchema: { type: 'object', properties: { boje: { type: 'object', properties: { fasada: { type: 'string' }, cokl: { type: 'string' }, krov: { type: 'string' }, stolarija: { type: 'string' }, limarija: { type: 'string' }, teren: { type: 'string' } } }, dimenzije: { type: 'object', properties: { sirina: { type: 'number' }, dubina: { type: 'number' }, etaze: { type: 'number' }, visinaEtaze: { type: 'number' }, nagib: { type: 'number' } } } } },
      execute: async (a = {}) => { if (!VZ) VZ = await import('./viz3d.js'); if (!P.model) P.model = P.pdf?.demo ? VZ.demoModel() : VZ.autoModel(P.modelDims || {});
        if (a.dimenzije) { const d = a.dimenzije; P.modelDims = { W: d.sirina, D: d.dubina, floors: d.etaze, storeyH: d.visinaEtaze, pitch: d.nagib }; Object.keys(P.modelDims).forEach((k) => P.modelDims[k] == null && delete P.modelDims[k]); const cols = P.model.colors; P.model = VZ.autoModel(P.modelDims); P.model.colors = cols; aiLog.push('3D: okvirni model ' + JSON.stringify(P.modelDims)); }
        if (a.boje) { Object.entries(a.boje).forEach(([k, v]) => { if (/^#[0-9a-f]{6}$/i.test(v)) P.model.colors[k] = v; }); aiLog.push('3D: boje ' + Object.keys(a.boje).join(', ')); }
        touch(); if (V) { if (V.model !== P.model) V.build(P.model); else V.setColors({}); if (view === '3d') renderSide3d(); } return { ok: true, boje: P.model.colors }; } },
    { name: 'tekst_ugovora', description: 'Vrati trenutni tekst ugovora (HTML).', inputSchema: { type: 'object', properties: {} }, execute: () => ({ html: (P.contract?.html || contractHtml()).slice(0, 12000) }) },
    { name: 'zamijeni_ugovor', description: 'Zamijeni tekst ugovora novim HTML-om (samo kad korisnik traži izmjenu ugovora). Koristi <h2>, <h4>, <p>, <table>.', inputSchema: { type: 'object', properties: { html: { type: 'string' } }, required: ['html'] },
      execute: ({ html }) => { const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, ''); P.contract = { html: clean, edited: true, at: Date.now() }; aiLog.push('✎ ugovor izmijenjen (AI) – pregledaj karticu Ugovor'); touch(); return { ok: true }; } },
  ];
}
let busy = false, abortCtl = null;
async function sendChat(text, opts = {}) {
  text = (text || '').trim();
  if (!text || busy) return;
  if (!cap.sample) { addMsg('user', text); addMsg('sys', 'AI asistent ovdje nije dostupan (otvori program na claude.ai i dopusti mu korištenje Claudea). Sve možeš napraviti i ručno.'); return; }
  openChat();
  P.chat.push({ role: 'user', content: text + (opts.imageNote ? '\n[' + opts.imageNote + ']' : '') });
  const reply = { role: 'assistant', content: '…', log: [] };
  P.chat.push(reply); renderChat();
  undoStack.push(JSON.stringify({ items: P.items, phases: P.phases, meta: P.meta, contract: P.contract }));
  if (undoStack.length > 15) undoStack.shift();
  busy = true; aiLog = []; $('#sendBtn').disabled = true; $('#aiState').textContent = 'radi…';
  const hist = P.chat.slice(0, -1).filter((m) => m.role === 'user' || m.role === 'assistant').slice(-14);
  const msgs = [{ role: 'user', content: systemPrompt() + '\n\n(Kontekst sustava. Odgovori „U redu.”)' }, { role: 'assistant', content: 'U redu.' }];
  for (const m of hist) { const last = msgs[msgs.length - 1]; const c = m.content + (m.log?.length ? '\n[Napravljeno: ' + m.log.join('; ') + ']' : ''); if (last.role === m.role) last.content += '\n' + c; else msgs.push({ role: m.role, content: c }); }
  if (msgs[msgs.length - 1].role !== 'user') msgs.push({ role: 'user', content: text });
  abortCtl = new AbortController();
  const o = { tools: aiTools(), signal: abortCtl.signal, cache: false, onText: ({ text: tx }) => { reply.content = tx || '…'; const el = $(`#msgs [data-i="${P.chat.indexOf(reply)}"]`); if (el) { el.firstChild ? (el.firstChild.textContent = reply.content) : (el.textContent = reply.content); $('#msgs').scrollTop = 1e9; } } };
  if (opts.images) o.images = opts.images;
  if (opts.complex) o.modelTier = 'complex';
  try {
    const r = await cap.sample(msgs, o);
    reply.content = (r.text || '').trim() || 'Gotovo.';
  } catch (e) {
    if (e?.code === 'not_granted') { reply.content = 'AI asistent nije dopušten u ovom prikazu. Sve možeš napraviti ručno.'; cap.sample = null; }
    else if (e?.code === 'rate_limited') reply.content = 'Previše zahtjeva u kratkom vremenu. Pokušaj za minutu.';
    else reply.content = (e?.text ? e.text + '\n\n' : '') + 'Došlo je do greške: ' + (e?.message || e);
  }
  reply.log = aiLog.slice();
  if (!aiLog.length) undoStack.pop();
  busy = false; $('#sendBtn').disabled = false; $('#aiState').textContent = '';
  touch(); renderChat();
  if (aiLog.length) { renderCounts(); if (view === 'troskovnik') renderTroskovnik(); if (view === 'ugovor') renderUgovor(); if (view === 'nacrt') renderMPanel(); }
}
async function aiFromPage() {
  if (!pdfDoc) return toast('Prvo učitaj nacrt.');
  openChat();
  const inf = pageInfo[curPage];
  let images;
  if (cap.imagesOk) { try { images = [await pageImageBlob(curPage)]; } catch (e) { console.warn(e); } }
  const prompt = `Pročitaj nacrt na stranici ${curPage} („${inf.title}”, mjerilo ${inf.ratio ? '1:' + inf.ratio : 'nepoznato'}). ${images ? 'Slika stranice je priložena.' : ''} Tekst sa stranice dobiješ alatom tekst_nacrta, a ostale stranice (presjek sa slojevima, druge etaže) alatom popis_nacrta i tekst_nacrta.
Prvo pogledaj popis_stavki da ne dupliciraš postojeće. Zatim dodaj nove stavke (od iskopa do fasade) koje se mogu izračunati s ovog nacrta, s količinom i obrazloženjem izračuna. Ako postojeća AI stavka ima bolju količinu iz ovog nacrta, ispravi je. Na kraju u 3–4 rečenice reci što si dodao i što korisnik treba izmjeriti ručno.`;
  await sendChat(prompt, { images, imageNote: images ? 'priložena slika stranice ' + curPage : '', complex: true });
}
function setupChat() {
  const ta = $('#chatInput');
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = ta.value; ta.value = ''; sendChat(v); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
  $('#sendBtn').onclick = () => { const v = ta.value; ta.value = ''; sendChat(v); };
  $('#chatClose').onclick = () => { $('#chat').classList.add('hidden'); try { localStorage.setItem('gp.chat', '0'); } catch {} };
  $('#chatToggle').onclick = () => { const h = $('#chat').classList.toggle('hidden'); try { localStorage.setItem('gp.chat', h ? '0' : '1'); } catch {} };
  $('#undoAi').onclick = () => {
    const s = undoStack.pop(); if (!s) return;
    const o = JSON.parse(s); P.items = o.items; P.phases = o.phases; P.meta = o.meta; P.contract = o.contract;
    addMsg('sys', 'Vraćeno stanje prije zadnje AI promjene.'); touch(); renderAll();
  };
  try { if (localStorage.getItem('gp.chat') === '0' || window.innerWidth < 1100) $('#chat').classList.add('hidden'); } catch {}
}
let dictOn = false, dictBase = '';
function setupDictation() {
  const btn = $('#micBtn'), ta = $('#chatInput');
  if (!cap.dict) { btn.hidden = true; return; }
  btn.hidden = false;
  cap.dict.onPartial(({ text }) => { ta.value = (dictBase + ' ' + text).trim(); });
  cap.dict.onFinal(({ text }) => { dictBase = (dictBase + ' ' + text).trim(); ta.value = dictBase; });
  cap.dict.onState(({ state }) => { dictOn = state === 'listening'; btn.classList.toggle('on', dictOn); btn.setAttribute('aria-label', dictOn ? 'Zaustavi govor' : 'Govori'); });
  btn.onclick = () => {
    if (dictOn) { cap.dict.stop().catch(() => {}); return; }
    dictBase = ta.value.trim();
    cap.dict.start().catch((e) => { if (e?.code === 'not_granted') { btn.hidden = true; toast('Mikrofon nije dopušten. Možeš pisati.'); } });
  };
}

/* ---------- projekti, uloge, prikazi ---------- */
function renderCounts() {
  const t = totals();
  const c = $('#aiCount'); c.hidden = !t.ai; c.textContent = t.ai;
  $('#projName').textContent = P.name;
}
function showView(v) {
  view = v; cancelDraw();
  $$('.tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'nacrt') renderNacrt(); if (v === '3d') render3D(); if (v === 'troskovnik') renderTroskovnik(); if (v === 'ugovor') renderUgovor();
}
function setRole(r) {
  role = r; try { localStorage.setItem('gp.role', r); } catch {}
  $('#roleP').setAttribute('aria-pressed', String(r === 'projektant')); $('#roleI').setAttribute('aria-pressed', String(r === 'izvodjac'));
  if (view === 'troskovnik') renderTroskovnik(); if (view === 'ugovor') renderUgovor();
}
function renderAll() { renderCounts(); renderChat(); showView(view); }
function projMenu() {
  const m = $('#projMenu'), b = $('#projBtn').getBoundingClientRect();
  m.style.left = b.left + 'px'; m.style.top = (b.bottom + 4) + 'px';
  m.innerHTML = projectsIndex.map((p) => `<button data-p="${p.id}">${p.id === P.id ? '● ' : ''}${esc(p.name)}</button>`).join('') + `<hr><button id="pmNew">+ Novi projekt</button><button id="pmRen">Preimenuj projekt</button><button id="pmDemo">Otvori primjer s nacrtima</button>`;
  m.classList.add('open');
  $$('[data-p]', m).forEach((x) => x.onclick = () => { m.classList.remove('open'); if (x.dataset.p !== P.id) openProject(x.dataset.p); });
  $('#pmNew', m).onclick = () => { m.classList.remove('open'); nameModal('Novi projekt', '', async (n) => { await saveNow(); P = newProject(n, false); pdfDoc = null; pageInfo = {}; undoStack = []; touch(); await saveNow(); renderAll(); showView('nacrt'); }); };
  $('#pmRen', m).onclick = () => { m.classList.remove('open'); nameModal('Preimenuj projekt', P.name, (n) => { P.name = n; touch(); renderCounts(); }); };
  $('#pmDemo', m).onclick = async () => { m.classList.remove('open'); await saveNow(); P = newProject('Primjer: obiteljska kuća P+1', true); undoStack = []; touch(); await loadPdfForProject(); await saveNow(); renderAll(); };
}
function nameModal(title, val, ok) {
  openModal(`<h3>${esc(title)}</h3><label for="nmIn">Naziv</label><input id="nmIn" value="${esc(val)}"><div class="btns"><button class="btn" id="mNo">Odustani</button><button class="btn primary" id="mOk">Spremi</button></div>`, (m) => {
    $('#mNo', m).onclick = closeModal;
    const go = () => { const v = $('#nmIn', m).value.trim(); if (!v) return; closeModal(); ok(v); };
    $('#mOk', m).onclick = go; $('#nmIn', m).onkeydown = (e) => { if (e.key === 'Enter') go(); };
  });
}
async function onPdfFile(file) {
  if (!file) return;
  const buf = await file.arrayBuffer();
  let stored = null;
  if (cap.assets) { try { setSave('Spremam nacrt…'); stored = await cap.assets.upload(new Blob([buf], { type: 'application/pdf' })); } catch (e) { console.warn(e); } }
  if (stored) P.pdf = { url: stored.url, assetId: stored.id, name: file.name };
  else { sessionPdf[P.id] = buf.slice(0); P.pdf = { name: file.name, session: true }; toast('Nacrt je otvoren, ali nije spremljen: sljedeći put ga učitaj ponovno.', 4000); }
  P.pageScale = {}; P.meas = [];
  if (!stored) pdfDoc = await pdfjsLib.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise;
  else await loadPdfForProject();
  if (!stored) await analyzeAllPages();
  curPage = 1; zoom = 0; touch(); showView('nacrt');
  addMsg('assistant', `Učitan je nacrt „${file.name}” (${pdfDoc.numPages} str.). ${Object.keys(P.pageScale).length ? 'Mjerilo sam pročitao iz zaglavlja.' : 'Mjerilo nisam našao: postavi ga alatom Mjerilo.'} Klikni „Predloži količine s nacrta” i predložit ću stavke za odabranu stranicu.`);
}
async function onJsonFile(file) {
  if (!file) return;
  try {
    const p = JSON.parse(await file.text());
    if (!p.items || !p.meta) throw new Error('format');
    await saveNow(); P = p; P.id = uid(); P.name = (p.name || 'Uvezeni projekt') + ' (uvoz)'; migrate(P); undoStack = []; touch(); await loadPdfForProject(); await saveNow(); renderAll(); toast('Projekt uvezen.');
  } catch { toast('Datoteka nije projekt ovog programa.'); }
}

/* ---------- pokretanje ---------- */
async function initCaps() {
  if (!window.claude?.use) return;
  const [db, user, sample, dict, dl, assets] = await Promise.all(['db', 'user', 'sample', 'dictation', 'downloads', 'assets'].map((n) => window.claude.use(n).catch(() => null)));
  Object.assign(cap, { db, user, sample, dict, dl, assets });
  if (user) { try { cap.uid = await user.id(); } catch {} }
  if (!cap.uid) cap.db = null;
  if (sample) { try { cap.imagesOk = !!(await sample.limits())?.images; } catch {} } else $('#aiState').textContent = 'nije dostupan';
  setupDictation();
}
async function boot() {
  $$('.tabs [data-view]').forEach((b) => b.onclick = () => showView(b.dataset.view));
  $('#roleP').onclick = () => setRole('projektant'); $('#roleI').onclick = () => setRole('izvodjac');
  $('#projBtn').onclick = (e) => { e.stopPropagation(); $('#projMenu').classList.contains('open') ? $('#projMenu').classList.remove('open') : projMenu(); };
  document.addEventListener('click', (e) => { if (!$('#projMenu').contains(e.target)) $('#projMenu').classList.remove('open'); });
  $('#modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modalBg').classList.contains('open')) closeModal(); });
  $('#pdfFile').onchange = (e) => { onPdfFile(e.target.files[0]); e.target.value = ''; };
  $('#jsonFile').onchange = (e) => { onJsonFile(e.target.files[0]); e.target.value = ''; };
  let lastDpr = window.devicePixelRatio;
  window.addEventListener('resize', () => { if (window.devicePixelRatio !== lastDpr) { lastDpr = window.devicePixelRatio; thumbsKey = ''; if (view === 'nacrt') renderNacrt(); V?.syncDpr(); } });
  setupStage(); setupChat(); setRole(role); setTool('pan');
  // prvi prikaz: primjer odmah, dok se ne učita spremljeno
  setSave('Učitavam…');
  renderAll();
  loadPdfForProject().then(() => { if (view === 'nacrt') renderNacrt(); });
  const timeout = new Promise((r) => setTimeout(r, 10000));
  await Promise.race([initCaps(), timeout]);
  try {
    await loadProjectsList();
    let last = null; try { last = localStorage.getItem('gp.last'); } catch {}
    const pick = projectsIndex.find((p) => p.id === last) || projectsIndex[0];
    if (pick) await openProject(pick.id);
    else { await saveNow(); }
  } catch (e) { console.warn(e); setSave(cap.db ? 'Spremanje u oblak nije dostupno' : 'Nije spremljeno'); }
}
boot();
