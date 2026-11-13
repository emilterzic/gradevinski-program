// Građevinski program – prototip v0.17
// Nacrt (PDF + mjerenje) → stavke (AI prijedlog / ručno / izmjereno / potvrđeno) → troškovnik → ugovor, uz AI asistenta.
import * as pdfjsLib from './lib/pdf.min.js';
import * as MD from './model.js'; // model objekta, opcije izvedbe s okvirnim cijenama, količine, informativna statika
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.js', import.meta.url).href;

const DEMO_PDF_URL = '/_blob/bae2a8cc1f83b4982451d63eb012771a';
const DEMO_NAME = 'Primjer nacrta: obiteljska kuća P+1.pdf';
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
function slotToItem(g) { return { id: uid(), group: g.group, desc: g.desc, unit: g.unit, qty: g.qty, price: g.price, priceSrc: g.price != null ? 'kat' : null, phase: g.phase, status: 'ai', qtyMode: 'manual', basis: g.basis, slot: g.slot, key: g.key, opt: g.opt }; }
function demoItems() {
  // K = okvirna tržišna cijena iz kataloga (čeka potvrdu kao i svaki AI prijedlog)
  const A = (group, desc, unit, qty, basis, phase, K, tag) => ({ id: uid(), group, desc, unit, qty, price: K ?? null, priceSrc: K != null ? 'kat' : null, phase: phase || groupOf(group).ph, status: 'ai', qtyMode: 'manual', basis, ...(tag || {}) });
  const hand = [
    A('g01', 'Uređenje gradilišta: ograda, gradilišna ploča, priključci vode i struje, sanitarni čvor', 'paušal', 1, 'Standardna stavka za svako gradilište.'),
    A('g01', 'Iskolčenje građevine od ovlaštenog geodeta', 'paušal', 1, 'Obvezno prije početka radova.'),
    A('g02', 'Strojni iskop humusa d=30 cm s odlaganjem na gradilištu', 'm²', 96.75, 'Tlocrt 8,75 × 7,00 m (str. 1) + 1 m radnog prostora sa svake strane: 10,75 × 9,00 m = 96,75 m².', 'iskop', MD.PRICE.humus),
    A('g02', 'Nasip i nabijanje šljunka ispod podne ploče d=20 cm', 'm³', 11.55, 'Sloj P1 (str. 6): nabijeni šljunak 20 cm × GBP prizemlja 57,74 m².', 'temelji', MD.PRICE.sljunak),
    A('g03', 'Armatura B500B, dobava, savijanje i postava', 'kg', 0, '', null, MD.PRICE.armatura, { slot: 'arm', key: 'armatura' }),
    A('g04', 'Zidanje pregradnih zidova blok opekom d=10–15 cm', 'm²', 130.0, 'Procjena ≈ 25 m pregradnih zidova po etaži × 2,60 m; provjeriti mjerenjem na tlocrtima.'),
    A('g04', 'Unutarnja vapneno-cementna žbuka zidova', 'm²', 419.0, 'Unutarnja strana vanjskih zidova 159 m² + obje strane pregradnih 2 × 130 m².', 'zavrsni'),
    A('g04', 'Unutarnja žbuka stropova', 'm²', 84.77, 'Neto površine prizemlja 40,41 + kata 44,36 m² (str. 1 i 2).', 'zavrsni'),
    A('g05', 'Hidroizolacija podne ploče bitumenskom trakom s uloškom poliesterskog filca', 'm²', 63.51, 'Sloj P1: 57,74 m² + 10 % preklopi i podizanje uz zid.', 'temelji', MD.PRICE.hidro),
    A('g05', 'Toplinska izolacija poda prema tlu XPS d=10 cm', 'm²', 40.41, 'Sloj P1 × neto površina prizemlja 40,41 m².'),
    A('g05', 'Toplinska izolacija EPS100 d=6 cm za podno grijanje', 'm²', 82.97, 'Slojevi P1 i MK: neto 84,77 m² − balkon 1,80 m².'),
    A('g05', 'Toplinska izolacija poda tavana kamenom vunom d=18 cm', 'm²', 42.56, 'Sloj M1: neto kat 44,36 − balkon 1,80 m².'),
    A('g10', 'Unutarnja vrata s dovratnikom', 'kom', 0, 'Prebroj alatom Komad na tlocrtima.'),
    A('g11', 'Cementni estrih d=6 cm', 'm²', 82.97, 'Slojevi P1 i MK: neto 84,77 − balkon 1,80 m².'),
    A('g11', 'Keramičke pločice na pod (ulaz, kuhinja, hodnik, kotlovnica, kupaonice)', 'm²', 23.14, 'Prizemlje 3,19 + 6,04 + 2,69 + 2,04 + 4,11; kat kupaonica i vešeraj 5,07 m².'),
    A('g11', 'Parket hrast, lijepljeni', 'm²', 59.83, 'Blagovaonica 7,08 + dnevni boravak 15,26 + sobe 8,77 + 12,41 + 9,01 + predsoblje 3,82 + stubište 3,48 m².'),
    A('g12', 'Gletanje i bojanje zidova i stropova disperzivnom bojom', 'm²', 501.97, 'Žbuka zidova 419 m² + stropova 82,97 m².'),
    A('g13', 'Vodovod i odvodnja prema projektu instalacija', 'kompl', 1, 'Prema strojarskom projektu.'),
    A('g13', 'Elektroinstalacije prema projektu', 'kompl', 1, 'Prema elektrotehničkom projektu.'),
    A('g13', 'Podno grijanje s razdjelnicima', 'm²', 82.97, 'Slojevi P1 i MK predviđaju podno grijanje.'),
  ];
  // stavke koje ovise o izvedbi (iskop, temelji, zidovi, krov, fasada, stolarija) računaju se iz 3D modela složenog iz nacrta
  const gen = MD.buildItems(MD.demoModel(), MD.DEFAULT_BUILD).map(slotToItem);
  const ph = PHASES.map((x) => x.id), gi = GROUPS.map((x) => x.id);
  const all = hand.concat(gen).map((it, i) => [it, i]).sort((x, y) => gi.indexOf(x[0].group) - gi.indexOf(y[0].group) || ph.indexOf(x[0].phase) - ph.indexOf(y[0].phase) || x[1] - y[1]).map((x) => x[0]);
  syncArmatura(all);
  return all;
}
// armatura prati količinu betona (procjena 100 kg/m³ dok nema statičkog proračuna), osim ako ju je korisnik upisao sam
function syncArmatura(items) {
  const it = items.find((i) => i.key === 'armatura' && i.slot === 'arm');
  if (!it || it.status === 'rucno' || it.status === 'mjereno' || it.qtyMode === 'meas') return;
  const bet = items.filter((i) => i.group === 'g03' && i.unit === 'm³').reduce((s, i) => s + (i.qty || 0), 0), q = Math.round(bet * MD.ARM_KG);
  if (q !== it.qty) { it.qty = q; if (it.status === 'ok') it.status = 'ai'; }
  it.basis = `Približno ${MD.ARM_KG} kg/m³ × ${fq(r2(bet))} m³ betona (procjena dok nema statičkog proračuna).`;
}
function newProject(name, demo) {
  return linkDoc({
    v: 1, id: uid(), name: name || 'Novi projekt', createdAt: Date.now(), updatedAt: Date.now(),
    meta: { gradjevina: demo ? 'Stambena zgrada s jednim stanom i garažom (P+1)' : '', lokacija: '', investitor: '', investitorOib: '', investitorAdr: '', izvodjac: '', izvodjacOib: '', izvodjacAdr: '', projektant: '', nadzor: '', pocetak: '', trajanjeDana: 180, jamstvoIzvrsenje: 10, jamstvoNedostaci: 5, jamstveniRokGod: 2, kaznaPromila: 1, mjesto: 'Zagreb' },
    pdf: demo ? { url: DEMO_PDF_URL, name: 'Primjer: nacrti obiteljske kuće (10 str.)', demo: true } : null,
    pageScale: {}, // page -> {mPerPt, src} aktivnog dokumenta (isti objekt kao docs[].pageScale)
    docs: demo ? [{ id: 'demo', name: DEMO_NAME, url: DEMO_PDF_URL, demo: true, pageScale: {} }] : [], docId: demo ? 'demo' : null,
    phases: PHASES.map((p) => ({ ...p })),
    items: demo ? demoItems() : [],
    build: { ...MD.DEFAULT_BUILD }, buildLinked: !!demo, model: demo ? MD.demoModel() : null, modelType: demo ? 'nacrt' : null, mig: 7,
    meas: [],
    contract: null,
    chat: demo ? [{ role: 'assistant', content: 'Pozdrav! Pročitao sam primjer nacrta (tlocrti 1:100, presjek sa slojevima, neto površine) i predložio stavke s količinama i okvirnim cijenama. Svaka ima obrazloženje izračuna. Žute su AI prijedlozi: potvrdi ih, ispravi ručno ili izmjeri na nacrtu.\n\nU kartici 3D prikaz → Izvedba biraš temelje, konstrukciju (opeka ili armirani beton), oblik krova, fasadu i stolariju: 3D model i troškovnik se odmah usklade.\n\nMožeš mi pisati ili govoriti, npr. „dodaj stavku ograde balkona 7 m” ili „povećaj fasadu na 180 m²”.' }] : [],
  });
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
  const mig0 = P.mig; migrate(P);
  undoStack = [];
  try { localStorage.setItem('gp.last', P.id); } catch {}
  setSave(cap.db ? 'Spremljeno u oblak' : 'Spremljeno u ovom pregledniku');
  await loadPdfForProject();
  if (P.mig !== mig0) { if (P.relink) { delete P.relink; if (P.buildLinked && P.model) applySlots(MD.ALL_SLOTS); if (P.modelSpec) aiReadLog({ ok: true, msg: 'migracija: ' + (P.chat[P.chat.length - 1]?.content || '').slice(0, 600), parts: P.modelSpec.parts.map((q) => ({ name: q.name, inset: q.inset, insetAi: q.insetAi })), sides: P.modelSpec.facades.map((f) => ({ n: f.name, side: f.side, ai: f.sideAi })), vols: MD.volsOf(P.model).map((v) => ({ fp: v.fp, ops: v.openings.length, bk: (v.balconies || []).length })) }); } touch(); }
  renderAll();
}
// aktivni dokument projekta: P.pdf i P.pageScale uvijek pokazuju na njega
function linkDoc(p) {
  p.docs ||= [];
  const d = p.docs.find((x) => x.id === p.docId) || p.docs[0] || null;
  p.docId = d?.id || null; p.pdf = d; p.pageScale = d ? (d.pageScale ||= {}) : {};
  return p;
}
const hasDemo = () => (P.docs || []).some((d) => d.demo);
const inPage = (m, pg) => m.page === pg && m.doc === P.docId;
function migrate(p) {
  p.phases ||= PHASES.map((x) => ({ ...x })); p.items ||= []; p.meas ||= []; p.pageScale ||= {}; p.chat ||= []; p.meta ||= {};
  if (!p.build) {
    // projekt iz starije verzije: poveži postojeće stavke s izvedbom i dopiši okvirne cijene gdje cijene nema
    p.build = { ...MD.DEFAULT_BUILD };
    if (p.pdf?.demo) {
      p.model ||= MD.demoModel(); p.buildLinked = true;
      const gen = MD.buildItems(p.model, p.build);
      const TAGS = [[/iskop.*(temelj|III\. kat)/i, 'iskop', 'iskop'], [/odvoz viška/i, 'iskop', 'odvoz'], [/trakastih temelja/i, 'temelji', 'temelj'], [/betoniranje AB podne ploče/i, 'temelji', 'podna'], [/zidanje vanjskih/i, 'zid', 'zid'], [/serklaž/i, 'zid', 'serklazi'], [/krovne konstrukcije/i, 'krovK', 'krovK'], [/OSB/, 'krovK', 'osb'], [/pokrivanje krova/i, 'pokrov', 'pokrov'], [/horizontalni oluk/i, 'oluk', 'oluk'], [/odvodna cijev/i, 'oluk', 'cijev'], [/kontaktna fasada/i, 'fasada', 'fasada']];
      for (const [re, slot, key] of TAGS) { const it = p.items.find((i) => !i.slot && re.test(i.desc)), g = gen.find((x) => x.slot === slot && x.key === key); if (it && g) { it.slot = slot; it.key = key; it.opt = g.opt; if (it.price == null) { it.price = g.price; it.priceSrc = 'kat'; } } }
      const arm = p.items.find((i) => !i.slot && /armatura B500/i.test(i.desc)); if (arm) { arm.slot = 'arm'; arm.key = 'armatura'; if (arm.price == null) { arm.price = MD.PRICE.armatura; arm.priceSrc = 'kat'; } }
      const win = p.items.findIndex((i) => !i.slot && i.group === 'g10' && /prozor/i.test(i.desc) && !(i.qty > 0));
      if (win >= 0) p.items.splice(win, 1, ...gen.filter((x) => x.slot === 'stolarija').map(slotToItem));
    }
    p.chat.push({ role: 'assistant', content: 'Novo u v0.5: u kartici 3D prikaz → Izvedba i cijene biraš vrstu tla, temelje, konstrukciju (opeka sa serklažima ili armirani beton), oblik krova, pokrov, fasadu i stolariju. 3D model i stavke troškovnika odmah se usklade, s okvirnim tržišnim cijenama koje čekaju tvoju potvrdu. Ispod je informativna provjera statike.' });
  }
  if ((p.mig || 0) < 6) {
    // v0.6: vrsta objekta i dimenzije; stropne ploče postaju stavka izvedbe (prate tlocrt i broj etaža)
    p.mig = 6;
    p.modelType ||= p.model?.src === 'auto' || !p.pdf?.demo ? 'kuca' : 'nacrt';
    if (p.buildLinked && !p.items.some((i) => i.slot === 'ploce')) p.items.filter((i) => !i.slot && /stropn\S* ploč/i.test(i.desc)).forEach((it, k) => { it.slot = 'ploce'; it.key = k ? 'stropna' + k : 'stropna'; it.opt = 'ab20'; });
  }
  if ((p.mig || 0) < 7) {
    // v0.7: više dokumenata po projektu (ništa se ne gubi zamjenom nacrta); 3D model se više ne izmišlja
    p.mig = 7;
    if (!p.docs) {
      p.docs = p.pdf ? [{ id: uid(), ...p.pdf, pageScale: p.pageScale || {} }] : []; p.docId = p.docs[0]?.id || null;
      p.meas.forEach((m) => { m.doc ||= p.docId; });
      if (p.model?.src === 'nacrt' && !p.docs.some((d) => d.demo)) { p.docs.unshift({ id: 'demo', name: DEMO_NAME, url: DEMO_PDF_URL, demo: true, pageScale: {} }); p.docId = 'demo'; p.chat.push({ role: 'assistant', content: 'Vratio sam izvorni primjer nacrta u ovaj projekt. Svi učitani dokumenti sada su na popisu iznad stranica (kartica Nacrt): klikni naziv za prikaz, × za uklanjanje. Novi PDF se dodaje, više ništa ne zamjenjuje.' }); }
    }
    // okvirnu kuću koju je program prije sam stvorio (bez nacrta i bez tvojih dimenzija) uklanjam: nije bila iz nacrta
    if (p.model?.src === 'auto' && !p.modelDims && !p.buildLinked && p.docs.some((d) => !d.demo)) { p.model = null; p.modelType = null; p.chat.push({ role: 'assistant', content: 'Ispravak: 3D prikaz je za ovaj projekt pokazivao okvirnu kuću koja nije bila iz tvojih nacrta. Uklonio sam je. U kartici 3D prikaz sada možeš pokrenuti „AI: složi 3D model iz nacrta” (čita tlocrt, presjek i pročelja) ili zadati vrstu objekta i dimenzije.' }); }
  }
  if ((p.mig || 0) < 10) {
    // v0.10: pročelja AI modela se usklađuju (nacrtana širina pročelja, otvori moraju pasti na zidove), izlozi su u punoj širini
    p.mig = 10;
    if (p.modelType === 'ai' && p.modelSpec && p.modelSpec.res !== 3 && !p.specManual) {
      try {
        const r = MD.resolveSpec(p.modelSpec), nm = MD.modelFromAi(r.spec); if (p.model?.colors) nm.colors = p.model.colors;
        p.modelSpec = r.spec; p.model = nm; p.relink = true;
        if (r.changed) p.chat.push({ role: 'assistant', content: `Ispravak 3D modela iz nacrta: ${r.notes.join('; ')}. Provjeri u 3D prikazu. Strane pročelja i uvlake možeš sam promijeniti u 3D prikaz → Izvedba i cijene → Objekt i dimenzije.` });
      } catch (e) { console.warn(e); }
    }
  }
  p.docs.forEach((d) => { if (d.demo) d.url = DEMO_PDF_URL; });
  linkDoc(p);
  p.build = MD.normBuild(p.build);
  if (p.model) MD.applyBuild(p.model, p.build);
}
const needsOk = (it) => it.status === 'ai' || it.priceSrc === 'ai' || it.priceSrc === 'kat';

