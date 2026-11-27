// BIS program – poslužiteljski dio (Cloudflare Worker + D1)
// Sve ide kroz ovaj Worker: prijava, provjera valjanosti korisnika, spremanje podataka po korisniku i tek onda program.
// Lozinka se nikad ne sprema: preglednik je prije slanja „rasteže” (PBKDF2), a ovdje se sprema samo sažetak sa solju.
import { LOGIN_HTML, ADMIN_HTML, SETUP_HTML } from './pages.js';

const SESSION_DAYS = 30, COOKIE = 'bis_s', DOC_CHUNK = 600000, FILE_CHUNK = 1000000, MAX_DOC = 24e6, MAX_FILE_DB = 40e6, MAX_FILE_R2 = 200e6;
const MODES = ['gradnja', 'krov', 'zemlja', 'stolarija'];
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const rnd = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const today = () => new Date().toISOString().slice(0, 10);
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const html = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
const err = (msg, status = 400) => json({ error: msg }, status);
function safeEq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const normUser = (u) => String(u || '').trim().toLowerCase().slice(0, 80);
const okKey = (k) => typeof k === 'string' && /^[0-9a-f]{64}$/.test(k); // rastegnuta lozinka iz preglednika
const passHash = (salt, key) => sha(salt + ':' + key);
const addMonths = (from, n) => { const base = from && from > today() ? from : today(), d = new Date(base + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const valid = (u) => !!u && u.active === 1 && (u.role === 'admin' || !u.valid_until || u.valid_until >= today());
const pub = (u) => ({ id: u.id, username: u.username, name: u.name || '', company: u.company || '', role: u.role, active: u.active === 1, validUntil: u.valid_until || null, modes: u.role === 'admin' ? MODES : JSON.parse(u.modes || '[]'), lastLogin: u.last_login || null, createdAt: u.created_at });

// kratko pamćenje provjerenih sesija u memoriji (manje upita u bazu; isključenje korisnika vrijedi najkasnije za 60 s)
const seen = new Map();
async function auth(request, env) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)bis_s=([0-9a-f]{64})/); if (!m) return null;
  const th = await sha(m[1]), now = Date.now(), c = seen.get(th);
  if (c && c.until > now) return valid(c.user) ? { user: c.user, th } : null;
  const u = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(th, now).first();
  if (!u) { seen.delete(th); return null; }
  if (seen.size > 5000) seen.clear();
  seen.set(th, { user: u, until: now + 60000 });
  return valid(u) ? { user: u, th } : null;
}
const cookie = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function body(request, max = 200000) { const t = await request.text(); if (t.length > max) throw new Error('prevelik zahtjev'); return t ? JSON.parse(t) : {}; }
// zaštita od tuđih stranica: izmjene samo s iste adrese
function sameOrigin(request) { const o = request.headers.get('origin'); return !o || o === new URL(request.url).origin; }

async function login(request, env) {
  const b = await body(request), username = normUser(b.username), ip = request.headers.get('cf-connecting-ip') || 'x', now = Date.now();
  if (!username || !okKey(b.key)) return err('Upiši korisničko ime i lozinku.');
  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_fail WHERE (k = ? OR k = ?) AND t > ?').bind('u:' + username, 'ip:' + ip, now - 15 * 60000).first();
  if (fails && fails.n >= 10) return err('Previše pokušaja. Pokušaj ponovno za 15 minuta.', 429);
  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const ok = u ? safeEq(await passHash(u.salt, b.key), u.pass_hash) : (await passHash('x', b.key), false);
  if (!ok) {
    await env.DB.batch([env.DB.prepare('INSERT INTO login_fail (k, t) VALUES (?, ?)').bind('u:' + username, now), env.DB.prepare('INSERT INTO login_fail (k, t) VALUES (?, ?)').bind('ip:' + ip, now), env.DB.prepare('DELETE FROM login_fail WHERE t < ?').bind(now - 86400000)]);
    return err('Korisničko ime ili lozinka nisu točni.', 401);
  }
  if (!valid(u)) return err(u.active !== 1 ? 'Pristup je isključen. Javite se Bridgeline Intelligence Systems.' : 'Pristup je istekao ' + u.valid_until.split('-').reverse().join('. ') + '. Javite se Bridgeline Intelligence Systems.', 403);
  const token = rnd(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await sha(token), u.id, now + SESSION_DAYS * 86400000, now),
    env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, u.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
  ]);
  return json({ ok: true, role: u.role }, 200, { 'set-cookie': cookie(token, SESSION_DAYS * 86400) });
}

