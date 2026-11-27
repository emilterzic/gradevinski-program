// Lokalno pokretanje cijelog programa s prijavom (bez Cloudflarea): node tests/dev-server.mjs [port]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../server/worker.js';
import { makeEnv } from './d1shim.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), env = makeEnv(join(root, 'server/schema.sql'), join(root, 'web')), port = +process.argv[2] || 8788;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined, headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body, redirect: 'manual' }), env);
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log('http://localhost:' + port));
