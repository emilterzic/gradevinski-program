// Zamjena za Cloudflare D1 i ASSETS u lokalnim testovima (node:sqlite, datoteke iz web/).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const conv = (v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : typeof v === 'boolean' ? +v : v === undefined ? null : v);
class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.db, this.sql, a.map(conv)); }
  async first() { const r = this.db.prepare(this.sql).get(...this.args); return r ? { ...r } : null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })) }; }
  async run() { this.db.prepare(this.sql).run(...this.args); return { success: true }; }
}
export function makeEnv(schemaPath, webDir) {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(schemaPath, 'utf8'));
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
  return {
    DB: { prepare: (sql) => new Stmt(db, sql), batch: async (list) => { const out = []; for (const s of list) out.push(/^\s*select/i.test(s.sql) ? await s.all() : await s.run()); return out; } },
    ASSETS: { fetch: async (req) => { let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith('/')) p += 'index.html'; const f = join(webDir, p); if (!f.startsWith(webDir) || !existsSync(f) || !statSync(f).isFile()) return new Response('Not found', { status: 404 }); return new Response(readFileSync(f), { headers: { 'content-type': TYPES[extname(f)] || 'application/octet-stream' } }); } },
  };
}