async function newUser(env, b, role) {
  const username = normUser(b.username);
  if (!/^[a-z0-9._@+-]{3,80}$/.test(username)) return err('Korisničko ime: najmanje 3 znaka (slova, brojke, točka, crtica ili e-adresa).');
  if (!okKey(b.key)) return err('Lozinka nije ispravno poslana.');
  if (await env.DB.prepare('SELECT 1 AS x FROM users WHERE username = ?').bind(username).first()) return err('To korisničko ime već postoji.', 409);
  const salt = rnd(16), modes = (Array.isArray(b.modes) ? b.modes : ['gradnja']).filter((m) => MODES.includes(m));
  const months = Math.max(0, Math.min(36, +b.months || 0));
  await env.DB.prepare('INSERT INTO users (id, username, name, company, pass_hash, salt, role, active, valid_until, modes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
    .bind('u_' + rnd(8), username, String(b.name || '').slice(0, 120), String(b.company || '').slice(0, 120), await passHash(salt, b.key), salt, role, role === 'admin' ? null : (months ? addMonths(null, months) : today()), JSON.stringify(modes.length ? modes : ['gradnja']), Date.now()).run();
  return json({ ok: true });
}

async function admin(request, env, path, me) {
  if (path === '/api/admin/users' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM users ORDER BY role, company, username').all();
    return json({ users: r.results.map(pub), today: today() });
  }
  if (path === '/api/admin/users' && request.method === 'POST') return newUser(env, await body(request), 'user');
  const m = path.match(/^\/api\/admin\/users\/(u_[0-9a-f]{16})$/);
  if (m && request.method === 'POST') {
    const b = await body(request), u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(m[1]).first(); if (!u) return err('Korisnik ne postoji.', 404);
    const set = [], val = [];
    if (b.active !== undefined) { if (u.id === me.id && !b.active) return err('Ne možeš isključiti vlastiti račun.'); set.push('active = ?'); val.push(b.active ? 1 : 0); }
    if (b.addMonths) { set.push('valid_until = ?'); val.push(addMonths(u.valid_until, Math.max(1, Math.min(36, +b.addMonths)))); }
    if (b.validUntil !== undefined) { if (b.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(b.validUntil)) return err('Datum nije ispravan.'); set.push('valid_until = ?'); val.push(b.validUntil || null); }
    if (Array.isArray(b.modes)) { const ms = b.modes.filter((x) => MODES.includes(x)); set.push('modes = ?'); val.push(JSON.stringify(ms.length ? ms : ['gradnja'])); }
    if (b.name !== undefined) { set.push('name = ?'); val.push(String(b.name).slice(0, 120)); }
    if (b.company !== undefined) { set.push('company = ?'); val.push(String(b.company).slice(0, 120)); }
    if (b.key !== undefined) { if (!okKey(b.key)) return err('Lozinka nije ispravno poslana.'); const salt = rnd(16); set.push('pass_hash = ?', 'salt = ?'); val.push(await passHash(salt, b.key), salt); }
    if (!set.length) return err('Nema izmjene.');
    const st = [env.DB.prepare(`UPDATE users SET ${set.join(', ')} WHERE id = ?`).bind(...val, u.id)];
    if (b.active === false || b.key !== undefined) st.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id)); // odmah odjavi
    await env.DB.batch(st); seen.clear();
    return json({ ok: true });
  }
  // trajno brisanje: korisnik, njegove sesije, projekti i nacrti (ne može se vratiti)
  if (m && request.method === 'DELETE') {
    const u = await env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?').bind(m[1]).first(); if (!u) return err('Korisnik ne postoji.', 404);
    if (u.id === me.id) return err('Ne možeš izbrisati vlastiti račun.');
    if (u.role === 'admin') return err('Račun administratora se ne briše ovdje.');
    if (env.FILES) { let cur; do { const l = await env.FILES.list({ prefix: u.id + '/', cursor: cur }); if (l.objects.length) await env.FILES.delete(l.objects.map((o) => o.key)); cur = l.truncated ? l.cursor : null; } while (cur); }
    await env.DB.batch(['sessions', 'docs', 'files'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(u.id)).concat([env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id), env.DB.prepare('DELETE FROM login_fail WHERE k = ?').bind('u:' + u.username)]));
    seen.clear();
    return json({ ok: true });
  }
  return err('Nepoznato.', 404);
}