/* ---------- PDF ---------- */
let pdfDoc = null, curPage = 1, zoom = 1, pageInfo = {}, renderTask = null, pageView = null;
async function loadPdfForProject() {
  pdfDoc = null; pageInfo = {}; curPage = 1;
  if (P.pdf && P.pdf.url && !P.pdf.url.startsWith('__')) {
    try { pdfDoc = await pdfjsLib.getDocument({ url: P.pdf.url, isEvalSupported: false }).promise; }
    catch (e) { console.warn(e); toast('Nacrt se ne može otvoriti. Učitaj PDF ponovno.'); }
  } else if (P.pdf && P.pdf.session && sessionPdf[P.pdf.id]) {
    pdfDoc = await pdfjsLib.getDocument({ data: sessionPdf[P.pdf.id].slice(0), isEvalSupported: false }).promise;
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
// Sličice se crtaju tek kad su vidljive i jedna po jedna: dokument od 40+ velikih listova inače zaledi preglednik.
const thumbQ = []; let thumbBusy = false;
async function pumpThumbs() {
  if (thumbBusy) return; thumbBusy = true;
  while (thumbQ.length) { const job = thumbQ.shift(); try { await job(); } catch (e) { console.warn(e); } await new Promise((r) => setTimeout(r, 0)); }
  thumbBusy = false;
}
const thumbIO = new IntersectionObserver((ents) => ents.forEach((en) => {
  const b = en.target; if (!en.isIntersecting || b.dataset.drawn) return;
  b.dataset.drawn = '1'; const doc = pdfDoc, i = +b.dataset.page;
  thumbQ.push(async () => {
    if (doc !== pdfDoc || !b.isConnected) return;
    const page = await doc.getPage(i), base = page.getViewport({ scale: 1 }), tw = Math.round(160 * Math.min(window.devicePixelRatio || 1, 2)), vp = page.getViewport({ scale: tw / base.width });
    const c = $('canvas', b); c.width = tw; c.height = Math.round(vp.height); await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  });
  pumpThumbs();
}), { root: null, rootMargin: '400px' });
async function renderThumbs() {
  const box = $('#pages');
  const key = (P.pdf?.url || P.pdf?.name || '') + '|' + (pdfDoc?.numPages || 0) + '|' + P.id + '|' + P.docs.map((d) => d.id).join(',') + '|' + P.docId;
  if (key === thumbsKey && pdfDoc) {
    $$('.pg[data-page]', box).forEach((b, k) => { const i = k + 1; b.setAttribute('aria-current', String(i === curPage)); const cnt = P.meas.filter((m) => inPage(m, i)).length; $('span', b).textContent = (pageInfo[i]?.ratio ? '1:' + pageInfo[i].ratio : 'mjerilo ?') + (cnt ? ' · ' + cnt + ' izmjera' : ''); });
    return;
  }
  thumbsKey = pdfDoc ? key : '';
  thumbIO.disconnect(); thumbQ.length = 0;
  box.innerHTML = '';
  const up = document.createElement('button');
  up.className = 'upload'; up.textContent = P.docs.length ? 'Dodaj nacrt ili dokument (PDF)' : 'Učitaj nacrt (PDF)';
  up.onclick = () => $('#pdfFile').click();
  box.append(up);
  if (P.docs.length) {
    const dl = document.createElement('div'); dl.className = 'doclist';
    dl.innerHTML = `<div class="note">Dokumenti projekta (${P.docs.length})</div>` + P.docs.map((d) => `<div class="drow" aria-current="${d.id === P.docId}"><button class="dn" data-doc="${d.id}" title="${esc(d.name)}">${esc(d.name)}${d.session ? ' · samo ova sesija' : ''}</button><button class="icon-btn" data-deldoc="${d.id}" title="Ukloni dokument iz projekta" aria-label="Ukloni dokument ${esc(d.name)}">×</button></div>`).join('');
    box.append(dl);
    $$('[data-doc]', dl).forEach((b) => b.onclick = () => switchDoc(b.dataset.doc));
    $$('[data-deldoc]', dl).forEach((b) => b.onclick = () => removeDoc(b.dataset.deldoc));
  }
  if (!pdfDoc) return;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const b = document.createElement('button');
    b.className = 'pg'; b.dataset.page = i; b.setAttribute('aria-current', String(i === curPage));
    const cnt = P.meas.filter((m) => inPage(m, i)).length;
    b.innerHTML = `<canvas width="140" height="190"></canvas><b>${i}. ${esc(pageInfo[i]?.title || '')}</b><span>${pageInfo[i]?.ratio ? '1:' + pageInfo[i].ratio : 'mjerilo ?'}${cnt ? ' · ' + cnt + ' izmjera' : ''}</span>`;
    b.onclick = () => { curPage = i; cancelDraw(); renderNacrt(); };
    box.append(b);
    thumbIO.observe(b);
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
  for (const m of P.meas.filter((m) => inPage(m, curPage))) {
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
  assignMeasModal({ id: uid(), doc: P.docId, page: curPage, type, pts, value, factor: 1, itemId: null });
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
      P.meas.filter((x) => inPage(x, curPage)).forEach((x) => { x.value = measValue(x.type, x.pts, curPage); });
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
  const ms = P.meas.filter((m) => inPage(m, curPage));
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
  return { sum, pdv: sum * PDV, total: sum * (1 + PDV), byGroup, byPhase, missing, ai: P.items.filter(needsOk).length };
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
    if (filters.onlyAi) its = its.filter(needsOk);
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
  ${!isI ? `<div class="note">Uloga Projektant: radiš opise i količine (projektantski troškovnik). Cijene su neobavezne procjene; izvođač upisuje svoje u ulozi Izvođač. Plava točka uz cijenu = okvirna tržišna cijena iz kataloga izvedbe (2026.), čeka potvrdu.</div>` : ''}
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
    <td class="pc"><input class="cell n" data-f="price" inputmode="decimal" value="${fp(it.price)}" placeholder="–">${it.priceSrc === 'ai' ? '<span class="dot-ai" title="Cijenu je predložio AI"></span>' : it.priceSrc === 'kat' ? '<span class="dot-kat" title="Okvirna tržišna cijena iz kataloga izvedbe. Potvrdi je ili upiši svoju."></span>' : ''}</td>
    <td class="tot">${amt ? nf2.format(amt) : '–'}</td>
    <td><select class="cell" data-f="phase">${P.phases.map((p) => `<option value="${p.id}" ${p.id === it.phase ? 'selected' : ''}>${esc(p.n)}</option>`).join('')}</select></td>
    <td><div class="acts"><span class="pill ${st.c}">${st.n}</span>${needsOk(it) ? '<button class="icon-btn okb" data-ok title="Potvrdi">✓</button>' : ''}<button class="icon-btn" data-ask title="Pitaj AI o ovoj stavci">?</button><button class="icon-btn del" data-del title="Obriši stavku">×</button></div></td>
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
        if (f === 'qty') { const n = parseNum(inp.value); it.qty = n ?? 0; it.qtyMode = 'manual'; it.status = 'rucno'; if (it.group === 'g03') syncArmatura(P.items); }
        else if (f === 'price') { const n = parseNum(inp.value); it.price = n; it.priceSrc = n === null ? null : 'rucno'; }
        else if (f === 'desc') { it.desc = inp.value; if (it.status === 'ai') it.status = 'rucno'; }
        else it[f] = inp.value;
        touch(); renderTroskovnik();
      };
    });
    const ok = $('[data-ok]', tr); if (ok) ok.onclick = () => { if (it.status === 'ai') it.status = 'ok'; if (it.priceSrc === 'ai' || it.priceSrc === 'kat') it.priceSrc = 'ok'; touch(); renderTroskovnik(); };
    $('[data-del]', tr).onclick = () => confirmModal('Obriši stavku?', it.desc, 'Obriši', () => { P.items = P.items.filter((x) => x !== it); P.meas.forEach((m) => { if (m.itemId === it.id) m.itemId = null; }); touch(); renderTroskovnik(); });
    $('[data-ask]', tr).onclick = () => { openChat(); $('#chatInput').value = `Stavka „${it.desc}” (${fq(it.qty)} ${it.unit}): `; $('#chatInput').focus(); };
    const rm = $('[data-remeas]', tr); if (rm) rm.onclick = () => { it.qtyMode = 'meas'; it.status = 'mjereno'; recalcItem(it); touch(); renderTroskovnik(); };
  });
  $$('[data-add]', w).forEach((b) => b.onclick = () => addItemModal(b.dataset.add));
  $$('[data-cat]', w).forEach((b) => b.onclick = () => catalogModal(b.dataset.cat));
  $('#addAny', w).onclick = () => addItemModal('g14');
  $('#confirmAll', w).onclick = () => confirmModal('Potvrdi sve AI prijedloge?', 'Sve žute stavke i okvirne cijene postat će potvrđene. Količine i cijene i dalje možeš mijenjati.', 'Potvrdi sve', () => { P.items.forEach((i) => { if (i.status === 'ai') i.status = 'ok'; if (i.priceSrc === 'ai' || i.priceSrc === 'kat') i.priceSrc = 'ok'; }); touch(); renderTroskovnik(); });
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


