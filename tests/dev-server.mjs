// Lokalno pokretanje cijelog programa s prijavom (bez Cloudflarea): node tests/dev-server.mjs [port]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../server/worker.js';
import { makeEnv } from './d1shim.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), env = makeEnv(join(root, 'server/schema.sql'), join(root, 'web')), port = +process.argv[2] || 8788;
// BIS_MOCK_AI=1: lažni AI servis za provjeru petlje alata (prvi odgovor traži alat dodaj_stavke, drugi završava tekstom)
if (process.env.BIS_MOCK_AI) {
  env.ANTHROPIC_API_KEY = 'lokalni-test'; const real = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (String(u) !== 'https://api.anthropic.com/v1/messages') return real(u, o);
    const b = JSON.parse(new TextDecoder().decode(o.body)), last = b.messages[b.messages.length - 1], usage = { input_tokens: 2000, output_tokens: 300 };
    const hasImg = Array.isArray(last.content) && last.content.some((c) => c.type === 'image'), isResult = Array.isArray(last.content) && last.content.some((c) => c.type === 'tool_result');
    const txt = Array.isArray(last.content) ? (last.content.find((c) => c.type === 'text') || {}).text || '' : last.content;
    let content;
    if (isResult) content = [{ type: 'text', text: 'Dodao sam stavku: ' + last.content[0].content.slice(0, 60) }];
    else if (b.tools && /dodaj/i.test(txt)) content = [{ type: 'text', text: 'Dodajem.' }, { type: 'tool_use', id: 'tu_1', name: 'dodaj_stavke', input: { stavke: [{ grupa: 'g07', opis: 'Probna stavka iz AI-ja', jed: 'kom', kolicina: 3, cijena: 10 }] } }];
    else if (/JSON/.test(txt)) content = [{ type: 'text', text: JSON.stringify({ stavke: [{ opis: 'Snjegobrani pocinčani', kolicina: 24, jedinica: 'kom', cijena: 6 }], slika: hasImg }) }];
    else content = [{ type: 'text', text: 'Odgovor lažnog AI-ja. Slika: ' + hasImg }];
    return new Response(JSON.stringify({ content, stop_reason: content.some((c) => c.type === 'tool_use') ? 'tool_use' : 'end_turn', usage }), { status: 200 });
  };
}
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined, headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body, redirect: 'manual' }), env);
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log('http://localhost:' + port));
