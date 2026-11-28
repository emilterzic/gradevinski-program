// Lokalno pokretanje cijelog programa s prijavom (bez Cloudflarea): node tests/dev-server.mjs [port]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../server/worker.js';
import { makeEnv } from './d1shim.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), env = makeEnv(join(root, 'server/schema.sql'), join(root, 'web')), port = +process.argv[2] || 8788;
// BIS_MOCK_AI=1: lažni AI servis za provjeru petlje alata (prvi odgovor traži alat dodaj_stavke, drugi završava tekstom)
// i čitanja nacrta; BIS_MOCK_AI=rez reže popise otvora. GET /__mock vraća popis upita za pročelja.
const mockLog = [];
if (process.env.BIS_MOCK_AI) {
  env.ANTHROPIC_API_KEY = 'lokalni-test'; const real = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (String(u) !== 'https://api.anthropic.com/v1/messages') return real(u, o);
    const b = JSON.parse(new TextDecoder().decode(o.body)), last = b.messages[b.messages.length - 1], usage = { input_tokens: 2000, output_tokens: 300 };
    const hasImg = Array.isArray(last.content) && last.content.some((c) => c.type === 'image'), isResult = Array.isArray(last.content) && last.content.some((c) => c.type === 'tool_result');
    const txt = Array.isArray(last.content) ? (last.content.find((c) => c.type === 'text') || {}).text || '' : last.content;
    let content;
    // Čitanje nacrta: lažni odgovori za svaki korak. BIS_MOCK_AI=rez dodatno reže popis otvora na granici duljine
    // (dva pročelja u upitu: odrezano; jedno pročelje: odrezano pa nastavak), kao što se dogodilo na stvarnom nacrtu.
    const nImg = Array.isArray(last.content) ? last.content.filter((c) => c.type === 'image').length : 0, rez = process.env.BIS_MOCK_AI === 'rez';
    const J = (o, stop) => new Response(JSON.stringify({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }], stop_reason: stop || 'end_turn', usage }), { status: 200 });
    const first = b.messages[0], t0 = Array.isArray(first.content) ? (first.content.find((c) => c.type === 'text') || {}).text || '' : first.content;
    if (/Za svako pročelje na slikama od 2 nadalje/.test(t0)) {
      const pages = [...t0.matchAll(/Slika \d+: str\. (\d+) [^\n]*\(pročelje\)/g)].map((m) => +m[1]), sides = ['dolje', 'desno', 'gore', 'lijevo'];
      const fac = (n, k) => ({ slika: k + 2, naziv: 'PROČELJE ' + n, strana: sides[(n - 1) % 4], balkona: 0, rubovi: [0.1, 0.9], visinaPodnozja: 6, gornji: [],
        otvori: Array.from({ length: 6 }, (_, i) => ({ x: 0.15 + (i % 3) * 0.3, parapet: i < 3 ? 0.9 : 3.9, sirina: 1.2, visina: 1.4, vrsta: i === 1 ? 'vrata' : 'prozor' })) });
      const fullTxt = JSON.stringify({ procelja: pages.map(fac), napomena: 'lažno čitanje' }), half = Math.floor(fullTxt.length * 0.55);
      mockLog.push({ korak: 'procelja', str: pages, poruka: b.messages.length });
      if (!rez) return J(fullTxt);
      if (b.messages.length === 1) return J(fullTxt.slice(0, half), 'max_tokens');   // prvi odgovor uvijek odrezan
      if (process.env.BIS_MOCK_REZ === 'uvijek') { const k = (b.messages.length - 1) / 2; return J(fullTxt.slice(half + (k - 1) * 5, half + k * 5), 'max_tokens'); } // ni nastavci ne završavaju
      return J(fullTxt.slice(half));                                                  // nastavak od mjesta prekida
    }
    if (/Ovo je popis stranica PDF-a/.test(txt)) return J({ tlocrt: 1, tlocrtKata: null, presjek: null, procelja: [2, 3, 4, 5], napomena: 'lažno' });
    if (/Vrati \{"okviri"/.test(txt)) return J({ okviri: Array.from({ length: nImg }, () => [0.1, 0.1, 0.9, 0.9]) });
    if (/Vrati \{"okvir"/.test(txt)) return J({ okvir: [0.1, 0.1, 0.9, 0.9] });
    if (/Odredi VANJSKI obris zgrade/.test(txt)) return J({ obris: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]], sirina_m: 12, dubina_m: 10, pouzdanost: 0.8, napomena: '' });
    if (/Slažem 3D model vanjskog oblika zgrade/.test(txt)) return J({ dijelovi: [{ naziv: 'Zgrada', etaze: 2, visineEtaza: [3, 3], uvlaka: null }], kotaPoda: 0, krov: 'dvostresni', smjerSljemena: 'lijevo-desno', visinaSljemena: 8.5, prepust: 0.5, pouzdanost: 0.8, napomene: [] });
    if (isResult) content = [{ type: 'text', text: 'Dodao sam stavku: ' + last.content[0].content.slice(0, 60) }];
    else if (b.tools && /dodaj/i.test(txt)) content = [{ type: 'text', text: 'Dodajem.' }, { type: 'tool_use', id: 'tu_1', name: 'dodaj_stavke', input: { stavke: [{ grupa: 'g07', opis: 'Probna stavka iz AI-ja', jed: 'kom', kolicina: 3, cijena: 10 }] } }];
    else if (/JSON/.test(txt)) content = [{ type: 'text', text: JSON.stringify({ stavke: [{ opis: 'Snjegobrani pocinčani', kolicina: 24, jedinica: 'kom', cijena: 6 }], slika: hasImg }) }];
    else content = [{ type: 'text', text: 'Odgovor lažnog AI-ja. Slika: ' + hasImg }];
    return new Response(JSON.stringify({ content, stop_reason: content.some((c) => c.type === 'tool_use') ? 'tool_use' : 'end_turn', usage }), { status: 200 });
  };
}
http.createServer(async (req, res) => {
  if (req.url === '/__mock') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(mockLog)); }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined, headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body, redirect: 'manual' }), env);
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log('http://localhost:' + port));
