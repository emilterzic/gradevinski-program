// Zemljani radovi: građevinska jama (obujam, prateći radovi) i čitanje dubine iz upisa ili govora.
// Pokretanje: node tests/iskop.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as MD from '../web/model.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} ≠ ${b}`);

// 1. jama ispod pravokutnog tlocrta 10 × 8 m (ručni račun)
const m = { fp: [[0, 0], [10, 0], [10, 8], [0, 8]] };
near(MD.pitGeom(m, { d: 1.73, rp: 0, n: 0 }).V, 80 * 1.73, 'okomite stranice bez radnog prostora');
let g = MD.pitGeom(m, { d: 2, rp: 0.5, n: 0 }); near(g.Ab, 99, 'dno s radnim prostorom 0,5 m'); near(g.V, 198, 'obujam');
g = MD.pitGeom(m, { d: 2, rp: 0.5, n: 1 }); near(g.At, 15 * 13, 'vrh jame s pokosom 1:1'); near(g.V, 2 / 6 * (99 + 4 * 13 * 11 + 195), 'krnja piramida (prizmoidna formula je za nju točna)');
// 2. prateći radovi
g = MD.pitGeom(m, { d: 2, rp: 0.5, n: 0, sl: 0.3, dren: true });
near(g.Vsl, 29.7, 'šljunak = dno × debljina'); near(g.Vzat, 198 - 160 - 19 * 0.3, 'zatrpavanje = jama − objekt − šljunak izvan tlocrta'); near(g.Vodvoz, 198 - g.Vzat, 'odvoz bez materijala za zatrpavanje'); near(g.per0, 36, 'drenaža po opsegu');
near(MD.pitGeom(m, { d: 2, rp: 0, n: 0 }).Vzat, 0, 'bez radnog prostora nema zatrpavanja');
// 3. razvedeni tlocrt (L), oba smjera obilaska
const L = [[0, 0], [12, 0], [12, 6], [6, 6], [6, 10], [0, 10]];
near(MD.pitGeom({ fp: L }, { d: 1, rp: 1 }).Ab, 96 + 44 + 4, 'L tlocrt: A + opseg × d + 4d²'); near(MD.pitGeom({ fp: [...L].reverse() }, { d: 1, rp: 1 }).Ab, 144, 'obrnuti smjer');
// 4. granice i prazno stanje
assert.equal(MD.normIskop(null), null); assert.equal(MD.normIskop({ d: 0 }), null); assert.equal(MD.normIskop({ d: 99 }).d, 15); assert.equal(MD.normIskop({ d: '1.734' }).d, 1.73);
// 5. stavke: sa zadanom jamom iskop slijedi dubinu, bez nje vrstu temelja
const km = MD.autoModel('kuca', { W: 10, D: 8, floors: 1 });
const it = MD.buildItems(km, MD.DEFAULT_BUILD, { d: 2, sl: 0.3, dren: true, rast: 1.3 }).filter((i) => i.slot === 'iskop');
assert.deepEqual(it.map((i) => i.key), ['iskop', 'odvoz', 'nasip', 'zatrpavanje', 'drenaza']); assert.match(it[0].desc, /dubine 2 m/); near(it[0].qty, 198, 'količina iskopa'); near(it[1].qty, Math.round((198 - 32.3) * 1.3 * 100) / 100, 'odvoz s upisanom rastresitošću');
assert.equal(it[3].price, null, 'zatrpavanje nema katalošku cijenu: upisuje je firma');
assert.deepEqual(MD.buildItems(km, MD.DEFAULT_BUILD).filter((i) => i.slot === 'iskop').map((i) => i.key), ['iskop', 'odvoz']);

// 6. dubina iz upisa ili govora
const src = fs.readFileSync(join(root, 'web/app.js'), 'utf8'), a = src.indexOf('const BROJ = {'), b = src.indexOf('function parseNum(v)', a);
const parseDubina = new Function(src.slice(a, b) + '; return parseDubina;')();
const T = [['1,73', 1.73], ['1.73', 1.73], ['1,73 m', 1.73], ['1.73m', 1.73], ['173 cm', 1.73], ['173cm', 1.73], ['173', 1.73], ['2', 2], ['2 m', 2], ['dva metra', 2], ['metar', 1], ['jedan metar', 1], ['metar i pol', 1.5], ['metar i po', 1.5], ['dva i pol', 2.5], ['2 metra i pol', 2.5], ['pola metra', 0.5],
  ['metar i 73', 1.73], ['metar sedamdeset tri', 1.73], ['metar i sedamdeset i tri', 1.73], ['jedan metar i sedamdeset tri centimetra', 1.73], ['1 m 73', 1.73], ['2 m 30 cm', 2.3], ['dva osamdeset', 2.8], ['jedan zarez sedam', 1.7], ['1 zarez 73', 1.73], ['tri metra', 3], ['dubina iskopa metar i pol', 1.5], ['iskop 2 metra', 2], ['Dubina je 1,73 metra.', 1.73], ['osamdeset centimetara', 0.8], ['80 cm', 0.8], ['0,8', 0.8], ['15', 15], ['16', 0.16], ['metar i dvadeset', 1.2], ['dva metra i pet centimetara', 2.05],
  ['', null], ['bok', null], ['metar ili dva', null], ['1,7 3', null]];
for (const [t, e] of T) { const v = parseDubina(t); if (e === null) assert.equal(v, null, `„${t}” nije dubina`); else near(v, e, `„${t}”`); }
console.log(`iskop: sve provjere prolaze (jama, prateći radovi, ${T.length} primjera dubine)`);
