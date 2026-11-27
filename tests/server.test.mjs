// Provjera poslužiteljskog dijela: prijava, valjanost, administrator, odvojenost podataka. Pokretanje: node tests/server.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../server/worker.js';
import { makeEnv } from './d1shim.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), env = makeEnv(join(root, 'server/schema.sql'), join(root, 'web'));
const key = (u, p) => createHash('sha256').update(u.toLowerCase() + '|' + p).digest('hex'); // u testu zamjena za rastezanje u pregledniku
const O = 'https://bis.test';
async function call(path, { method = 'GET', body, cookie, origin, accept, raw, ip } = {}) {
  const h = { accept: accept || 'application/json' }; if (cookie) h.cookie = cookie; if (origin) h.origin = origin; if (ip) h['cf-connecting-ip'] = ip;
  if (body !== undefined && !raw) h['content-type'] = 'application/json';
  const r = await worker.fetch(new Request(O + path, { method, headers: h, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' }), env);
  const sc = r.headers.get('set-cookie'); return { status: r.status, loc: r.headers.get('location'), cookie: sc ? sc.split(';')[0] : null, r, json: async () => r.json() };
}
const login = async (u, p, ip) => call('/api/login', { method: 'POST', body: { username: u, key: key(u, p) }, ip });
let t;
// 1. bez korisnika: sve vodi na postavljanje
t = await call('/', { accept: 'text/html' }); assert.equal(t.status, 302); assert.ok(t.loc.endsWith('/login'));
t = await call('/login', { accept: 'text/html' }); assert.ok(t.loc.endsWith('/setup'));
assert.equal((await call('/app.js')).status, 401, 'program se ne isporučuje bez prijave');
assert.equal((await call('/api/docs')).status, 401);
assert.equal((await call('/api/setup', { method: 'POST', body: { username: 'Emil', name: 'Emil', key: key('emil', 'tajna-lozinka') } })).status, 200);
assert.equal((await call('/api/setup', { method: 'POST', body: { username: 'drugi', key: key('drugi', 'x') } })).status, 403, 'drugo postavljanje nije moguće');
// 2. prijava administratora
assert.equal((await login('emil', 'kriva')).status, 401);
const A = (await login('EMIL', 'tajna-lozinka')).cookie; assert.ok(A && A.startsWith('bis_s='));
t = await (await call('/api/me', { cookie: A })).json(); assert.equal(t.role, 'admin'); assert.equal(t.modes.length, 4);
t = await call('/', { cookie: A, accept: 'text/html' }); assert.equal(t.status, 200); assert.match(await t.r.text(), /BIS građevinski program/);
assert.equal((await call('/admin', { cookie: A, accept: 'text/html' })).status, 200);
// 3. novi korisnik s jednom vrstom programa
const mk = (u, extra = {}) => call('/api/admin/users', { method: 'POST', cookie: A, body: { username: u, name: 'Krov d.o.o.', company: 'Krov', key: key(u, 'lozinka123'), months: 1, modes: ['krov'], ...extra } });
assert.equal((await mk('krov@firma.hr')).status, 200); assert.equal((await mk('krov@firma.hr')).status, 409);
assert.equal((await mk('ana', { modes: ['gradnja', 'stolarija'] })).status, 200);
const U = (await login('krov@firma.hr', 'lozinka123')).cookie, U2 = (await login('ana', 'lozinka123')).cookie; assert.ok(U && U2);
t = await (await call('/api/me', { cookie: U })).json(); assert.deepEqual(t.modes, ['krov']); assert.ok(t.validUntil > new Date().toISOString().slice(0, 10));
assert.equal((await call('/api/admin/users', { cookie: U })).status, 403); assert.equal((await call('/admin', { cookie: U, accept: 'text/html' })).status, 302);
// 4. dokumenti: veliki projekt u dijelovima, odvojenost po korisniku
const big = { name: 'Projekt č', updatedAt: 123, data: { txt: 'šđčćž'.repeat(300000) } };
assert.equal((await call('/api/docs/p_abc', { method: 'PUT', cookie: U, body: big })).status, 200);
t = await (await call('/api/docs/p_abc', { cookie: U })).json(); assert.equal(t.exists, true); assert.deepEqual(t.data, big);
t = await (await call('/api/docs', { cookie: U })).json(); assert.deepEqual(t.docs, [{ id: 'p_abc', name: 'Projekt č', updatedAt: 123 }]);
assert.equal((await (await call('/api/docs/p_abc', { cookie: U2 })).json()).exists, false, 'drugi korisnik ne vidi tuđi projekt');
assert.equal((await (await call('/api/docs', { cookie: U2 })).json()).docs.length, 0);
await call('/api/docs/p_abc', { method: 'PUT', cookie: U, body: { name: 'manji', updatedAt: 5 } });
assert.deepEqual((await (await call('/api/docs/p_abc', { cookie: U })).json()).data, { name: 'manji', updatedAt: 5 }, 'manji zapis prebriše sve dijelove');
// 5. datoteke
const bin = new Uint8Array(2500000); for (let i = 0; i < bin.length; i++) bin[i] = (i * 31) & 255;
t = await (await call('/api/files', { method: 'POST', cookie: U, body: bin, raw: true })).json(); assert.match(t.url, /^\/api\/files\/f_/);
const back = new Uint8Array(await (await call(t.url, { cookie: U })).r.arrayBuffer()); assert.equal(back.length, bin.length); assert.ok(back.every((v, i) => v === bin[i]));
assert.equal((await call(t.url, { cookie: U2 })).status, 404, 'drugi korisnik ne može do tuđeg nacrta');
// 6. isključenje, istek, produljenje
const users = (await (await call('/api/admin/users', { cookie: A })).json()).users, id = users.find((x) => x.username === 'krov@firma.hr').id;
const adm = (b) => call('/api/admin/users/' + id, { method: 'POST', cookie: A, body: b });
assert.equal((await adm({ active: false })).status, 200);
assert.equal((await call('/api/me', { cookie: U })).status, 401, 'isključeni korisnik je odmah odjavljen');
t = await login('krov@firma.hr', 'lozinka123'); assert.equal(t.status, 403); assert.match((await t.json()).error, /isključen/);
await adm({ active: true, validUntil: '2020-01-01' });
t = await login('krov@firma.hr', 'lozinka123'); assert.equal(t.status, 403); assert.match((await t.json()).error, /istekao 01\. 01\. 2020/);
await adm({ addMonths: 1 });
const U3 = (await login('krov@firma.hr', 'lozinka123')).cookie; assert.ok(U3, 'nakon produljenja opet ulazi');
assert.equal((await (await call('/api/docs/p_abc', { cookie: U3 })).json()).exists, true, 'podaci su ostali spremljeni');
assert.equal((await adm({ modes: ['krov', 'zemlja', 'nepostojeca'] })).status, 200);
// 7. promjena lozinke, odjava, tuđa adresa, previše pokušaja
assert.equal((await call('/api/password', { method: 'POST', cookie: U3, body: { oldKey: key('krov@firma.hr', 'kriva'), newKey: key('krov@firma.hr', 'nova') } })).status, 403);
assert.equal((await call('/api/password', { method: 'POST', cookie: U3, body: { oldKey: key('krov@firma.hr', 'lozinka123'), newKey: key('krov@firma.hr', 'nova') } })).status, 200);
assert.equal((await login('krov@firma.hr', 'lozinka123')).status, 401); assert.ok((await login('krov@firma.hr', 'nova')).cookie);
assert.equal((await call('/api/logout', { method: 'POST', cookie: U2, body: {}, origin: 'https://zla-stranica.test' })).status, 403);
assert.equal((await call('/api/logout', { method: 'POST', cookie: U2, body: {}, origin: O })).status, 200); assert.equal((await call('/api/me', { cookie: U2 })).status, 401);
for (let i = 0; i < 10; i++) await login('ana', 'krivo' + i, '9.9.9.9');
assert.equal((await login('ana', 'lozinka123', '9.9.9.9')).status, 429, 'nakon 10 krivih pokušaja prijava se zaustavlja');
const row = env.DB.prepare('SELECT pass_hash, salt FROM users WHERE username = ?').bind('ana'); t = await row.first();
assert.ok(t.pass_hash !== key('ana', 'lozinka123') && t.pass_hash.length === 64 && t.salt.length === 32, 'u bazi je samo sažetak sa solju');
console.log('poslužitelj: sve provjere prolaze');
