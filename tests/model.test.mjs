// Stalna provjera modela na stvarnoj zgradi (poslovno-stambena, podnožje L-oblika + stambeni dio s krilom i balkonima).
// Mjere u fixtures/ su ručno očitane s nacrta (tlocrt 1. kata i četiri pročelja). Pokretanje: node tests/model.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as MD from '../web/model.js';

const spec = JSON.parse(fs.readFileSync(new URL('./fixtures/poslovno-stambena-kastav.json', import.meta.url), 'utf8'));
const r = MD.resolveSpec(spec), m = MD.modelFromAi(r.spec), V = MD.volsOf(m), Q = MD.quantities(m);

// usklađivanje ne smije kvariti točno očitanje
assert.equal(r.changed, false, 'točan opis zgrade mora ostati nepromijenjen');
assert.deepEqual(r.spec.facades.map((f) => f.side), ['dolje', 'lijevo', 'desno', 'gore']);
// dijelovi: podnožje (6 uglova), stambeni dio (12 uglova, na svom mjestu), izlaz na krov
assert.equal(V.length, 3); assert.equal(V[0].fp.length, 6); assert.equal(V[1].fp.length, 12);
assert.deepEqual(V[1].fp[0], [0, 0]); assert.ok(Math.abs(V[1].fp[8][0] - 16.1) < 0.05 && V[1].fp[8][1] === 18.85);
assert.equal(V[1].y0, 10.54); assert.ok(Math.abs(MD.topOf(m) - 22.49) < 0.05);
// balkoni: četiri po etaži, staklena ograda, na pravim rubovima
assert.equal(V[1].balconies.length, 4); assert.ok(V[1].balconies.every((b) => b.rail === 'staklo' && Math.abs(b.d - 2.4) < 0.01));
assert.deepEqual(V[1].balconies.map((b) => b.e), [10, 8, 5, 5]);
assert.ok(Math.abs(Q.balcA - 120.2) < 1 && Math.abs(Q.railGlass - 107.7) < 1);
// otvori: gotovo svi moraju naći zid
const ops = V.reduce((s, v) => s + v.openings.length, 0); assert.ok(ops >= 58, 'otvora na zidovima: ' + ops);
// krivo očitane strane pročelja moraju se ispraviti iz širina pročelja i položaja gornjeg dijela na tlocrtu
// (ako je i položaj na tlocrtu krivo očitan, kraće strane ostaju zrcalno dvoznačne: to rješava tek tlocrt kata)
const bad = JSON.parse(JSON.stringify(spec)); bad.facades.forEach((f) => { f.side = 'gore'; });
const rb = MD.resolveSpec(bad);
assert.deepEqual(rb.spec.facades.map((f) => f.side), ['dolje', 'lijevo', 'desno', 'gore']);
assert.deepEqual(rb.spec.parts[1].inset, { g: 0, d: 23.4, dl: 8.15, l: 0 });
// tlocrt kata → oblik i balkoni
const k = MD.katToPart([[5, 3], [28.9, 3], [28.9, 13.85], [5, 13.85]], [{ box: [8.65, 13.85, 12.8, 16.25], rail: 'metal' }]);
assert.equal(k.W, 23.9); assert.equal(k.shape, null); assert.equal(k.balconies[0].side, 'dolje'); assert.ok(Math.abs(k.balconies[0].d - 2.4) < 0.01);
// stavke troškovnika
const items = MD.buildItems(m, { ...MD.DEFAULT_BUILD, krovOblik: 'flat', pokrov: 'sljunak', konstrukcija: 'ab', temelji: 'ploca' });
assert.ok(items.some((i) => i.key === 'balkoni') && items.some((i) => i.key === 'ogradaStaklo') && items.some((i) => i.key === 'terasa'));
console.log('model: sve provjere prolaze (' + ops + ' otvora, ' + Q.balcN + ' balkona)');