/* ---------- IZVEDBA (opcije) ↔ 3D model ↔ troškovnik ---------- */
// Model se nikad ne izmišlja: postoji samo ako je iz primjera nacrta, složen AI čitanjem nacrta ili zadan dimenzijama.
function ensureModel() {
  if (!P.model) { if (!(hasDemo() && (!P.modelType || P.modelType === 'nacrt'))) return null; P.model = MD.demoModel(); P.modelType = 'nacrt'; }
  P.build = MD.normBuild(P.build); MD.applyBuild(P.model, P.build); return P.model;
}
function snapshot() { return JSON.stringify({ items: P.items, phases: P.phases, meta: P.meta, contract: P.contract, build: P.build, buildLinked: P.buildLinked, model: P.model, modelType: P.modelType, modelDims: P.modelDims || null, modelBase: P.modelBase || null, modelSpec: P.modelSpec || null }); }
function restore(str) {
  const o = JSON.parse(str); P.items = o.items; P.phases = o.phases; P.meta = o.meta; P.contract = o.contract;
  if (o.build) { P.build = o.build; P.buildLinked = o.buildLinked; P.model = o.model || null; P.modelType = o.modelType || null; P.modelDims = o.modelDims || undefined; P.modelBase = o.modelBase || undefined; P.modelSpec = o.modelSpec || undefined; }
}
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 15) undoStack.shift(); }
// Zamijeni stavke troškovnika koje ovise o izvedbi. Ručno upisane ili izmjerene količine ostaju; cijena ostaje ako se opcija nije promijenila.
function applySlots(slots) {
  if (!ensureModel()) return 0;
  const gen = MD.buildItems(P.model, P.build); let n = 0;
  for (const slot of slots) {
    const old = P.items.filter((i) => i.slot === slot), g = gen.filter((x) => x.slot === slot);
    if (!old.length && !P.buildLinked) continue;
    let at = old.length ? P.items.indexOf(old[0]) : -1;
    const fresh = g.map((x) => {
      const o = old.find((i) => i.key === x.key), it = slotToItem(x);
      if (!o) return it;
      it.id = o.id; // izmjere na nacrtu ostaju vezane uz stavku
      const mine = (o.status === 'rucno' || o.status === 'mjereno' || o.qtyMode === 'meas') && o.unit === x.unit;
      if (mine) { it.qty = o.qty; it.status = o.status; it.qtyMode = o.qtyMode; it.basis = o.basis; }
      else if (o.status === 'ok' && o.unit === x.unit && Math.abs((o.qty || 0) - x.qty) < 0.005) it.status = 'ok';
      if (o.opt === x.opt) { if (o.priceSrc && o.priceSrc !== 'kat') { it.price = o.price; it.priceSrc = o.priceSrc; } else if (o.price == null && !o.priceSrc) { /* cijena obrisana ručno: ostaje okvirna */ } if (o.phase) it.phase = o.phase; }
      return it;
    });
    const keep = new Set(fresh.map((f) => f.id));
    P.meas.forEach((mm) => { if (old.some((o) => o.id === mm.itemId) && !keep.has(mm.itemId)) mm.itemId = null; });
    P.items = P.items.filter((i) => i.slot !== slot);
    if (at < 0) { const gid = fresh[0]?.group, last = P.items.map((i) => i.group).lastIndexOf(gid); at = last >= 0 ? last + 1 : P.items.length; }
    P.items.splice(Math.min(at, P.items.length), 0, ...fresh); n += fresh.length;
  }
  syncArmatura(P.items);
  return n;
}
// promjena jedne ili više odluka o izvedbi; vraća broj zamijenjenih stavki
function setBuild(patch, quiet) {
  if (!ensureModel()) return 0;
  const prev = P.build, sz = patch.seizmika !== undefined ? patch.seizmika : prev.seizmika, nb = MD.normBuild({ ...prev, ...patch, seizmika: sz });
  if (JSON.stringify(nb) === JSON.stringify(prev)) return 0;
  if (!quiet) pushUndo();
  const C = P.model.colors, eq = (a, c) => (a || '').toLowerCase() === (c || '').toLowerCase();
  // boja prati materijal (crijep/lim, PVC/drvo) ako korisnik nije odabrao svoju
  [['pokrov', 'krov'], ['stolarija', 'stolarija']].forEach(([k, ck]) => { const o0 = MD.optOf(k, prev[k]), o1 = MD.optOf(k, nb[k]); if (o0.id !== o1.id && o1.boja && (eq(C[ck], o0.boja) || eq(C[ck], MD.DEFAULT_COLORS[ck]))) C[ck] = o1.boja; });
  P.build = nb; MD.applyBuild(P.model, nb);
  const keys = MD.BUILD_KEYS.filter((k) => prev[k] !== nb[k]);
  const n = applySlots([...new Set(keys.flatMap((k) => MD.SLOTS_OF[k]))]);
  touch();
  if (V && view === '3d' && keys.length && !quiet) V.build(P.model, P.build);
  return n;
}
// vrsta objekta i dimenzije: novi model (iz nacrta rastegnut ili okvirni), uobičajena izvedba za vrstu, preračun stavki izvedbe
const typeOf = () => MD.TYPES.find((t) => t.id === P.modelType) || MD.TYPES.find((t) => t.id === 'kuca');
function curDims() { ensureModel(); return { ...MD.modelDims(P.model), ...(P.modelType === 'nacrt' ? {} : MD.clampDims(P.modelDims || {})) }; }
function setObjekt(type, dims) {
  ensureModel(); pushUndo();
  const T = type ? MD.TYPES.find((t) => t.id === type) : null;
  if (T) P.modelType = T.id; else P.modelType ||= 'kuca';
  if (P.modelType === 'ai' && P.modelSpec) {
    // model iz nacrta (AI): mjere i dijelovi se mijenjaju na specifikaciji, a model i otvori se slažu iznova
    P.modelSpec = MD.specWithDims(P.modelSpec, dims || {}); P.modelDims = undefined; if (dims && (dims.parts || dims.sides)) P.specManual = true; // ručno ispravljeno: usklađivanje to više ne dira
    const nm = MD.modelFromAi(P.modelSpec); if (P.model?.colors) nm.colors = P.model.colors;
    P.model = nm; MD.applyBuild(P.model, P.build); setBuild({ krovOblik: P.modelSpec.roof }, true);
    const n = P.buildLinked ? applySlots(MD.ALL_SLOTS) : 0; touch(); return n;
  }
  const base = P.modelType === 'nacrt' ? MD.demoModel() : P.modelType === 'ai' && P.modelBase ? JSON.parse(JSON.stringify(P.modelBase)) : null;
  P.modelDims = MD.clampDims(T ? (T.d || MD.modelDims(base)) : { ...(P.model ? curDims() : {}), ...dims });
  const nm = base ? MD.resizeModel(base, P.modelDims) : MD.autoModel(P.modelDims);
  if (P.model?.colors) nm.colors = P.model.colors;
  P.model = nm; MD.applyBuild(P.model, P.build);
  if (T?.build) setBuild(T.build, true); else if (T?.ai) setBuild({ krovOblik: base.roof.type }, true);
  const n = P.buildLinked ? applySlots(MD.ALL_SLOTS) : 0;
  touch();
  return n;
}
function objektHtml() {
  const d = curDims(), T = typeOf(), Q = MD.quantities(P.model), sp = P.modelType === 'ai' && P.modelSpec ? P.modelSpec : null, PB = sp ? MD.partBoxes(sp) : [];
  const F = [['W', 'Širina (m)'], ['D', 'Dubina (m)'], ['floors', 'Broj etaža'], ['storeyH', 'Visina etaže (m)'], ['pitch', 'Nagib krova (°)'], ['ov', 'Prepust krova (m)']];
  return `<details class="ogrp" data-g="objekt" ${openGrp.has('objekt') ? 'open' : ''}><summary><span class="gn">Objekt i dimenzije</span><span class="gv">${esc(T.n)}${P.model.resized ? ' (izmijenjeno)' : ''}</span><span class="gc">${fq(d.W)} × ${fq(d.D)} m · ${MD.etaze(d.floors)}</span></summary>
    <div class="opts">${MD.TYPES.filter((t) => (!t.demo || hasDemo()) && (!t.ai || P.modelBase || P.modelSpec)).map((t) => `<button class="opt" data-ty="${t.id}" aria-pressed="${t.id === T.id}"><span class="on">${esc(t.n)}</span><span class="pr">${t.d ? MD.etaze(t.d.floors) : ''}</span><span class="nt">${t.d ? `${fq(t.d.W)} × ${fq(t.d.D)} m, etaža ${fq(t.d.storeyH)} m` : esc(t.note)}</span></button>`).join('')}
      ${sp ? `<div class="dims">${[['W', 'Širina podnožja (m)'], ['D', 'Dubina podnožja (m)']].map(([k, l]) => `<label for="dm_${k}">${l}<input id="dm_${k}" data-dm="${k}" inputmode="decimal" value="${fq(d[k])}"></label>`).join('')}</div>
        ${sp.parts.map((p, i) => `<div class="part" data-part="${i}"><b>${i + 1}. <input class="pn" data-pf="name" value="${esc(p.name)}" aria-label="Naziv dijela"></b>
          <div class="dims"><label>Broj etaža<input data-pf="floors" inputmode="numeric" value="${p.floors}"></label><label>Visine etaža (m)<input data-pf="heights" value="${p.heights.map((h) => fq(h)).join(' / ')}" title="Visina svake etaže odozdo prema gore, odvojeno kosom crtom. Jedan broj vrijedi za sve etaže."></label>
          ${i ? [['g', 'Uvlaka gore (m)'], ['d', 'Uvlaka desno (m)'], ['dl', 'Uvlaka dolje (m)'], ['l', 'Uvlaka lijevo (m)']].map(([k, l]) => `<label>${l}<input data-pf="in_${k}" inputmode="decimal" value="${fq(p.inset[k])}"></label>`).join('') : ''}</div>
          ${(p.balconies || []).length ? '<p class="note" style="margin:8px 0 0">Balkoni: strana tlocrta i ograda; ispod početak, kraj i istak u metrima te etaže.</p>' : ''}
          ${(p.balconies || []).map((b, j) => { const hz = b.side === 'gore' || b.side === 'dolje', sp = (hz ? PB[i]?.W : PB[i]?.D) || 1; return `<div class="balk" data-bal="${j}"><select data-bf="side" title="Strana dijela na tlocrtu">${MD.SIDES.map((sd) => `<option ${b.side === sd ? 'selected' : ''}>${sd}</option>`).join('')}</select><select data-bf="rail" title="Ograda">${[['staklo', 'staklena'], ['metal', 'metalna'], ['zid', 'zidana']].map(([k, l]) => `<option value="${k}" ${b.rail === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn small" data-bkdel="${i}:${j}" title="Ukloni balkon">×</button>
            <input data-bf="a" inputmode="decimal" value="${fq(r2(b.x0 * sp))}" title="Početak balkona u m, mjereno od ${hz ? 'lijevog' : 'gornjeg'} ruba dijela na tlocrtu"><input data-bf="b" inputmode="decimal" value="${fq(r2(b.x1 * sp))}" title="Kraj balkona u m"><input data-bf="d" inputmode="decimal" value="${fq(b.d)}" title="Istak balkona u m"><input data-bf="fl" value="${(b.floors || []).join(', ')}" placeholder="sve etaže" title="Etaže dijela na kojima je balkon (1 = najdonja); prazno = sve"></div>`; }).join('')}
          <button class="btn small" data-bkadd="${i}">+ Balkon</button>
          ${i ? `<button class="btn small" data-pdel="${i}">Ukloni ovaj dio</button>` : ''}</div>`).join('')}
        ${sp.parts.length < 4 ? '<button class="btn small" id="pAdd">+ Dodaj uvučeni gornji dio</button>' : ''}
        ${sp.facades.length ? `<div class="part"><b>Pročelja s nacrta: na kojoj su strani tlocrta</b><div class="dims">${sp.facades.map((f, i) => `<label>${esc(String(f.name || 'Pročelje ' + (i + 1)).slice(0, 34))}<select data-fs="${i}">${MD.SIDES.map((sd) => `<option value="${sd}" ${f.side === sd ? 'selected' : ''}>${sd}</option>`).join('')}</select></label>`).join('')}</div></div>` : ''}`
      : `<div class="dims">${F.map(([k, l]) => `<label for="dm_${k}">${l}<input id="dm_${k}" data-dm="${k}" inputmode="decimal" value="${fq(d[k])}" title="${MD.DIM_LIM[k].join(' – ')}"></label>`).join('')}</div>`}
      <p class="note">Ukupna visina ${fq(r2(MD.topOf(P.model)))} m, ${MD.etaze(d.floors)}. Tlocrt prizemlja ${fq(r2(Q.A))} m², sve etaže ${fq(r2(Q.slabVol / 0.2))} m².${sp ? ' Gore, desno, dolje i lijevo su strane slike tlocrta na nacrtu. Otvori se nakon svake promjene slažu iznova iz pročitanih pročelja.' : P.modelType === 'nacrt' || P.modelType === 'ai' ? ' Model iz nacrta se rasteže: prozori i vrata zadržavaju veličinu, etaže se dodaju ponavljanjem kata.' : ''}</p>
      <button class="btn primary" id="dmApply">Primijeni dimenzije</button>
      ${pdfDoc && !P.pdf?.demo ? '<button class="btn small ai" id="dmAiModel" title="AI pročita tlocrt, presjek i pročelja iz otvorenog dokumenta i složi model">AI: složi 3D model iz nacrta</button>' : ''}
      ${P.buildLinked ? '<button class="btn small ai" id="dmAi" title="Podovi, žbuke, izolacije i instalacije ne ovise o izvedbi, pa ih dimenzije ne mijenjaju same">AI: uskladi ostale stavke s dimenzijama</button>' : ''}</div></details>`;
}
function bindObjekt(side) {
  const after = (n, msg) => { render3D(); renderCounts(); toast(msg + (n ? ` Preračunato ${n} stavki izvedbe.` : '')); };
  $$('[data-ty]', side).forEach((b) => b.onclick = () => { openGrp.add('objekt'); const n = setObjekt(b.dataset.ty), T = typeOf(); after(n, `${T.n}: standardne dimenzije${T.build ? ' i uobičajena izvedba' : ''}.`); });
  const readParts = () => $$('[data-part]', side).map((el, i) => { const g = (k) => $(`[data-pf="${k}"]`, el)?.value ?? '', hs = g('heights').split(/[\/;]|\s+-\s+/).map((x) => parseNum(x.trim())).filter((v) => v > 0);
    const old = P.modelSpec?.parts[i] || {}, PB = MD.partBoxes(P.modelSpec)[i] || { W: 1, D: 1 };
    const balconies = $$("[data-bal]", el).map((r) => { const v = (k) => $(`[data-bf="${k}"]`, r).value, sd = v('side'), sp = (sd === 'gore' || sd === 'dolje' ? PB.W : PB.D) || 1; return { side: sd, x0: (parseNum(v('a')) || 0) / sp, x1: (parseNum(v('b')) || 0) / sp, d: parseNum(v('d')) || 1.5, rail: v('rail'), floors: v('fl').split(/[,; ]+/).map(Number).filter((n) => n > 0) }; });
    return { ...(old.shape ? { shape: old.shape } : {}), name: g('name'), floors: parseNum(g('floors')) || hs.length || 1, heights: hs, inset: i ? { g: parseNum(g('in_g')) || 0, d: parseNum(g('in_d')) || 0, dl: parseNum(g('in_dl')) || 0, l: parseNum(g('in_l')) || 0 } : null, balconies }; });
  $$('[data-pf]', side).forEach((i) => i.onkeydown = (e) => { if (e.key === 'Enter') apply(); });
  const pa = $('#pAdd', side); if (pa) pa.onclick = () => { const ps = readParts(); ps.push({ name: 'Gornji dio', floors: 1, heights: [3], inset: { g: 2, d: 2, dl: 2, l: 2 } }); const n = setObjekt(null, { parts: ps }); after(n, 'Dodan je uvučeni gornji dio: upiši mu etaže i uvlake.'); };
  $$('[data-bkadd]', side).forEach((b) => b.onclick = () => { const ps = readParts(); ps[+b.dataset.bkadd].balconies.push({ side: 'dolje', x0: 0.1, x1: 0.4, d: 1.5, rail: 'staklo', floors: [] }); const n = setObjekt(null, { parts: ps }); after(n, 'Dodan je balkon: upiši mu stranu, položaj i istak.'); });
  $$('[data-bkdel]', side).forEach((b) => b.onclick = () => { const [pi, bi] = b.dataset.bkdel.split(':').map(Number), ps = readParts(); ps[pi].balconies.splice(bi, 1); const n = setObjekt(null, { parts: ps }); after(n, 'Balkon je uklonjen.'); });
  $$('[data-bf]', side).forEach((x) => { if (x.tagName === 'SELECT') x.onchange = () => apply(); else x.onkeydown = (e) => { if (e.key === 'Enter') apply(); }; });
  $$('[data-pdel]', side).forEach((b) => b.onclick = () => { const ps = readParts(); ps.splice(+b.dataset.pdel, 1); const n = setObjekt(null, { parts: ps }); after(n, 'Dio zgrade je uklonjen.'); });
  const apply = () => { const d = {}; $$('[data-dm]', side).forEach((i) => { const v = parseNum(i.value); if (v != null) d[i.dataset.dm] = v; }); if (P.modelType === 'ai' && P.modelSpec) { d.parts = readParts(); d.sides = $$('[data-fs]', side).map((x) => x.value); } const n = setObjekt(null, d), c = curDims(); after(n, `Dimenzije: ${fq(c.W)} × ${fq(c.D)} m, ${MD.etaze(c.floors)}, etaža ${fq(c.storeyH)} m.`); };
  $('#dmApply', side).onclick = apply;
  $$('[data-fs]', side).forEach((x) => x.onchange = apply);
  const am = $('#dmAiModel', side); if (am) am.onclick = () => aiBuildModel();
  $$('[data-dm]', side).forEach((i) => i.onkeydown = (e) => { if (e.key === 'Enter') apply(); });
  const ai = $('#dmAi', side); if (ai) ai.onclick = () => { const c = curDims(), Q = MD.quantities(P.model); sendChat(`Dimenzije objekta su sada ${fq(c.W)} × ${fq(c.D)} m, ${c.floors} etaža (${MD.etaze(c.floors)}), visina etaže ${fq(c.storeyH)} m, tlocrt ${fq(r2(Q.A))} m², sve etaže ${fq(r2(Q.A * c.floors))} m². Stavke izvedbe (polje izvedba = true) su već preračunate, njih ne diraj. Pregledaj OSTALE stavke koje ovise o veličini objekta (podovi, estrih, žbuke, bojanje, izolacije, pregradni zidovi, podno grijanje, humus, nasip) i uskladi im količine s novim dimenzijama alatom promijeni_stavku, uz obrazloženje izračuna. Ne mijenjaj stavke sa statusom rucno, mjereno ili ok. Na kraju kratko reci što si promijenio.`, { complex: true }); };
}
function buildCost() { return P.items.filter((i) => i.slot).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0); }
const bkey = (b) => MD.BUILD_KEYS.map((k) => b[k]).join('|');
const eur0 = (n) => new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(Math.round(n / 10) * 10) + ' €';

/* ---------- 3D PRIKAZ ---------- */
let VZ = null, V = null, V3P = null, v3dStage = 5, sideTab = 'izvedba';
const bim = { st: null, axis: null, t: 0.5, xray: false }; // BIM alati: odabrana etaža, presjek, prozirni prikaz
const openGrp = new Set();
const STAGES3D = [
  { n: 'Iskop', ph: ['pripremni', 'iskop'] }, { n: 'Temelji', ph: ['temelji'] }, { n: 'Konstrukcija', ph: ['konstrukcija'] },
  { n: 'Krovište', ph: ['krov'] }, { n: 'Fasada i stolarija', ph: ['fasada', 'instalacije'] }, { n: 'Gotov objekt', ph: ['zavrsni'] },
];
// dio 3D modela → stavke troškovnika i pripadna odluka o izvedbi (bk)
const PARTS3D = {
  iskop: { n: 'Iskop i zemljani radovi', f: (i) => i.group === 'g02', bk: 'tlo' },
  temelji: { n: 'Temelji i podna ploča', f: (i) => i.phase === 'temelji', bk: 'temelji' },
  zidovi: { n: 'Zidovi', f: (i) => i.group === 'g04' || i.slot === 'zid', bk: 'konstrukcija' },
  konstrukcija: { n: 'AB konstrukcija', f: (i) => i.group === 'g03' && i.phase !== 'temelji', bk: 'konstrukcija' },
  fasada: { n: 'Fasada', f: (i) => i.group === 'g09' || i.slot === 'fasada' || (i.group === 'g04' && /vanjsk/i.test(i.desc)), bk: 'fasada' },
  krov: { n: 'Krovište i pokrov', f: (i) => i.group === 'g06' || i.group === 'g07' || i.slot === 'krovK' || i.slot === 'pokrov', bk: 'krovOblik' },
  limarija: { n: 'Limarija (oluci, opšavi)', f: (i) => i.group === 'g08', bk: 'pokrov' },
  stolarija: { n: 'Prozori i vrata', f: (i) => i.group === 'g10', bk: 'stolarija' },
  balkon: { n: 'Balkon', f: (i) => /balkon|ograd/i.test(i.desc) },
  okolis: { n: 'Gradilište i okoliš', f: (i) => i.group === 'g01' || i.group === 'g14' },
};
const COLOR_LBL = [['fasada', 'Fasada'], ['cokl', 'Podnožje'], ['krov', 'Krov'], ['stolarija', 'Stolarija'], ['limarija', 'Limarija'], ['teren', 'Travnjak']];
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
  const had = !!P.model;
  if (!ensureModel()) return show3dEmpty(true);
  show3dEmpty(false); if (!had) touch(false);
  renderSide3d();
  if (!V) {
    try { V = await (V3P ||= VZ.Viz3D.create($('#v3dHost'), { onPick: show3dInfo })); }
    catch (e) { console.warn(e); $('#v3dLoad').textContent = 'Ovaj preglednik ne podržava WebGL 3D prikaz.'; return; }
    $('#v3dLoad')?.remove();
  }
  V.resize();
  if (V.model !== P.model || V.buildKey !== bkey(P.build)) { if (JSON.stringify(V.model?.fp) !== JSON.stringify(P.model.fp)) V.viewed = false; V.stage = v3dStage; V.build(P.model, P.build); }
  if (bim.st != null && !bimStoreys()[bim.st]) bim.st = null; applyBim();
  renderSide3d(); renderStages3d();
}
// projekt bez 3D modela: jasno stanje i dva puta do modela (AI iz nacrta ili dimenzije), nikad izmišljena kuća
function show3dEmpty(on) {
  let el = $('#v3dEmpty');
  if (!on) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'v3dEmpty'; el.className = 'v3d-empty'; $('#v3dHost').append(el); }
  const docs = P.docs.filter((d) => !d.demo), can = !!pdfDoc && cap.sample && cap.imagesOk;
  el.innerHTML = `<div class="card"><h2>3D model još nije složen</h2>
    <p>${docs.length ? `Za ovaj projekt još nema 3D modela. Mogu ga složiti iz otvorenog dokumenta „${esc(P.pdf?.name || '')}”: pročitam tlocrt, presjek i pročelja i predložim model koji zatim provjeriš i ispraviš.` : 'Učitaj nacrte (PDF) u kartici Nacrt pa ću iz njih složiti 3D model, ili zadaj vrstu objekta i dimenzije.'}</p>
    <div class="btns"><button class="btn primary" id="e3Ai" ${pdfDoc ? '' : 'disabled'}>AI: složi 3D model iz nacrta</button><button class="btn" id="e3Dim">Zadaj vrstu objekta i dimenzije</button></div>
    ${pdfDoc && !can ? '<p class="note">AI čitanje nacrta radi samo kad je program otvoren na claude.ai i dopušten mu je Claude.</p>' : ''}
    <p class="note">Model iz nacrta je AI prijedlog: jedan obris zgrade, etaže, krov i otvori s pročelja. Sve dimenzije poslije možeš ručno ispraviti.</p></div>`;
  $('#v3dSide').innerHTML = '<p class="note">Izvedba, cijene i statika pojavit će se kad postoji 3D model objekta.</p>'; $('#v3dStages').innerHTML = '';
  $('#e3Ai').onclick = () => aiBuildModel();
  $('#e3Dim').onclick = () => { openGrp.add('objekt'); sideTab = 'izvedba'; setObjekt('kuca'); render3D(); toast('Okvirni model: odaberi vrstu objekta i upiši dimenzije.'); };
}

/* ---------- AI: 3D model iz nacrta (tlocrt → obris; presjek i pročelja → visine, krov, otvori) ---------- */
function jsonFrom(text) { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('AI nije vratio podatke.'); return JSON.parse(text.slice(a, b + 1)); }
async function askJson(prompt, images, tier) {
  const imgs = (images || []).slice(0, cap.maxImages || 4); // platforma prima najviše 4 slike po upitu
  for (let tryNo = 0; ; tryNo++) {
    try {
      const r = await cap.sample(prompt + '\n\nOdgovori ISKLJUČIVO jednim JSON objektom, bez teksta prije ili poslije. Sve napomene piši na hrvatskom jeziku.', { ...(imgs.length ? { images: imgs } : {}), modelTier: tier || 'default', cache: false });
      return jsonFrom(r.text || '');
    } catch (e) {
      if (tryNo >= 1 || e?.code === 'not_granted') throw e;
      await new Promise((res) => setTimeout(res, e?.code === 'rate_limited' ? 12000 : 1500));
    }
  }
}
// izrez stranice (box = [x0,y0,x1,y1] u udjelima stranice) kao JPEG, dulja stranica do maxSide piksela
async function pageCropBlob(pageNo, box = [0, 0, 1, 1], maxSide = 1568) {
  const page = await pdfDoc.getPage(pageNo), base = page.getViewport({ scale: 1 });
  const bw = (box[2] - box[0]) * base.width, bh = (box[3] - box[1]) * base.height, sc = Math.min(4, maxSide / Math.max(bw, bh));
  const vp = page.getViewport({ scale: sc }), c = document.createElement('canvas'); c.width = Math.max(8, Math.round(bw * sc)); c.height = Math.max(8, Math.round(bh * sc));
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -box[0] * vp.width, -box[1] * vp.height] }).promise;
  return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
}
// brojevi (kote) s položajem unutar izreza: AI ih na slici često ne može pročitati, iz PDF-a su točni
async function pageNums(pageNo, box) {
  const page = await pdfDoc.getPage(pageNo), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), out = [];
  for (const t of tc.items) {
    const str = (t.str || '').trim(); if (!/^[+\-±]?\d{1,4}([.,]\d{1,3})?$/.test(str)) continue;
    const [fx, fy] = vp.convertToViewportPoint(t.transform[4], t.transform[5]).map((v, k) => v / (k ? vp.height : vp.width));
    if (fx < box[0] || fx > box[2] || fy < box[1] || fy > box[3]) continue;
    out.push(`${str}@${((fx - box[0]) / (box[2] - box[0])).toFixed(2)},${((fy - box[1]) / (box[3] - box[1])).toFixed(2)}`);
  }
  return out.slice(0, 260).join(' ');
}
const pageLevels = (n) => [...new Set((pageInfo[n].text.match(/[+\-±]\s?\d{1,2}[.,]\d{2}(?!\d)/g) || []).map((x) => x.replace(/\s/g, '')))].slice(0, 50).join(' ') || 'nema';
let aiModelBusy = false;
const aiMemo = {};
// kratki dnevnik zadnjeg AI čitanja (što je pročitano i gdje je stalo), odvojen od projekta: služi za provjeru i podršku
async function aiReadLog(o) { try { if (cap.db && cap.uid) await cap.db.collection('data/users/' + cap.uid).doc('ailog_' + P.id).set({ t: Date.now(), name: P.name, ...o }); } catch (e) { console.warn(e); } }
async function aiBuildModel() {
  if (aiModelBusy) return toast('AI već slaže model, pričekaj.');
  if (!pdfDoc) return toast('Prvo učitaj nacrte (PDF) u kartici Nacrt.');
  openChat();
  if (!cap.sample || !cap.imagesOk) return addMsg('sys', 'AI čitanje nacrta ovdje nije dostupno (otvori program na claude.ai i dopusti mu korištenje Claudea). 3D model možeš zadati vrstom objekta i dimenzijama.');
  aiModelBusy = true; const say = (t) => { addMsg("sys", t); aiReadLog({ ok: null, step: t }); }, num = (v) => (isFinite(+v) ? +v : null);
  try {
    const memo = (aiMemo[P.docId] ||= {}), MAXI = cap.maxImages || 4;
    say(`Slažem 3D model iz dokumenta „${P.pdf.name}”. 1/6: biram stranice (tlocrt, presjek, pročelja)…`);
    if (!memo.pick) {
      // skenirani ili „spljošteni” nacrti nemaju tekst: stranice se tada razvrstavaju po izgledu, a mjerilo čita sa slike
      const nums = Object.keys(pageInfo).map(Number).sort((x, y) => x - y);
      if (nums.filter((n) => pageInfo[n].text.replace(/\s/g, '').length < 40).length > nums.length * 0.5) {
        memo.vis ||= {};
        const todo = nums.slice(0, 48);
        for (let i = 0; i < todo.length; i += MAXI) {
          const g = todo.slice(i, i + MAXI).filter((n) => !memo.vis[n]); if (!g.length) continue;
          say(`1/6: dokument nema čitljiv tekst, razvrstavam stranice po izgledu (${g[0]}–${g[g.length - 1]} od ${nums.length})…`);
          const r = await askJson('Priložene su stranice arhitektonskog projekta (slike redom). Za svaku sliku vrati {"stranice": [{"vrsta": "tlocrt prizemlja" | "tlocrt kata" | "tlocrt krova" | "tlocrt temelja" | "presjek" | "procelje" | "situacija" | "detalj" | "ostalo", "naslov": naslov crteža kako piše na listu, "mjerilo": broj N iz mjerila 1:N ili null}]} redom po slikama.', await Promise.all(g.map((n) => pageCropBlob(n, [0, 0, 1, 1], 1100))));
          g.forEach((n, k) => { const q = (Array.isArray(r.stranice) ? r.stranice[k] : null) || {}; memo.vis[n] = q; pageInfo[n].title = String(q.naslov || q.vrsta || pageInfo[n].title).slice(0, 60); pageInfo[n].text = `${q.vrsta || ''} ${q.naslov || ''}`; const sc = +q.mjerilo; if (sc >= 20 && sc <= 1000 && !pageInfo[n].ratio) { pageInfo[n].ratio = sc; if (!P.pageScale[n]) P.pageScale[n] = { mPerPt: (0.0254 / 72) * sc, src: 'AI pročitao 1:' + sc + ' (provjeri)' }; } });
        }
      }
      const list = Object.entries(pageInfo).map(([n, i]) => `${n}. „${i.title}” ${i.ratio ? '1:' + i.ratio : ''} | ${i.text.slice(0, 170)}`).join('\n').slice(0, 14000);
      memo.pick = await askJson(`Ovo je popis stranica PDF-a iz projekta zgrade (broj, naslov, mjerilo, početak teksta sa stranice):\n${list}\n\nOdaberi stranice potrebne za 3D model vanjskog oblika zgrade. Vrati {"tlocrt": broj stranice tlocrta prizemlja (ili karakteristične etaže ako prizemlja nema), "tlocrtKata": broj stranice tlocrta karakterističnog kata iznad prizemlja ili null, "presjek": broj stranice presjeka ili null, "procelja": [brojevi stranica pročelja / fasada / pogleda cijele zgrade, najviše 4, bez detalja], "napomena": "kratko"}. Ako dokument ne sadrži tlocrt zgrade, vrati {"tlocrt": null, "napomena": "što dokument sadrži"}.`);
    }
    const pick = memo.pick, tp = +pick.tlocrt;
    if (!tp || !pageInfo[tp]) { delete aiMemo[P.docId]; return say(`U ovom dokumentu nisam našao tlocrt zgrade${pick.napomena ? ' (' + pick.napomena + ')' : ''}. Otvori dokument s tlocrtom, presjekom i pročeljima (popis dokumenata je u kartici Nacrt) ili zadaj dimenzije ručno.`); }
    say(`2/6: tražim obris zgrade na tlocrtu (str. ${tp}, „${pageInfo[tp].title}”)…`);
    const pi = pageInfo[tp], mpp = scaleOf(tp);
    if (!memo.ob) {
      const fr = await askJson('Priložena je stranica arhitektonskog nacrta. Nađi crtež tlocrta zgrade (bez zaglavlja, legende, tablica). Vrati {"okvir":[x0,y0,x1,y1]} u udjelima širine i visine slike (0–1, ishodište gore lijevo) tako da okvir obuhvati cijeli tlocrt zgrade zajedno s vanjskim kotama. Ako je na stranici više tlocrta, uzmi najveći.', [await pageCropBlob(tp)]);
      let box = (Array.isArray(fr.okvir) ? fr.okvir : [0, 0, 1, 1]).map(Number);
      if (box.length !== 4 || box.some((v) => !isFinite(v)) || box[2] - box[0] < 0.08 || box[3] - box[1] < 0.08) box = [0, 0, 1, 1];
      box = [Math.max(0, box[0] - 0.02), Math.max(0, box[1] - 0.02), Math.min(1, box[2] + 0.02), Math.min(1, box[3] + 0.02)];
      const crop = await pageCropBlob(tp, box);
      const ob = await askJson(`Priložen je izrez tlocrta zgrade${pi.ratio ? ' u mjerilu 1:' + pi.ratio : ''}. Odredi VANJSKI obris zgrade: vanjski rub vanjskih zidova (bez balkona, lođa izvan obrisa, terasa, vanjskih stubišta, rampi i nadstrešnica). Vrati {"obris":[[x,y],...]} redom po obodu u udjelima širine i visine OVE slike (0–1, ishodište gore lijevo). Koristi onoliko točaka koliko zgrada ima uglova (pravokutnik 4, razvedeni tlocrt više; zanemari istake manje od 0,5 m). Položaj svakog loma obrisa odredi iz kota uz taj rub (zbroj dijelova mora dati ukupnu mjeru), ne samo odoka. Dodaj "sirina_m" i "dubina_m": ukupnu vanjsku širinu (vodoravno na slici) i dubinu (okomito na slici) zgrade u metrima ako ih možeš odrediti iz kota, inače null; "pouzdanost" 0–1; "napomena".\nBrojevi s nacrta (kote, najčešće u cm) s položajem na ovoj slici u obliku vrijednost@x,y: ${await pageNums(tp, box) || 'nema'}`, [crop], 'complex');
      if (!Array.isArray(ob.obris) || ob.obris.length < 3) throw new Error('obris zgrade nije prepoznat na tlocrtu.');
      Object.assign(memo, { box, crop, ob });
    }
    const { box, crop, ob } = memo;
    let pts = ob.obris.map(([fx, fy]) => [(box[0] + fx * (box[2] - box[0])) * pi.w, (box[1] + fy * (box[3] - box[1])) * pi.h]);
    const ext = (k) => Math.max(...pts.map((q) => q[k])) - Math.min(...pts.map((q) => q[k]));
    const sw = num(ob.sirina_m), sd = num(ob.dubina_m);
    if (mpp) pts = pts.map((q) => [q[0] * mpp, q[1] * mpp]);
    else if (sw > 2) { const k = sw / ext(0); pts = pts.map((q) => [q[0] * k, q[1] * k]); }
    else return say(`Na stranici ${tp} nema mjerila i ne mogu pročitati kote. Postavi mjerilo alatom Mjerilo na toj stranici pa pokreni ponovno.`);
    // kote su točnije od očitanja sa slike: ako se razumno slažu, obris se rasteže na pročitane mjere
    const kx = sw > 2 && Math.abs(sw / ext(0) - 1) < 0.3 ? sw / ext(0) : 1, kz = sd > 2 && Math.abs(sd / ext(1) - 1) < 0.3 ? sd / ext(1) : 1;
    pts = pts.map((q) => [q[0] * kx, q[1] * kz]);
    const W = r2(ext(0)), D = r2(ext(1));
    const sect = +pick.presjek && pageInfo[+pick.presjek] && +pick.presjek !== tp ? +pick.presjek : null;
    const elev = [...new Set((Array.isArray(pick.procelja) ? pick.procelja : []).map(Number).filter((n) => n && pageInfo[n] && n !== tp && n !== sect))].slice(0, 6);
    const pdesc = (n, k, kind) => `Slika ${k}: str. ${n} „${pageInfo[n].title}” (${kind}). Visinske kote na stranici: ${pageLevels(n)}`;
    const pageImg = async (n) => (memo['img' + n] ||= await pageCropBlob(n));
    // 3/5 visine i krov: tlocrt + presjek + pročelja koliko stane u jedan upit (najviše 4 slike)
    if (!memo.hv) {
      const kat = +pick.tlocrtKata && pageInfo[+pick.tlocrtKata] && +pick.tlocrtKata !== tp ? +pick.tlocrtKata : null;
      const hp = [...new Set([sect, kat, ...elev].filter(Boolean))].slice(0, MAXI - 1);
      say(`3/6: čitam dijelove zgrade, etaže, visine i krov${hp.length ? ' (str. ' + hp.join(', ') + ')' : ' (nema presjeka ni pročelja, samo tlocrt)'}…`);
      const imgs = [crop], desc = [`Slika 1: izrez tlocrta prizemlja (str. ${tp}).`];
      for (const n of hp) { imgs.push(await pageImg(n)); desc.push(pdesc(n, imgs.length, n === sect ? 'presjek' : n === kat ? 'tlocrt kata' : 'pročelje')); }
      memo.hv = await askJson(`Slažem 3D model vanjskog oblika zgrade. Obris prizemlja (podnožja) je već određen: širina ${fq(W)} m (vodoravno na tlocrtu) × dubina ${fq(D)} m.\n${desc.join('\n')}\n\nZgrada se opisuje DIJELOVIMA odozdo prema gore. Ako je tlocrt jednak po cijeloj visini, postoji jedan dio. Ako su gornje etaže uvučene ili imaju manji tlocrt (npr. poslovno podnožje i uži stambeni dio iznad), svaki takav volumen je zaseban dio. Izlaz na krov ili stubišna kućica iznad ravnog krova, ako je veća od oko 4 m², također je zaseban, najgornji dio (jedna etaža). Zgrada na kosom terenu: etaža ispod prizemlja (suteren) koja je na barem jednom pročelju cijelom visinom iznad terena BROJI se kao etaža najdonjeg dijela, jer se na tom pročelju vidi; potpuno ukopane etaže se ne broje.\nVrati JSON: {"dijelovi": [{"naziv": npr. "poslovno podnožje" ili "stambeni dio", "etaze": broj nadzemnih etaža tog dijela (podrum i suteren se ne broje), "visineEtaza": [visina svake etaže od poda do poda u m, odozdo prema gore; koristi visinske kote], "uvlaka": null za najdonji dio, a za gornje dijelove {"gore": m, "desno": m, "dolje": m, "lijevo": m} = koliko je rub tog dijela uvučen od ruba dijela ispod, na svakoj strani slike tlocrta (0 ako je u istoj ravnini). Na kojoj strani podnožja gornji dio stoji provjeri i na presjeku i pročeljima, ne samo na tlocrtu kata}], "kotaPoda": visinska kota poda najdonje brojane etaže u m (npr. 0 ili 5.76), "krov": oblik krova najgornjeg dijela: "ravni" | "dvostresni" | "cetverostresni" | "jednostresni", "smjerSljemena": "lijevo-desno" ili "gore-dolje" kako sljeme ide na slici tlocrta (null za ravni krov), "visinaSljemena": od ±0,00 u m ili null, "prepust": prepust krova u m, "pouzdanost": 0–1, "napomene": ["što nisi mogao pročitati ili što je pojednostavljeno"]}.`, imgs, 'complex');
    }
    const hv = memo.hv;
    const partsAi = (Array.isArray(hv.dijelovi) && hv.dijelovi.length ? hv.dijelovi : [{ naziv: 'Zgrada', etaze: hv.etaze, visineEtaza: num(hv.visinaEtaze) ? [num(hv.visinaEtaze)] : [], vrh: hv.visinaVrhaZida }]).slice(0, 4);
    const partsTxt = partsAi.map((p, i) => `${i + 1}. ${p.naziv || 'dio'}: ${num(p.etaze) || '?'} etaža, visine ${(Array.isArray(p.visineEtaza) ? p.visineEtaza : []).join(' / ') || '?'} m`).join('; ');
    // 4/6 tlocrt kata: točan oblik te etaže (krila, uvučena stubišta) i balkoni s ogradama
    const katP = +pick.tlocrtKata && pageInfo[+pick.tlocrtKata] && +pick.tlocrtKata !== tp ? +pick.tlocrtKata : null, katI = partsAi.length > 1 ? 1 : 0;
    if (katP && memo.kat === undefined) {
      say(`4/6: čitam oblik kata i balkone (str. ${katP}, „${pageInfo[katP].title}”)…`);
      try {
        const fr = await askJson('Priložena je stranica arhitektonskog nacrta. Nađi crtež tlocrta zgrade (bez zaglavlja, legende, tablica). Vrati {"okvir":[x0,y0,x1,y1]} u udjelima širine i visine slike (0–1, ishodište gore lijevo) tako da okvir obuhvati cijeli tlocrt te etaže s balkonima i vanjskim kotama, ali bez praznog dijela lista.', [await pageImg(katP)]);
        let kb = (Array.isArray(fr.okvir) ? fr.okvir : [0, 0, 1, 1]).map(Number);
        if (kb.length !== 4 || kb.some((v) => !isFinite(v)) || kb[2] - kb[0] < 0.08 || kb[3] - kb[1] < 0.08) kb = [0, 0, 1, 1];
        kb = [Math.max(0, kb[0] - 0.02), Math.max(0, kb[1] - 0.02), Math.min(1, kb[2] + 0.02), Math.min(1, kb[3] + 0.02)];
        const imgs = [await pageCropBlob(katP, kb)], desc = [`Slika 1: izrez tlocrta kata (str. ${katP})${pageInfo[katP].ratio ? ', mjerilo 1:' + pageInfo[katP].ratio : ''}.`];
        for (const n of elev.slice(0, 2)) { imgs.push(await pageImg(n)); desc.push(pdesc(n, imgs.length, 'pročelje')); }
        const kr = await askJson(`Slažem 3D model zgrade. Dijelovi odozdo prema gore: ${partsTxt}. Tlocrt na slici 1 prikazuje dio „${partsAi[katI].naziv || 'zgrada'}”.\n${desc.join('\n')}\n\nVrati JSON: {"obris": [[x,y],...] vanjski rub vanjskih zidova te etaže, redom po obodu, u udjelima širine i visine slike 1 (0–1, ishodište gore lijevo), SA SVIM lomovima većim od 1 m (krila zgrade, istaci, uvučena stubišta), ali BEZ balkona, lođa i terasa; "sirina_m" i "dubina_m": ukupna širina (vodoravno) i dubina (okomito) tog obrisa u metrima iz kota, inače null; "donjiDio": ako je na tom tlocrtu tankom linijom ucrtan i obris nižeg, šireg dijela zgrade (podnožja), njegov okvir [x0,y0,x1,y1] u udjelima slike 1, inače null; "balkoni": [{"naziv": oznaka s nacrta, "okvir": [x0,y0,x1,y1] okvir tog balkona ili lođe u udjelima slike 1, "ograda": "staklo" | "metal" | "zid" (vidi pročelja: staklena ograda je plava ili prozirna ploha ispred etaže), "etaze": [redni brojevi etaža tog dijela zgrade na kojima balkon postoji, 1 = najdonja; vidi pročelja]}], "napomena": "kratko"}.\nNavedi svaki balkon s tlocrta zasebno. Brojevi s nacrta (kote, najčešće u cm) s položajem na slici 1 u obliku vrijednost@x,y: ${await pageNums(katP, kb) || 'nema'}`, imgs, 'complex');
        memo.kat = { box: kb, r: kr };
      } catch (e) { if (e?.code === 'not_granted') throw e; console.warn(e); memo.kat = null; }
    }
    let katPart = null; const katNote = [];
    if (katP && memo.kat?.r && Array.isArray(memo.kat.r.obris) && memo.kat.r.obris.length >= 3) {
      const { box: kb, r: kr } = memo.kat, ki = pageInfo[katP], km = scaleOf(katP), toPt = ([fx, fy]) => [(kb[0] + fx * (kb[2] - kb[0])) * ki.w, (kb[1] + fy * (kb[3] - kb[1])) * ki.h];
      const op = kr.obris.map((q) => toPt(q.map(Number))), ex = (k) => Math.max(...op.map((q) => q[k])) - Math.min(...op.map((q) => q[k])), ksw = num(kr.sirina_m), ksd = num(kr.dubina_m);
      let kx = km, kz = km;
      if (!km) kx = kz = ksw > 2 ? ksw / ex(0) : 0; else { if (ksw > 2 && Math.abs(ksw / (ex(0) * km) - 1) < 0.3) kx = ksw / ex(0); if (ksd > 2 && Math.abs(ksd / (ex(1) * km) - 1) < 0.3) kz = ksd / ex(1); }
      if (kx > 0) {
        const M2 = ([x, z]) => [x * kx, z * kz], om = op.map(M2), rect = (o) => { const q = (Array.isArray(o) ? o : []).map(Number); return q.length === 4 && q.every(isFinite) ? [...M2(toPt([q[0], q[1]])), ...M2(toPt([q[2], q[3]]))] : null; };
        katPart = MD.katToPart(om, (Array.isArray(kr.balkoni) ? kr.balkoni : []).map((b) => ({ box: rect(b.okvir), rail: b.ograda, floors: b.etaze })).filter((b) => b.box));
        const dd = rect(kr.donjiDio);
        if (katPart && dd && Math.abs((dd[2] - dd[0]) / W - 1) < 0.12 && Math.abs((dd[3] - dd[1]) / D - 1) < 0.12) { // obris podnožja ucrtan na istom tlocrtu: uvlaka je izravno izmjerena
          const mn = (k) => Math.min(...om.map((q) => q[k])), mx = (k) => Math.max(...om.map((q) => q[k])), p0 = (v) => r2(Math.max(0, v));
          katPart.inset = { l: p0(mn(0) - dd[0]), g: p0(mn(1) - dd[1]), d: p0(dd[2] - mx(0)), dl: p0(dd[3] - mx(1)) };
        }
        if (kr.napomena) katNote.push(String(kr.napomena));
      }
    }
    // 5/6 otvori: po dva pročelja u upitu; ako jedan upit ne uspije, model se ipak složi bez tih otvora
    memo.facs ||= {}; const failed = [], per = Math.max(1, Math.min(2, MAXI - 1));
    for (let i = 0; i < elev.length; i += per) {
      const g = elev.slice(i, i + per), key = g.join('-');
      if (memo.facs[key]) continue;
      say(`5/6: čitam prozore i vrata s pročelja (str. ${g.join(', ')})…`);
      try {
        const imgs = [crop], desc = [`Slika 1: izrez tlocrta (str. ${tp}).`];
        // pročelje se čita s izreza samog crteža (bez zaglavlja i praznog papira): otvori su tada dvostruko veći na slici
        memo.ebox ||= {};
        if (g.some((n) => !memo.ebox[n])) {
          try {
            const fb = await askJson('Priložene su stranice nacrta s pročeljima zgrade. Za svaku sliku vrati okvir crteža pročelja: cijela zgrada s terenom, bez naslova, zaglavlja, pečata i praznog papira. Vrati {"okviri": [[x0,y0,x1,y1], ...]} redom po slikama, u udjelima širine i visine svake slike (0–1, ishodište gore lijevo).', await Promise.all(g.map(pageImg)));
            g.forEach((n, k) => { const q = (Array.isArray(fb.okviri?.[k]) ? fb.okviri[k] : []).map(Number); memo.ebox[n] = q.length === 4 && q.every(isFinite) && q[2] - q[0] > 0.15 && q[3] - q[1] > 0.1 ? [Math.max(0, q[0] - 0.03), Math.max(0, q[1] - 0.04), Math.min(1, q[2] + 0.03), Math.min(1, q[3] + 0.03)] : [0, 0, 1, 1]; });
          } catch (e) { if (e?.code === 'not_granted') throw e; console.warn(e); g.forEach((n) => { memo.ebox[n] ||= [0, 0, 1, 1]; }); }
        }
        for (const n of g) { imgs.push(memo['ecrop' + n] ||= await pageCropBlob(n, memo.ebox[n])); desc.push(pdesc(n, imgs.length, 'pročelje')); }
        const fr2 = await askJson(`Slažem 3D model zgrade: tlocrt podnožja ${fq(W)} × ${fq(D)} m. Dijelovi odozdo prema gore: ${partsTxt}.\n${desc.join('\n')}\n\nZa svako pročelje na slikama od 2 nadalje vrati {"procelja": [{"slika": broj slike, "naziv": naziv pročelja s nacrta, "strana": koju stranu tlocrta sa slike 1 to pročelje prikazuje: "gore" | "desno" | "dolje" | "lijevo", "balkona": broj balkona ili lođa s ogradom vidljivih na tom pročelju (0 ako ih nema), "rubovi": [x lijevog ruba zgrade, x desnog ruba zgrade] u razini terena kao udjeli širine TE SLIKE (0–1), "visinaPodnozja": visina vrha najdonjeg dijela zgrade (kod zgrade iz jednog dijela: vrha zida) iznad NAJNIŽE točke terena uz to pročelje, u m (iz visinskih kota ili mjerila), "gornji": [{"dio": redni broj dijela zgrade (2 = prvi dio iznad podnožja), "x0": lijevi rub tog dijela, "x1": desni rub tog dijela}] u udjelima širine pročelja kao x kod otvora (prazno ako zgrada ima jedan dio ili se gornji dio na tom pročelju ne vidi), "otvori": [{"x": položaj sredine otvora po širini TOG pročelja 0–1 (0 = lijevi rub zgrade, 1 = desni rub zgrade, kako je nacrtano), "parapet": visina donjeg ruba otvora od ±0,00 u m (za gornje etaže to je veliki broj, npr. +12,30), "sirina": m, "visina": m, "vrsta": "prozor" | "vrata" | "klizna"}]}], "napomena": "kratko"}.\nŠirina pročelja (x od 0 do 1) uvijek je cijela širina PODNOŽJA, i za prozore na uvučenim gornjim etažama. Izlozi i ostakljene stijene poslovnog prizemlja su "klizna" sa stvarnom širinom i visinom. Ako je na jednoj slici više pročelja, vrati svako kao zaseban zapis. Prije odgovora prebroji otvore na svakoj etaži i provjeri da su svi navedeni. Navedi sve prozore i vrata koje vidiš, svaku etažu posebno (balkonska vrata su "klizna" ako su šira od 1,6 m, inače "vrata"). Stranu odredi po nazivu pročelja (sjever/jug/istok/zapad uz oznaku sjevera na tlocrtu) ili po obliku zgrade.`, imgs, 'complex');
        const list = Array.isArray(fr2.procelja) ? fr2.procelja : [];
        // nacrtana širina pročelja u metrima (iz rubova na slici i mjerila stranice): razlikuje dulju od kraće strane zgrade
        list.forEach((f) => { const n = g[(Math.round(+f.slika) || 2) - 2] ?? g[0], mp = scaleOf(n), rb = Array.isArray(f.rubovi) ? f.rubovi.map(Number) : []; f.sirina_m = mp && rb.length === 2 && rb[1] - rb[0] > 0.05 && rb[1] <= 1.01 ? r2((rb[1] - rb[0]) * (memo.ebox[n][2] - memo.ebox[n][0]) * pageInfo[n].w * mp) : null; });
        memo.facs[key] = { list, note: fr2.napomena };
      } catch (e) { if (e?.code === 'not_granted') throw e; console.warn(e); failed.push(...g); }
    }
    hv.procelja = Object.values(memo.facs).flatMap((f) => f.list);
    hv.napomene = [...(Array.isArray(hv.napomene) ? hv.napomene : []), ...katNote, ...Object.values(memo.facs).map((f) => f.note).filter(Boolean), ...(failed.length ? [`otvore sa str. ${failed.join(', ')} nisam uspio pročitati (pokreni ponovno za dopunu)`] : [])];
    say('6/6: slažem model…');
    let z0 = num(hv.kotaPoda) || 0;
    { const hps = hv.procelja.map((f) => num(f.visinaPodnozja)).filter((v) => v > 2), Hp = hps.length ? Math.max(...hps) : 0, p0 = partsAi[0], h0 = (Array.isArray(p0.visineEtaza) ? p0.visineEtaza : []).map(num).filter((v) => v > 0), sum0 = h0.reduce((x, y) => x + y, 0), miss = Hp - sum0;
      if (sum0 > 0 && miss > 2.4 && miss < 9 && hps.filter((v) => v - sum0 > 2.4).length >= Math.min(2, hps.length)) { p0.visineEtaza = [r2(miss), ...h0]; p0.etaze = h0.length + 1; z0 = r2(z0 - miss); hv.napomene = [`najdonjem dijelu dodao sam donju etažu visine ${fq(r2(miss))} m: na pročeljima je vrh podnožja ${fq(r2(Hp))} m iznad terena, a iz presjeka je pročitano samo ${fq(r2(sum0))} m`, ...hv.napomene]; } }
    const ROOF = { ravni: 'flat', dvostresni: 'gable', cetverostresni: 'hip', jednostresni: 'mono' };
    const res = MD.resolveSpec(MD.normSpec({ fp: pts, roof: ROOF[hv.krov] || 'flat', ridgeDir: hv.smjerSljemena === 'lijevo-desno' ? 'x' : 'z', ridgeH: num(hv.visinaSljemena), ov: num(hv.prepust), z0,
      parts: partsAi.map((p, i) => ({ name: p.naziv, floors: num(p.etaze), heights: (Array.isArray(p.visineEtaza) ? p.visineEtaza : []).map(num).filter((v) => v > 0), wallTop: num(p.vrh), inset: i && p.uvlaka ? { g: num(p.uvlaka.gore), d: num(p.uvlaka.desno), dl: num(p.uvlaka.dolje), l: num(p.uvlaka.lijevo) } : null })).map((p, i) => {
        if (!katPart || i !== katI) return p;
        const q = { ...p, balconies: katPart.balconies }; if (!i) return q;
        // veličina i oblik s tlocrta kata; položaj iz ucrtanog podnožja ili s one strane na kojoj je AI vidio manju uvlaku
        const n = p.inset || { g: 0, d: 0, dl: 0, l: 0 }, lf = (n.l || 0) <= (n.d || 0), tp2 = (n.g || 0) <= (n.dl || 0), rw = Math.max(0, W - katPart.W), rdp = Math.max(0, D - katPart.D), al = Math.min(rw, lf ? n.l || 0 : rw - (n.d || 0)), ag = Math.min(rdp, tp2 ? n.g || 0 : rdp - (n.dl || 0));
        q.inset = katPart.inset || { l: r2(Math.max(0, al)), d: r2(rw - Math.max(0, al)), g: r2(Math.max(0, ag)), dl: r2(rdp - Math.max(0, ag)) };
        if (katPart.shape) q.shape = katPart.shape; return q;
      }),
      facades: (Array.isArray(hv.procelja) ? hv.procelja : []).map((f) => ({ side: f.strana, name: f.naziv, width: num(f.sirina_m), upper: (Array.isArray(f.gornji) ? f.gornji : []).map((u) => ({ part: num(u.dio), x0: num(u.x0), x1: num(u.x1) })).filter((u) => u.part >= 2 && u.x1 > u.x0),
        openings: (Array.isArray(f.otvori) ? f.otvori : []).map((o) => ({ x: num(o.x), s: num(o.parapet), w: num(o.sirina), h: num(o.visina), t: o.vrsta })) })) }));
    let spec = res.spec;
    { // mjera tlocrta koja nije potvrđena kotom (nečitljive kote na skenu) usklađuje se s nacrtanom širinom pročelja na toj strani
      const bb = MD.bbox({ fp: spec.fp }), fix = {};
      for (const [ax, dim, known] of [['W', bb.x1 - bb.x0, sw > 2], ['D', bb.z1 - bb.z0, sd > 2]]) {
        const ws = spec.facades.filter((f) => f.width > 2 && ((f.side === 'gore' || f.side === 'dolje') === (ax === 'W'))).map((f) => f.width); if (known || !ws.length) continue;
        const avg = ws.reduce((x, y) => x + y, 0) / ws.length, rel = avg / dim - 1;
        if (Math.abs(rel) > 0.03 && Math.abs(rel) < 0.2 && Math.max(...ws) / Math.min(...ws) < 1.04) { fix[ax] = r2(avg); res.notes.push(`${ax === 'W' ? 'širinu' : 'dubinu'} tlocrta (${fq(r2(dim))} m, bez čitljive kote) uskladio sam s nacrtanom širinom pročelja: ${fq(r2(avg))} m`); }
      }
      if (fix.W || fix.D) spec = MD.specWithDims(spec, fix);
    }
    const base = MD.modelFromAi(spec);
    pushUndo();
    if (P.model?.colors) base.colors = P.model.colors;
    P.modelSpec = spec; P.specManual = undefined; P.modelBase = undefined; P.modelType = 'ai'; P.modelDims = undefined; P.model = base; MD.applyBuild(P.model, P.build);
    // veća zgrada ili visoke etaže: zidana izvedba ne prolazi osnovna pravila, pa predlažem armirani beton i temeljnu ploču
    const nFl = MD.floorsAll(base), tall = nFl >= 4 || MD.quantities(base).hMax > 4;
    setBuild({ krovOblik: spec.roof, ...(tall && P.build.konstrukcija !== 'skelet' ? { konstrukcija: 'ab', temelji: 'ploca' } : {}) }, true);
    if (P.buildLinked) applySlots(MD.ALL_SLOTS);
    touch();
    const d = MD.modelDims(base), allV = MD.volsOf(base), nOps = allV.reduce((s0, v) => s0 + v.openings.length, 0), conf = Math.round(100 * Math.min(num(ob.pouzdanost) ?? 0.5, num(hv.pouzdanost) ?? 0.5)), notes = [ob.napomena, ...(Array.isArray(hv.napomene) ? hv.napomene : [])].filter(Boolean).map(String);
    const partLines = spec.parts.map((p, i) => `  ${i + 1}. ${p.name}: ${p.floors} ${p.floors === 1 ? 'etaža' : p.floors < 5 ? 'etaže' : 'etaža'}, visine ${p.heights.map((h) => fq(h)).join(' / ')} m${p.shape ? `, tlocrt s ${p.shape.length} uglova` : ''}${p.balconies?.length ? `, balkona na etaži: ${p.balconies.length} (${[...new Set(p.balconies.map((b) => b.rail === 'staklo' ? 'staklena ograda' : b.rail === 'metal' ? 'metalna ograda' : 'zidana ograda'))].join(', ')})` : ''}${p.inset ? `, uvučeno gore ${fq(p.inset.g)} · desno ${fq(p.inset.d)} · dolje ${fq(p.inset.dl)} · lijevo ${fq(p.inset.l)} m` : ''}`).join('\n');
    // kontrola potpunosti: što je pročitano, a što je završilo u modelu
    const nRead = spec.facades.reduce((a, f) => a + f.openings.length, 0), nDrop = MD.specStats(spec).dropped, bSeen = Math.max(0, ...hv.procelja.map((f) => num(f.balkona) || 0)), bMod = spec.parts.reduce((a, q) => a + (q.balconies?.length || 0), 0);
    const warn = [spec.facades.length && spec.facades.length < 4 ? `pročitana su samo ${spec.facades.length} pročelja od 4` : '', nDrop ? `${nDrop} pročitanih otvora nije našlo zid u modelu` : '', bSeen > 0 && !bMod ? `na pročeljima su vidljivi balkoni (do ${bSeen} na jednom pročelju), a u model nisu ušli: dodaj ih u Objekt i dimenzije ili ponovi čitanje` : ''].filter(Boolean);
    const kontrola = `• kontrola: pročelja ${spec.facades.length}/4, otvora pročitano ${nRead}, balkona u modelu ${bMod}${warn.length ? '\n• PROVJERI: ' + warn.join('; ') : ''}\n`;
    addMsg('assistant', `3D model je složen iz nacrta (AI prijedlog, provjeri ga):\n• tlocrt podnožja ${fq(d.W)} × ${fq(d.D)} m, ${base.fp.length} uglova (str. ${tp})\n• ${spec.parts.length > 1 ? 'dijelovi zgrade' : 'zgrada'} (ukupno ${MD.etaze(d.floors)}, visina ${fq(r2(MD.topOf(P.model)))} m):\n${partLines}\n• krov: ${MD.optOf('krovOblik', spec.roof).n.toLowerCase()}; ${spec.facades.length ? '' : 'u dokumentu nema pročelja, pa prozori i vrata nisu ucrtani (dodaj dokument s pročeljima i pokreni ponovno); '}${nOps} otvora s pročelja (${spec.facades.map((f) => `${String(f.name || 'pročelje').replace(/\s*PROČELJE\s*/i, '').toLowerCase() || 'pročelje'} = ${f.side}`).join(', ')})\n${res.notes.length ? '• usklađivanje nacrta: ' + res.notes.join('; ') + '\n' : ''}${kontrola}• pouzdanost oko ${conf} %${tall ? '\n• izvedbu sam postavio na armirani beton i temeljnu ploču (zidana ne prolazi osnovna pravila za ovu visinu); promijeni ako projekt kaže drukčije' : ''}${notes.length ? '\nNapomene: ' + notes.slice(0, 5).join(' · ') : ''}\n\nSvaki dio (etaže, visine, uvlake, balkone), strane pročelja i ukupne mjere ispravi u 3D prikaz → Izvedba i cijene → Objekt i dimenzije.`);
    aiReadLog({ ok: true, msg: P.chat[P.chat.length - 1]?.content || '', parts: spec.parts, sides: spec.facades.map((f) => ({ n: f.name, side: f.side, ai: f.sideAi, w: f.width, up: f.upper, ops: f.openings.length })), kat: memo.kat?.r || null, katBox: memo.kat?.box || null, fp: spec.fp, vols: MD.volsOf(P.model).map((v) => ({ fp: v.fp, ops: v.openings.length, bk: (v.balconies || []).length })) });
    if (!failed.length) delete aiMemo[P.docId];
    showView('3d');
  } catch (e) {
    console.warn(e); aiReadLog({ ok: false, err: String(e?.message || e), code: e?.code || null });
    addMsg('sys', e?.code === 'not_granted' ? 'AI nije dopušten u ovom prikazu. 3D model zadaj vrstom objekta i dimenzijama.' : e?.code === 'rate_limited' ? 'AI je trenutno zauzet (ograničenje broja upita). Pokušaj ponovno za minutu.' : `Nisam uspio složiti model (${e?.message || e}). Pokreni ponovno: koraci koji su uspjeli neće se ponavljati. Dimenzije možeš zadati i ručno.`);
  } finally { aiModelBusy = false; }
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
// kartica Izvedba: odluke o izvedbi s okvirnim cijenama za ovaj objekt + informativna statika
function izvedbaHtml() {
  const m = P.model, B = P.build, flat = B.krovOblik === 'flat';
  const grp = (k) => {
    const def = MD.OPT[k], cur = MD.optOf(k, B[k]);
    const opts = def.opts.filter((o) => k !== 'pokrov' || (flat ? o.ravni : o.kosi));
    const cost = (id) => MD.slotCost(m, { ...B, [k]: id }, MD.COST_OF[k]), c0 = cost(cur.id);
    return `<details class="ogrp" data-g="${k}" ${openGrp.has(k) ? 'open' : ''}><summary><span class="gn">${esc(def.n)}</span><span class="gv">${esc(cur.n)}</span><span class="gc">${k === 'staklo' || k === 'klizna' ? '' : eur0(c0)}</span></summary>
      <div class="opts">${opts.map((o) => { const c = cost(o.id), d = c - c0; return `<button class="opt" data-bk="${k}" data-bv="${o.id}" aria-pressed="${o.id === cur.id}">
        <span class="on">${esc(o.n)}${o.nacrt ? ' <i>nacrt</i>' : ''}</span><span class="pr">${o.id === cur.id ? eur0(c) : (d >= 0 ? '+ ' : '− ') + eur0(Math.abs(d))}</span>
        <span class="nt">${esc(o.note || '')}${o.p ? ` · ${fq(o.p)} €/${o.u}` : ''}</span></button>`; }).join('')}</div></details>`;
  };
  const st = MD.statika(m, B), ICON = { ok: '✓', warn: '!', bad: '✕', info: 'i' }, nW = st.checks.filter((c) => c.st === 'warn' || c.st === 'bad').length;
  return `
  <div class="box"><div style="display:flex;align-items:baseline;gap:8px"><h3>Izvedba</h3><span class="spacer"></span><button class="btn small" id="bUndo" ${undoStack.length ? '' : 'disabled'} title="Vrati zadnju promjenu izvedbe ili AI promjenu">↶ Vrati</button></div>
    ${P.buildLinked ? `<div class="bsum"><span>Stavke izvedbe u troškovniku</span><b>${eur0(buildCost())}</b></div><p class="note">Odaberi opciju: 3D model i stavke troškovnika odmah se zamijene. Cijene su okvirne tržišne (bez PDV-a) i čekaju tvoju potvrdu. Ručno upisane količine ostaju.</p>`
      : `<p class="note">Troškovnik još nema stavke izvedbe (iskop, temelji, zidovi, krov, fasada, stolarija). Mogu ih izračunati iz 3D modela.</p><button class="btn primary" id="bLink">Dodaj stavke izvedbe u troškovnik</button>`}</div>
  <div class="ogrps">${objektHtml()}${['tlo', 'temelji', 'konstrukcija', 'krovOblik', 'pokrov', 'fasada', 'stolarija', 'staklo', 'klizna'].map(grp).join('')}</div>
  ${m.roof?.note ? `<div class="warnbar">${esc(m.roof.note)}</div>` : ''}
  <div class="box stat lvl-${st.level}"><h3>Statika: ${st.level === 'ok' ? 'osnovna pravila zadovoljena' : nW + (nW === 1 ? ' upozorenje' : ' upozorenja')}</h3>
    <label class="note" for="szSel">Potresno područje: a_g·S (karta potresnih područja RH, povratno razdoblje 475 g.)</label>
    <select id="szSel" class="btn"><option value="">nije odabrano</option>${MD.OPT.seizmika.opts.map((o) => `<option value="${o.id}" ${B.seizmika === o.id ? 'selected' : ''}>${esc(o.n)}</option>`).join('')}</select>
    <ul class="chk">${st.checks.map((c) => `<li class="${c.st}"><span class="ic" aria-hidden="true">${ICON[c.st]}</span><div><b>${esc(c.n)}</b>: ${esc(c.v)}<span>${esc(c.req)}</span></div></li>`).join('')}</ul>
    <p class="note">Informativna provjera prema osnovnim pravilima normi HRN EN 1996-1-1 (ziđe), HRN EN 1992-1-1 (beton) i HRN EN 1998-1 (potres). Ne zamjenjuje statički proračun: konstrukciju mora dokazati i ovjeriti ovlašteni inženjer građevinarstva.</p></div>`;
}
/* ---------- BIM alati: etaže, presjek, prozirni prikaz, struktura modela, svojstva elementa ---------- */
// popis etaža svih dijelova zgrade s visinskim položajem
function bimStoreys() {
  const VV = MD.volsOf(P.model), out = [];
  VV.forEach((v, vi) => { const L = MD.levelsOf(v), H = MD.storeyHeights(v), y0 = v.y0 || 0; L.forEach((l, k) => out.push({ v, vi, k, y0: y0 + l, y1: y0 + l + H[k], h: H[k], n: `${VV.length > 1 ? (v.name || 'Dio ' + (vi + 1)) + ', ' : ''}${!vi && !k ? 'prizemlje' : (k + 1) + '. etaža'}` })); });
  return out;
}
function applyBim() {
  if (!V || !P.model) return;
  const S = bimStoreys(), s = bim.st != null ? S[bim.st] : null, bb = MD.bbox(P.model), top = MD.topOf(P.model);
  if (s) V.setClip({ y0: s.y0 - 0.02, y1: s.y1 - 0.32 });
  else if (bim.axis === 'x') V.setClip({ axis: 'x', pos: bb.x0 - 1 + bim.t * (bb.x1 - bb.x0 + 2) });
  else if (bim.axis === 'z') V.setClip({ axis: 'z', pos: bb.z0 - 1 + bim.t * (bb.z1 - bb.z0 + 2) });
  else if (bim.axis === 'y') V.setClip({ axis: 'y', pos: 0.4 + bim.t * (top + 0.4) });
  else V.setClip(null);
  V.setXray(bim.xray);
}
function modelHtml() {
  if (!P.model) return '<p class="note">Model još nije složen.</p>';
  const S = bimStoreys(), ar = (v) => Math.abs(MD.polyArea(v.fp));
  const rows = S.map((s, i) => {
    const v = s.v, E = MD.edges(v), l0 = s.y0 - (v.y0 || 0), ops = v.openings.filter((o) => o.s >= l0 - 0.05 && o.s < l0 + s.h - 0.05), cnt = (t) => ops.filter((o) => o.t === t).length;
    const per = E.reduce((a, e) => a + e.L, 0), wall = per * s.h - ops.reduce((a, o) => a + o.w * o.h, 0), bk = (v.balconies || []).filter((b) => b.ys.some((y) => Math.abs(y - l0) < 0.05)).length;
    const bits = [`zidovi ${fq(r2(wall))} m²`, `ploča ${fq(r2(ar(v)))} m²`, cnt('win') ? `prozora ${cnt('win')}` : '', cnt('door') ? `vrata ${cnt('door')}` : '', cnt('slide') ? `kliznih stijena ${cnt('slide')}` : '', bk ? `balkona ${bk}` : ''].filter(Boolean);
    return `<button class="bimrow" data-st="${i}" aria-pressed="${bim.st === i}"><b>${esc(s.n)}</b><span>visina ${fq(r2(s.h))} m · ${bits.join(' · ')}</span></button>`;
  }).join('');
  return `<div class="bimbox"><h4>Etaže</h4><p class="note">Klikni etažu da je izdvojiš: zgrada se prereže ispod stropa i vidiš raspored zidova i otvora.</p>
    <button class="bimrow" data-st="" aria-pressed="${bim.st == null}"><b>Cijela zgrada</b><span>${S.length} etaža · visina ${fq(r2(MD.topOf(P.model)))} m</span></button>${rows}
    <h4>Presjek</h4><div class="seg" id="bimAx">${[['', 'Bez'], ['x', 'Uzdužni'], ['z', 'Poprečni'], ['y', 'Vodoravni']].map(([k, n]) => `<button data-ax="${k}" aria-pressed="${(bim.axis || '') === k && bim.st == null}">${n}</button>`).join('')}</div>
    <input type="range" id="bimT" min="0" max="100" value="${Math.round(bim.t * 100)}" aria-label="Položaj presjeka" ${bim.axis && bim.st == null ? '' : 'disabled'}>
    <label class="chk"><input type="checkbox" id="bimX" ${bim.xray ? 'checked' : ''}> Prozirni prikaz (vidi se unutrašnjost)</label>
    <p class="note">Klikni prozor, vrata, zid ili balkon u 3D prikazu za njegove mjere, etažu i stavke troškovnika.</p></div>`;
}
function bindModel(side) {
  $$('[data-st]', side).forEach((b) => b.onclick = () => { bim.st = b.dataset.st === '' ? null : +b.dataset.st; applyBim(); renderSide3d(); if (bim.st != null && V) V.view('persp'); });
  $$('[data-ax]', side).forEach((b) => b.onclick = () => { bim.axis = b.dataset.ax || null; bim.st = null; applyBim(); renderSide3d(); });
  const t = $('#bimT', side); if (t) t.oninput = () => { bim.t = +t.value / 100; applyBim(); };
  const x = $('#bimX', side); if (x) x.onchange = () => { bim.xray = x.checked; applyBim(); };
}
// element modela na kliknutoj točki: balkon, otvor ili zid, s etažom
function elemAt(pt) {
  if (!pt || !P.model) return null;
  const [x, y, z] = pt; let best = null;
  MD.volsOf(P.model).forEach((v) => {
    if (best) return;
    const y0 = v.y0 || 0, E = MD.edges(v), L = MD.levelsOf(v), H = MD.storeyHeights(v), loc = (e) => { const n = MD.outward(v, e); return [(x - e.p[0]) * e.dx + (z - e.p[1]) * e.dz, (x - e.p[0]) * n[0] + (z - e.p[1]) * n[1]]; };
    const kOf = (yy) => { let k = 0; L.forEach((l, i) => { if (yy - y0 >= l - 0.05) k = i; }); return k; };
    for (const b of v.balconies || []) { const e = E[b.e]; if (!e) continue; const [al, ou] = loc(e), yy = b.ys.find((q) => y >= y0 + q - 0.45 && y <= y0 + q + 1.25); if (yy != null && Math.abs(al - b.u) <= b.w / 2 + 0.12 && ou >= -0.12 && ou <= b.d + 0.12) { best = { k: 'balkon', v, b, e, st: kOf(y0 + yy + 0.1) }; return; } }
    for (const o of v.openings) { const e = E[o.e]; if (!e) continue; const [al, ou] = loc(e); if (Math.abs(al - o.u) <= o.w / 2 + 0.15 && Math.abs(ou) < 0.7 && y >= y0 + o.s - 0.15 && y <= y0 + o.s + o.h + 0.15) { best = { k: 'otvor', v, o, e, st: kOf(y0 + o.s + 0.1) }; return; } }
    const top = y0 + L[L.length - 1] + H[H.length - 1];
    for (const e of E) { const [al, ou] = loc(e); if (al >= -0.2 && al <= e.L + 0.2 && Math.abs(ou) < 0.55 && y >= y0 - 0.1 && y <= top + 0.6) { best = { k: 'zid', v, e, st: kOf(y), h: H[kOf(y)] }; return; } }
  });
  return best;
}
function elemCard(pt) {
  const el = elemAt(pt); if (!el) return '';
  const v = el.v, VV = MD.volsOf(P.model), where = `${VV.length > 1 ? esc(v.name || 'dio zgrade') + ', ' : ''}${v === VV[0] && !el.st ? 'prizemlje' : (el.st + 1) + '. etaža'}`, lab = esc(String(v.labels?.[el.e.i] || 'pročelje').toLowerCase());
  const row = (a, b) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`; let t, r;
  if (el.k === 'otvor') { const o = el.o; t = o.t === 'door' ? 'Vrata' : o.t === 'slide' ? 'Klizna stijena / izlog' : 'Prozor'; r = row('Mjere (š × v)', `${fq(o.w)} × ${fq(o.h)} m`) + row('Površina', `${fq(r2(o.w * o.h))} m²`) + (o.t === 'win' ? row('Parapet', `${fq(r2(o.s - MD.levelsOf(v)[el.st]))} m`) : '') + row('Izvedba', esc(MD.optOf('stolarija', P.build.stolarija).n)); }
  else if (el.k === 'balkon') { const b = el.b; t = 'Balkon'; r = row('Mjere (š × istak)', `${fq(b.w)} × ${fq(b.d)} m`) + row('Površina', `${fq(r2(b.w * b.d))} m²`) + row('Ograda', b.rail === 'staklo' ? 'staklena' : b.rail === 'metal' ? 'metalna' : 'zidana') + row('Ponavlja se na etaža', String(b.ys.length)); }
  else { t = 'Vanjski zid'; r = row('Duljina', `${fq(r2(el.e.L))} m`) + row('Visina etaže', `${fq(r2(el.h))} m`) + row('Površina (bruto)', `${fq(r2(el.e.L * el.h))} m²`) + row('Konstrukcija', esc(MD.optOf('konstrukcija', P.build.konstrukcija).n)) + row('Fasada', esc(MD.optOf('fasada', P.build.fasada).n)); }
  return `<div class="elcard"><b>${t}</b> <span class="note">${where} · ${lab}</span><table>${r}</table></div>`;
}
function prikazHtml() {
  const m = P.model, C = m.colors;
  return `
  <div><h3>Pogled</h3><div class="viewgrid" style="margin-top:6px">${v3dViews().map(([k, l]) => `<button class="btn small" data-vw="${k}">${esc(l)}</button>`).join('')}</div>
    <p class="note" style="margin-top:6px">Mišem okreći model, kotačićem približi. Klikni dio kuće (krov, fasadu, prozor) i vidjet ćeš njegove stavke iz troškovnika.</p></div>
  <div class="box"><h3>Slike visoke rezolucije</h3>
    <label class="note" for="v3dRes">Rezolucija</label>
    <select id="v3dRes" class="btn"><option value="2560x1440" selected>2560 × 1440 (QHD)</option><option value="3200x1800">3200 × 1800 (najoštrije)</option><option value="1920x1080">1920 × 1080 (Full HD)</option></select>
    <button class="btn primary" id="v3dShot">Spremi trenutni pogled (PNG)</button>
    <button class="btn" id="v3dAll" title="Sprema sva pročelja i perspektivu, sliku po sliku">Spremi sve poglede</button></div>
  <div><h3>Boje</h3><div class="viewgrid" style="margin:6px 0 8px">${MD.COLOR_PRESETS.map((p, i) => `<button class="btn small" data-pre="${i}" title="${esc(p.n)}">${esc(p.n.split(' (')[0])}</button>`).join('')}</div>
    <div class="swatches">${COLOR_LBL.map(([k, l]) => `<label for="c_${k}"><input type="color" id="c_${k}" data-col="${k}" value="${esc(C[k] || MD.DEFAULT_COLORS[k])}">${l}</label>`).join('')}</div></div>
  <p class="note">Vrstu objekta i dimenzije mijenjaš u kartici Izvedba i cijene → Objekt i dimenzije.</p>`;
}
// novi model (dimenzije) → primijeni izvedbu i, ako je troškovnik povezan, preračunaj stavke izvedbe
function swapModel(nm) { const cols = P.model.colors; P.model = nm; P.model.colors = cols; MD.applyBuild(P.model, P.build); if (P.buildLinked) applySlots(MD.ALL_SLOTS); touch(false); }
function renderSide3d() {
  const side = $('#v3dSide'), keep = side.scrollTop;
  side.innerHTML = `<div class="seg sidetabs" role="tablist"><button role="tab" data-tab="izvedba" aria-pressed="${sideTab === 'izvedba'}">Izvedba i cijene</button><button role="tab" data-tab="model" aria-pressed="${sideTab === 'model'}">Model</button><button role="tab" data-tab="prikaz" aria-pressed="${sideTab === 'prikaz'}">Prikaz</button></div>` + (sideTab === 'izvedba' ? izvedbaHtml() : sideTab === 'model' ? modelHtml() : prikazHtml());
  if (sideTab === 'model') bindModel(side);
  side.scrollTop = keep;
  $$('[data-tab]', side).forEach((b) => b.onclick = () => { sideTab = b.dataset.tab; renderSide3d(); side.scrollTop = 0; });
  if (sideTab === 'izvedba') {
    $$('details.ogrp', side).forEach((d) => d.ontoggle = () => { d.open ? openGrp.add(d.dataset.g) : openGrp.delete(d.dataset.g); });
    $$('[data-bk]', side).forEach((b) => b.onclick = () => {
      const n = setBuild({ [b.dataset.bk]: b.dataset.bv }), o = MD.optOf(b.dataset.bk, b.dataset.bv);
      renderSide3d(); renderStages3d(); renderCounts();
      if (n) toast(`${o.n}: zamijenjeno ${n} ${n === 1 ? 'stavka' : 'stavki'} u troškovniku.`);
    });
    bindObjekt(side);
    $('#szSel').onchange = (e) => { setBuild({ seizmika: e.target.value || null }); renderSide3d(); };
    $('#bUndo').onclick = () => undoLast();
    const bl = $('#bLink'); if (bl) bl.onclick = () => { pushUndo(); P.buildLinked = true; if (!P.items.some((i) => i.slot === 'arm')) P.items.push({ id: uid(), group: 'g03', desc: 'Armatura B500B, dobava, savijanje i postava', unit: 'kg', qty: 0, price: MD.PRICE.armatura, priceSrc: 'kat', phase: 'konstrukcija', status: 'ai', qtyMode: 'manual', basis: '', slot: 'arm', key: 'armatura' }); const n = applySlots(MD.ALL_SLOTS); touch(); renderSide3d(); renderStages3d(); toast(`Dodano ${n} stavki izvedbe kao AI prijedlozi.`); };
    return;
  }
  if (sideTab !== 'prikaz') return;
  $$('[data-vw]').forEach((b) => b.onclick = () => V.view(isNaN(+b.dataset.vw) ? b.dataset.vw : +b.dataset.vw));
  $$('[data-pre]').forEach((b) => b.onclick = () => { V.setColors(MD.COLOR_PRESETS[b.dataset.pre].c); touch(false); renderSide3d(); });
  $$('[data-col]').forEach((inp) => inp.oninput = () => { clearTimeout(inp._t); inp._t = setTimeout(() => { V.setColors({ [inp.dataset.col]: inp.value }); touch(false); }, 30); });
  $('#v3dShot').onclick = () => shot3d(null);
  $('#v3dAll').onclick = () => shotAll3d();
}
function undoLast() {
  const s0 = undoStack.pop(); if (!s0) return;
  restore(s0); touch(); toast('Vraćeno prethodno stanje.');
  renderAll();
}
function bboxW(m) { const xs = m.fp.map((p) => p[0]); return r2(Math.max(...xs) - Math.min(...xs)); }
function bboxD(m) { const zs = m.fp.map((p) => p[1]); return r2(Math.max(...zs) - Math.min(...zs)); }
function show3dInfo(part, pt) {
  const box = $('#v3dInfo');
  if (!part || !PARTS3D[part]) { box.hidden = true; return; }
  const card = elemCard(pt);
  const def = PARTS3D[part], its = P.items.filter(def.f), sum = its.reduce((a, i) => a + (i.qty || 0) * (i.price || 0), 0);
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b>${esc(def.n)}</b><span class="spacer"></span><button class="icon-btn" id="v3dInfoX" aria-label="Zatvori">×</button></div>${card}
  ${its.length ? `<table>${its.map((i) => `<tr><td>${esc(i.desc)} ${i.status === 'ai' ? '<span class="pill ai">AI</span>' : ''}</td><td class="n">${fq(i.qty)} ${esc(i.unit)}</td><td class="n">${i.price ? nf2.format((i.qty || 0) * i.price) + ' €' : '–'}</td></tr>`).join('')}</table>
  <div style="display:flex;justify-content:space-between"><span class="note">${its.length} stavki</span><b>${sum ? eur(sum) + ' bez PDV-a' : 'cijene nisu upisane'}</b></div>` : '<p class="note">U troškovniku još nema stavki za ovaj dio.</p>'}
  <div style="display:flex;gap:6px;flex-wrap:wrap">${def.bk ? '<button class="btn small primary" id="v3dOpt">Promijeni izvedbu</button>' : ''}<button class="btn small" id="v3dGoT">Otvori u troškovniku</button><button class="btn small ai" id="v3dAskAi">Pitaj AI</button></div>`;
  const bo = $('#v3dOpt'); if (bo) bo.onclick = () => { sideTab = 'izvedba'; openGrp.add(def.bk); renderSide3d(); const d = $(`details.ogrp[data-g="${def.bk}"]`); if (d) d.scrollIntoView({ block: 'nearest' }); };
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
  { t: 'Složi 3D iz nacrta', run: () => aiBuildModel() },
  { t: 'Izvedba i statika', run: () => { sideTab = 'izvedba'; showView('3d'); } },
  { t: 'Promijeni izvedbu…', fill: 'Promijeni izvedbu: ' },
  { t: 'Prikaži 3D', run: () => { sideTab = 'prikaz'; showView('3d'); } },
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
  return P.items.map((i) => ({ id: i.id, rb: rb[i.id], grupa: groupOf(i.group).n, opis: i.desc, jed: i.unit, kolicina: i.qty, cijena: i.price, faza: i.phase, status: i.status, izvedba: !!i.slot }));
}
function systemPrompt() {
  const t = totals();
  return `Ti si AI asistent u građevinskom programu za izradu troškovnika i ugovora (Hrvatska, EU). Korisnik je ${role === 'izvodjac' ? 'IZVOĐAČ radova (upisuje jedinične cijene, radi ponudu i ugovor)' : 'PROJEKTANT (radi opise stavki i količine, projektantski troškovnik)'}.
Odgovaraj kratko, na hrvatskom. Kad korisnik traži promjenu troškovnika (dodaj, promijeni, obriši, cijena, faza), ODMAH je napravi alatima, a u odgovoru kratko reci što si napravio. Sve što ti dodaš ili promijeniš ostaje označeno kao AI prijedlog dok korisnik ne potvrdi.
Pravila: količine računaj iz podataka s nacrta (kote, površine, sastavi slojeva) i UVIJEK upiši obrazloženje izračuna u polje "obrazlozenje". Ako podatak ne možeš pouzdano odrediti, upiši količinu 0 i u obrazloženju reci kako je izmjeriti. Ne izmišljaj: jasno razlikuj izračun od procjene. Cijene su u EUR bez PDV-a (PDV 25 %). Ne obećavaj pravnu valjanost ugovora.
Vrste radova (grupa): ${GROUPS.map((g) => g.id + ' = ' + g.n).join('; ')}.
Faze: ${P.phases.map((p) => p.id + ' = ' + p.n).join('; ')}.
Projekt: "${P.name}". Građevina: ${P.meta.gradjevina || 'nije upisano'}. Lokacija: ${P.meta.lokacija || 'nije upisano'}.
Dokumenti projekta: ${P.docs.map((d) => d.name + (d.id === P.docId ? ' (otvoren)' : '')).join('; ') || 'nema'}. 3D model iz nacrta slaže se gumbom „AI: složi 3D model iz nacrta” (ti ga ne možeš pokrenuti alatom).\nObjekt (alat model_3d mijenja vrstu i dimenzije): ${P.model ? typeOf().n + ', ' + Object.entries(MD.modelDims(P.model)).map(([k, v]) => k + '=' + v).join(', ') : '3D model još ne postoji'}.
Izvedba (alat odaberi_izvedbu mijenja 3D model i pripadne stavke s okvirnim cijenama): ${MD.BUILD_KEYS.map((k) => k + '=' + P.build[k]).join(', ')}, seizmika=${P.build.seizmika || 'nije odabrano'}. Provjera statike u programu je informativna: uvijek napomeni da konstrukciju dokazuje ovlašteni statičar; šuplja opeka s vodoravnim šupljinama nije nosiva u potresnom području.
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
    { name: 'model_3d', description: 'Promijeni 3D prikaz objekta: boje (hex, npr. #d9d8d4) za fasada, cokl, krov, stolarija, limarija, teren; ili vrsta objekta (tip: ' + MD.TYPES.map((t) => t.id + ' = ' + t.n).join(', ') + ') i dimenzije (sirina, dubina, etaze, visinaEtaze, nagib, prepust). Dimenzije vrijede i za model iz nacrta; stavke izvedbe u troškovniku se preračunaju.', inputSchema: { type: 'object', properties: { tip: { type: 'string' }, boje: { type: 'object', properties: { fasada: { type: 'string' }, cokl: { type: 'string' }, krov: { type: 'string' }, stolarija: { type: 'string' }, limarija: { type: 'string' }, teren: { type: 'string' } } }, dimenzije: { type: 'object', properties: { sirina: { type: 'number' }, dubina: { type: 'number' }, etaze: { type: 'number' }, visinaEtaze: { type: 'number' }, nagib: { type: 'number' }, prepust: { type: 'number' } } } } },
      execute: async (a = {}) => { ensureModel();
        if (a.tip && MD.TYPES.some((t) => t.id === a.tip && (!t.demo || hasDemo()) && (!t.ai || P.modelBase || P.modelSpec))) { setObjekt(a.tip); undoStack.pop(); aiLog.push('3D: vrsta objekta ' + typeOf().n); }
        if (a.dimenzije) { const d = a.dimenzije, nd = { W: d.sirina, D: d.dubina, floors: d.etaze, storeyH: d.visinaEtaze, pitch: d.nagib, ov: d.prepust }; Object.keys(nd).forEach((k) => nd[k] == null && delete nd[k]); const n = setObjekt(null, nd); undoStack.pop(); aiLog.push('3D: dimenzije ' + JSON.stringify(curDims()) + (n ? ` (${n} stavki izvedbe preračunato)` : '')); }
        if (a.boje && P.model) { Object.entries(a.boje).forEach(([k, v]) => { if (/^#[0-9a-f]{6}$/i.test(v)) P.model.colors[k] = v; }); aiLog.push('3D: boje ' + Object.keys(a.boje).join(', ')); }
        touch(); if (V && P.model) { if (V.model !== P.model) V.build(P.model, P.build); else V.setColors({}); if (view === '3d') renderSide3d(); } return P.model ? { ok: true, tip: P.modelType, dimenzije: curDims(), boje: P.model.colors } : { greska: '3D model još ne postoji: pošalji tip ili dimenzije, ili neka korisnik pokrene „AI: složi 3D model iz nacrta”.' }; } },
    { name: 'odaberi_izvedbu', description: 'Izvedba objekta: temelji, konstrukcija, krov, fasada, stolarija. Pošalji samo polja koja mijenjaš; bez polja vraća trenutno stanje. Mijenja 3D model i pripadne stavke troškovnika (okvirne cijene, AI prijedlog). Vrijednosti: ' + [...MD.BUILD_KEYS, 'seizmika'].map((k) => k + ': ' + MD.OPT[k].opts.map((o) => o.id + ' (' + o.n + ')').join(' | ')).join('; ') + '. Vraća odabir, okvirni trošak stavki izvedbe i informativnu provjeru statike.', inputSchema: { type: 'object', properties: Object.fromEntries([...MD.BUILD_KEYS, 'seizmika'].map((k) => [k, { type: 'string' }])) },
      execute: (a = {}) => { if (!ensureModel()) return { greska: '3D model još ne postoji. Korisnik ga slaže gumbom „AI: složi 3D model iz nacrta” u kartici 3D prikaz ili alatom model_3d (tip + dimenzije).' }; const patch = {}; [...MD.BUILD_KEYS, 'seizmika'].forEach((k) => { if (a[k] != null && MD.OPT[k].opts.some((o) => o.id === a[k])) patch[k] = a[k]; });
        const before = undoStack.length, n = Object.keys(patch).length ? setBuild(patch) : 0; if (undoStack.length > before) undoStack.pop(); // poništavanje ide preko AI koraka
        if (Object.keys(patch).length) aiLog.push('⚙ izvedba: ' + Object.entries(patch).map(([k, v]) => MD.OPT[k].n + ' → ' + MD.optOf(k, v).n).join('; ') + (n ? ` (${n} stavki)` : ''));
        if (view === '3d') { renderSide3d(); renderStages3d(); }
        const st = MD.statika(P.model, P.build);
        return { izvedba: Object.fromEntries([...MD.BUILD_KEYS, 'seizmika'].map((k) => [k, P.build[k] ? MD.optOf(k, P.build[k]).n : null])), stavke_izvedbe_eur_bez_pdv: Math.round(buildCost()), povezano_s_troskovnikom: !!P.buildLinked, statika: { ocjena: st.level, provjere: st.checks.map((c) => `${c.st}: ${c.n}: ${c.v} (${c.req})`) }, napomena: 'Provjera statike je informativna; konstrukciju dokazuje ovlašteni inženjer.' }; } },
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
  pushUndo();
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
  if (aiLog.length) { renderCounts(); if (view === 'troskovnik') renderTroskovnik(); if (view === 'ugovor') renderUgovor(); if (view === 'nacrt') renderMPanel(); if (view === '3d') render3D(); }
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
    restore(s);
    addMsg('sys', 'Vraćeno stanje prije zadnje promjene.'); touch(); renderAll();
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
async function switchDoc(id) {
  if (id === P.docId && pdfDoc) return;
  P.docId = id; linkDoc(P); cancelDraw(); await loadPdfForProject(); touch(false); renderAll();
}
function removeDoc(id) {
  const d = P.docs.find((x) => x.id === id); if (!d) return;
  const nm = P.meas.filter((m) => m.doc === id).length;
  confirmModal('Ukloniti dokument iz projekta?', `${d.name}${nm ? ` · briše se i ${nm} izmjera s tog dokumenta` : ''}. Stavke troškovnika i 3D model ostaju.`, 'Ukloni', async () => {
    const touched = new Set(P.meas.filter((m) => m.doc === id).map((m) => m.itemId));
    P.meas = P.meas.filter((m) => m.doc !== id); P.docs = P.docs.filter((x) => x.id !== id);
    P.items.forEach((it) => { if (touched.has(it.id)) recalcItem(it); });
    if (P.docId === id) { P.docId = P.docs[0]?.id || null; linkDoc(P); await loadPdfForProject(); }
    touch(); renderAll();
  });
}
async function onPdfFile(file) {
  if (!file) return;
  const buf = await file.arrayBuffer();
  let stored = null;
  if (cap.assets) { try { setSave('Spremam nacrt…'); stored = await cap.assets.upload(new Blob([buf], { type: 'application/pdf' })); } catch (e) { console.warn(e); } }
  // novi dokument se DODAJE na popis; postojeći nacrti, mjerila i izmjere ostaju
  const d = { id: uid(), name: file.name, pageScale: {}, ...(stored ? { url: stored.url, assetId: stored.id } : { session: true }) };
  if (!stored) { sessionPdf[d.id] = buf.slice(0); toast('Nacrt je otvoren, ali nije spremljen: sljedeći put ga učitaj ponovno.', 4000); }
  P.docs.push(d); P.docId = d.id; linkDoc(P);
  if (!stored) pdfDoc = await pdfjsLib.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise;
  else await loadPdfForProject();
  if (!stored) await analyzeAllPages();
  curPage = 1; zoom = 0; touch(); showView('nacrt');
  addMsg('assistant', `Učitan je nacrt „${file.name}” (${pdfDoc.numPages} str.). ${Object.keys(P.pageScale).length ? 'Mjerilo sam pročitao iz zaglavlja.' : 'Mjerilo nisam našao: postavi ga alatom Mjerilo.'} Klikni „Predloži količine s nacrta” i predložit ću stavke za odabranu stranicu.${P.model ? '' : ' Za 3D prikaz otvori karticu 3D prikaz i pokreni „AI: složi 3D model iz nacrta”.'}`);
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
  if (sample) { try { const lim = await sample.limits(); cap.imagesOk = !!lim?.images; cap.maxImages = Math.max(1, Math.min(4, +(lim?.maxImages ?? lim?.images?.max ?? lim?.images?.maxPerCall ?? 4) || 4)); } catch {} } else $('#aiState').textContent = 'nije dostupan';
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
// Testni način: projekti navedeni u dokumentu `aitest` čitaju se jedan po jedan, a rezultat ide u dnevnik `ailog_<projekt>`.
// Služi provjeri AI čitanja na više stvarnih nacrta nakon svake izmjene programa.
async function runAiTests() {
  if (!cap.db || !cap.uid || !cap.sample) return;
  const ref = cap.db.collection('data/users/' + cap.uid).doc('aitest'); let t;
  try { const s = await ref.get(); if (!s.exists) return; t = JSON.parse(JSON.stringify(s.data())); } catch { return; } // kopija: podaci iz baze mogu biti nepromjenjivi
  if (!Array.isArray(t.queue) || !t.queue.length) return;
  const back = P.id;
  while (t.queue.length) {
    const id = t.queue[0]; let ok = false;
    try { await saveNow(); await openProject(id); if (P.id === id && pdfDoc) { await aiBuildModel(); await saveNow(); ok = true; } } catch (e) { console.warn(e); }
    t.queue = t.queue.slice(1); t.done = [...(t.done || []), { id, ok, t: Date.now() }]; try { await ref.set(t); } catch (e) { console.warn(e); }
  }
  if (back && back !== P.id) await openProject(back);
}
boot().then(runAiTests);