// dokumenti korisnika (projekti, cjenik, dnevnici): JSON u dijelovima, jer red u bazi smije imati najviše 2 MB
async function docs(request, env, path, me) {
  if (path === '/api/docs' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT id, name, updated_at FROM docs WHERE user_id = ? AND part = 0 ORDER BY updated_at DESC').bind(me.id).all();
    return json({ docs: r.results.map((d) => ({ id: d.id, name: d.name, updatedAt: d.updated_at })) });
  }
  const m = path.match(/^\/api\/docs\/([A-Za-z0-9_.-]{1,80})$/); if (!m) return err('Nepoznato.', 404);
  const id = m[1];
  if (request.method === 'GET') {
    const r = await env.DB.prepare('SELECT data FROM docs WHERE user_id = ? AND id = ? ORDER BY part').bind(me.id, id).all();
    return r.results.length ? new Response('{"exists":true,"data":' + r.results.map((x) => x.data).join('') + '}', { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }) : json({ exists: false });
  }
  if (request.method === 'PUT') {
    const t = await request.text(); if (t.length > MAX_DOC) return err('Projekt je prevelik za spremanje.', 413);
    let o; try { o = JSON.parse(t); } catch { return err('Neispravan sadržaj.'); }
    const n = Math.max(1, Math.ceil(t.length / DOC_CHUNK)), now = Date.now(), name = typeof o.name === 'string' ? o.name.slice(0, 200) : null, upd = +o.updatedAt || now;
    await env.DB.prepare('DELETE FROM docs WHERE user_id = ? AND id = ?').bind(me.id, id).run();
    for (let i = 0; i < n; i++) await env.DB.prepare('INSERT INTO docs (user_id, id, part, parts, name, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(me.id, id, i, n, name, upd, t.slice(i * DOC_CHUNK, (i + 1) * DOC_CHUNK)).run();
    return json({ ok: true });
  }
  if (request.method === 'DELETE') { await env.DB.prepare('DELETE FROM docs WHERE user_id = ? AND id = ?').bind(me.id, id).run(); return json({ ok: true }); }
  return err('Nepoznato.', 404);
}

// nacrti (PDF): u spremištu datoteka R2 ako je povezano (env.FILES), inače u bazi u dijelovima
async function files(request, env, path, me) {
  if (path === '/api/files' && request.method === 'POST') {
    const buf = await request.arrayBuffer(); const max = env.FILES ? MAX_FILE_R2 : MAX_FILE_DB; if (!buf.byteLength || buf.byteLength > max) return err(`Datoteka je prazna ili veća od ${max / 1e6} MB.`, 413);
    const id = 'f_' + rnd(12), type = (request.headers.get('content-type') || 'application/octet-stream').slice(0, 80), now = Date.now();
    if (env.FILES) await env.FILES.put(me.id + '/' + id, buf, { httpMetadata: { contentType: type } });
    else { const n = Math.ceil(buf.byteLength / FILE_CHUNK); for (let i = 0; i < n; i++) await env.DB.prepare('INSERT INTO files (user_id, id, part, parts, type, size, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(me.id, id, i, n, type, buf.byteLength, now, buf.slice(i * FILE_CHUNK, (i + 1) * FILE_CHUNK)).run(); }
    return json({ id, url: '/api/files/' + id });
  }
  const m = path.match(/^\/api\/files\/(f_[0-9a-f]{24})$/);
  if (m && request.method === 'GET') {
    const h = { 'cache-control': 'private, max-age=86400' };
    if (env.FILES) { const o = await env.FILES.get(me.id + '/' + m[1]); if (o) return new Response(o.body, { headers: { ...h, 'content-type': o.httpMetadata?.contentType || 'application/pdf' } }); }
    // iz baze dio po dio (red je najviše 1 MB), da veliki nacrt ne zauzme memoriju odjednom
    const meta = await env.DB.prepare('SELECT parts, type FROM files WHERE user_id = ? AND id = ? AND part = 0').bind(me.id, m[1]).first();
    if (!meta) return err('Datoteka ne postoji.', 404);
    let i = 0;
    const stream = new ReadableStream({ async pull(c) {
      if (i >= meta.parts) return c.close();
      const r = await env.DB.prepare('SELECT data FROM files WHERE user_id = ? AND id = ? AND part = ?').bind(me.id, m[1], i++).first();
      if (!r) return c.close();
      c.enqueue(r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : Uint8Array.from(r.data));
    } });
    return new Response(stream, { headers: { ...h, 'content-type': meta.type || 'application/pdf' } });
  }
  return err('Nepoznato.', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    try {
      if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(request)) return err('Zahtjev s druge adrese nije dopušten.', 403);
      // javno: prijava i prvo postavljanje
      if (path === '/api/login' && method === 'POST') return await login(request, env);
      if (path === '/setup' || path === '/api/setup') {
        const any = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
        if (any && any.n > 0) return path === '/setup' ? Response.redirect(url.origin + '/login', 302) : err('Program je već postavljen.', 403);
        if (path === '/setup') return html(SETUP_HTML);
        if (method === 'POST') return await newUser(env, await body(request), 'admin');
      }
      const a = await auth(request, env), me = a && a.user;
      if (path === '/login') {
        if (me) return Response.redirect(url.origin + '/', 302);
        const any = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
        return any && any.n === 0 ? Response.redirect(url.origin + '/setup', 302) : html(LOGIN_HTML);
      }
      if (path === '/api/logout' && method === 'POST') {
        if (a) { await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(a.th).run(); seen.delete(a.th); }
        return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
      }
      if (!me) {
        if (path.startsWith('/api/')) return err('Prijava je istekla. Prijavi se ponovno.', 401);
        return (request.headers.get('accept') || '').includes('text/html') ? Response.redirect(url.origin + '/login', 302) : new Response('Potrebna je prijava.', { status: 401 });
      }
      if (path === '/api/me') return json(pub(me));
      if (path === '/api/password' && method === 'POST') {
        const b = await body(request); if (!okKey(b.oldKey) || !okKey(b.newKey)) return err('Lozinka nije ispravno poslana.');
        if (!safeEq(await passHash(me.salt, b.oldKey), me.pass_hash)) return err('Sadašnja lozinka nije točna.', 403);
        const salt = rnd(16); await env.DB.batch([env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').bind(await passHash(salt, b.newKey), salt, me.id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').bind(me.id, a.th)]);
        seen.clear(); return json({ ok: true });
      }
      if (path === '/admin' || path.startsWith('/api/admin/')) {
        if (me.role !== 'admin') return path === '/admin' ? Response.redirect(url.origin + '/', 302) : err('Samo za administratora.', 403);
        return path === '/admin' ? html(ADMIN_HTML) : await admin(request, env, path, me);
      }
      if (path.startsWith('/api/docs')) return await docs(request, env, path, me);
      if (path.startsWith('/api/files')) return await files(request, env, path, me);
      if (path.startsWith('/api/')) return err('Nepoznato.', 404);
      // prijavljen i valjan korisnik: sam program (statičke datoteke)
      const res = await env.ASSETS.fetch(request), h = new Headers(res.headers);
      h.set('x-frame-options', 'DENY'); h.set('referrer-policy', 'no-referrer');
      if ((h.get('content-type') || '').includes('text/html')) h.set('cache-control', 'no-store');
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      console.error(e && e.stack ? e.stack : e);
      return path.startsWith('/api/') ? err('Greška na poslužitelju. Pokušaj ponovno.', 500) : new Response('Greška na poslužitelju.', { status: 500 });
    }
  },
};
