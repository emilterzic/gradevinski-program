// Stranice koje poslužuje Worker: prijava, prvo postavljanje i upravljanje korisnicima.
const CSS = `*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f5f8;color:#16202e}
.wrap{max-width:400px;margin:9vh auto;padding:28px;background:#fff;border:1px solid #dde3ea;border-radius:16px;box-shadow:0 8px 30px rgba(20,40,80,.06)}
.wide{max-width:1180px;margin:24px auto;padding:0 18px}h1{font-size:21px;margin:0 0 2px}h2{font-size:17px;margin:22px 0 10px}.sub{color:#5d6b7c;margin:0 0 20px;font-size:13.5px}
label{display:block;font-size:12.5px;color:#5d6b7c;margin:12px 0 4px}input,select{width:100%;padding:10px 11px;border:1px solid #cfd7e1;border-radius:9px;font:inherit;background:#fff;color:inherit}
input:focus{outline:2px solid #1d5fd1;outline-offset:1px}button{font:inherit;border:1px solid #cfd7e1;background:#fff;border-radius:9px;padding:9px 13px;cursor:pointer;color:inherit}
button.p{background:#1d5fd1;border-color:#1d5fd1;color:#fff;font-weight:600}button.w{width:100%;margin-top:18px;padding:11px}button:disabled{opacity:.55;cursor:default}
.msg{margin-top:14px;font-size:13.5px;min-height:20px}.msg.e{color:#b3261e}.msg.ok{color:#1a7f37}.top{display:flex;align-items:center;gap:10px;margin-bottom:6px}.top h1{margin-right:auto}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dde3ea;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #e8ecf1;font-size:13.5px;vertical-align:middle}
th{font-size:12px;color:#5d6b7c;background:#f8fafc}td small{color:#5d6b7c;display:block}.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.on{background:#e3f5e8;color:#1a7f37}.off{background:#fde8e6;color:#b3261e}.exp{background:#fff1d6;color:#8a5a00}.acts{display:flex;gap:6px;flex-wrap:wrap}.acts button{padding:5px 9px;font-size:12.5px}.acts button.d{color:#b3261e;border-color:#f0c4c0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 12px;background:#fff;border:1px solid #dde3ea;border-radius:12px;padding:6px 16px 16px}
.chk{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px}.chk label{display:flex;align-items:center;gap:5px;margin:0;color:inherit;font-size:13px}.chk input{width:auto}td small input{width:54px;padding:2px 5px;display:inline;font-size:12px}`;
// Lozinka se u pregledniku „rasteže” (PBKDF2, 310 000 koraka) i poslužitelju se šalje samo dobiveni ključ.
const JS = `const $=(s)=>document.querySelector(s);
async function stretch(u,p){const e=new TextEncoder(),k=await crypto.subtle.importKey('raw',e.encode(p),'PBKDF2',false,['deriveBits']);
const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:e.encode('bis-gp:'+u.trim().toLowerCase()),iterations:310000},k,256);
return [...new Uint8Array(b)].map((x)=>x.toString(16).padStart(2,'0')).join('')}
async function api(path,body,method){const r=await fetch(path,{method:method||(body?'POST':'GET'),headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
let o={};try{o=await r.json()}catch{}if(!r.ok)throw new Error(o.error||'Greška. Pokušaj ponovno.');return o}
function msg(t,ok){const m=$('#msg');m.textContent=t||'';m.className='msg '+(ok?'ok':'e')}`;
const page = (title, bodyHtml, script) => `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>${CSS}</style></head><body>${bodyHtml}<script>${JS}${script}</script></body></html>`;

export const LOGIN_HTML = page('BIS program – prijava', `<form class="wrap" id="f" autocomplete="on">
<h1>BIS program</h1><p class="sub">Bridgeline Intelligence Systems</p>
<label for="u">Korisničko ime</label><input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
<label for="p">Lozinka</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button class="p w" id="b" type="submit">Prijava</button><div class="msg" id="msg" role="alert"></div></form>`,
`$('#f').onsubmit=async(e)=>{e.preventDefault();const b=$('#b');b.disabled=true;msg('');
try{const u=$('#u').value,r=await api('/api/login',{username:u,key:await stretch(u,$('#p').value)});location.href=r.role==='admin'?'/admin':'/'}
catch(x){msg(x.message);b.disabled=false}};`);

export const SETUP_HTML = page('BIS program – postavljanje', `<form class="wrap" id="f" autocomplete="off">
<h1>Prvo postavljanje</h1><p class="sub">Otvori račun administratora. Ova stranica radi samo dok nema nijednog korisnika.</p>
<label for="n">Ime i prezime</label><input id="n" required>
<label for="u">Korisničko ime</label><input id="u" autocapitalize="none" spellcheck="false" required>
<label for="p">Lozinka (najmanje 10 znakova)</label><input id="p" type="password" autocomplete="new-password" minlength="10" required>
<label for="p2">Ponovi lozinku</label><input id="p2" type="password" autocomplete="new-password" minlength="10" required>
<button class="p w" id="b" type="submit">Otvori račun administratora</button><div class="msg" id="msg" role="alert"></div></form>`,
`$('#f').onsubmit=async(e)=>{e.preventDefault();if($('#p').value!==$('#p2').value)return msg('Lozinke nisu jednake.');const b=$('#b');b.disabled=true;msg('');
try{const u=$('#u').value,k=await stretch(u,$('#p').value);await api('/api/setup',{username:u,name:$('#n').value,key:k});await api('/api/login',{username:u,key:k});location.href='/admin'}
catch(x){msg(x.message);b.disabled=false}};`);

export const ADMIN_HTML = page('BIS program – korisnici', `<div class="wide">
<div class="top"><h1>Korisnici</h1><button onclick="location.href='/'">Otvori program</button><button id="out">Odjava</button></div>
<p class="sub">Korisnik može ući dok je uključen i dok mu vrijedi datum. Nakon uplate produlji ga za mjesec; ako više ne koristi program, isključi ga (podaci mu ostaju) ili ga izbriši (trajno, zajedno s projektima).</p>
<div class="msg" id="msg" role="alert"></div><p class="sub" id="ai"></p>
<table><thead><tr><th>Korisnik</th><th>Tvrtka</th><th>Vrste programa</th><th>Vrijedi do</th><th>Stanje</th><th>AI ovaj mjesec</th><th>Radnje</th></tr></thead><tbody id="rows"></tbody></table>
<h2>Novi korisnik</h2><form class="grid" id="nf" autocomplete="off">
<div><label for="nu">Korisničko ime ili e-adresa</label><input id="nu" autocapitalize="none" spellcheck="false" required></div>
<div><label for="nn">Ime i prezime</label><input id="nn"></div><div><label for="nc">Tvrtka</label><input id="nc"></div>
<div><label for="np">Lozinka (najmanje 8 znakova)</label><input id="np" type="text" autocomplete="off" minlength="8" required></div>
<div><label for="nm">Vrijedi (mjeseci od danas)</label><input id="nm" type="number" min="0" max="36" value="1"></div>
<div><label>Vrste programa</label><div class="chk" id="nmodes"></div></div>
<div><label>&nbsp;</label><button class="p" type="submit" id="nb">Dodaj korisnika</button></div></form></div>`,
`const M={gradnja:'Cijela gradnja',krov:'Krovopokrivači',zemlja:'Zemljani radovi',stolarija:'Građevinska stolarija'};let T='';
const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dat=(d)=>d?d.split('-').reverse().join('. ')+'.':'bez roka';
$('#nmodes').innerHTML=Object.keys(M).map((k)=>'<label><input type="checkbox" value="'+k+'"'+(k==='gradnja'?' checked':'')+'>'+M[k]+'</label>').join('');
async function load(){const r=await api('/api/admin/users');T=r.today;$('#ai').textContent=r.ai?'AI je uključen. Uz svakog korisnika vidiš potrošnju ovaj mjesec (u dolarima) i limit nakon kojeg mu se AI zaustavlja do sljedećeg mjeseca.':'AI još nije uključen: na Workeru nedostaje tajna ANTHROPIC_API_KEY.';$('#rows').innerHTML=r.users.map((u)=>{const adm=u.role==='admin',exp=!adm&&u.validUntil&&u.validUntil<T,st=!u.active?['off','Isključen']:exp?['exp','Istekao']:['on','Aktivan'];
return '<tr data-id="'+u.id+'" data-u="'+esc(u.username)+'"><td><b>'+esc(u.username)+'</b><small>'+esc(u.name)+(adm?' · administrator':'')+'</small></td><td>'+esc(u.company)+'</td>'
+'<td>'+(adm?'sve':'<div class="chk">'+Object.keys(M).map((k)=>'<label><input type="checkbox" data-mode="'+k+'"'+(u.modes.includes(k)?' checked':'')+'>'+M[k]+'</label>').join('')+'</div>')+'</td>'
+'<td>'+(adm?'bez roka':dat(u.validUntil))+'</td><td><span class="pill '+st[0]+'">'+st[1]+'</span></td>'
+'<td>'+u.aiCost.toFixed(2)+' $ <small>'+u.aiCalls+' upita · limit <input data-cap value="'+u.aiLimit+'" inputmode="decimal" aria-label="AI limit u dolarima"> $</small></td>'
+'<td><div class="acts">'+(adm?'':'<button data-a="m1">+1 mjesec</button><button data-a="m12">+1 godina</button><button data-a="tg">'+(u.active?'Isključi':'Uključi')+'</button>')+'<button data-a="pw">Nova lozinka</button>'+(adm?'':'<button data-a="del" class="d">Izbriši</button>')+'</div></td></tr>'}).join('')}
async function act(id,body,ok){try{await api('/api/admin/users/'+id,body);msg(ok,true);await load()}catch(x){msg(x.message)}}
$('#rows').onclick=async(e)=>{const b=e.target.closest('button[data-a]');if(!b)return;const tr=b.closest('tr'),id=tr.dataset.id,u=tr.dataset.u,a=b.dataset.a;
if(a==='m1')act(id,{addMonths:1,active:true},u+': produljeno za mjesec dana.');else if(a==='m12')act(id,{addMonths:12,active:true},u+': produljeno za godinu dana.');
else if(a==='tg'){const on=b.textContent==='Uključi';act(id,{active:on},u+(on?': uključen.':': isključen i odjavljen.'))}
else if(a==='del'){const t=prompt('TRAJNO BRISANJE: korisnik '+u+' i svi njegovi projekti i nacrti bit će izbrisani i ne mogu se vratiti.\\n\\nZa potvrdu upiši njegovo korisničko ime:');if(t===null)return;if(t.trim().toLowerCase()!==u)return msg('Korisničko ime se ne podudara. Ništa nije izbrisano.');try{await api('/api/admin/users/'+id,null,'DELETE');msg(u+': trajno izbrisan.',true);await load()}catch(x){msg(x.message)}}
else if(a==='pw'){const p=prompt('Nova lozinka za '+u+' (najmanje 8 znakova):');if(p===null)return;if(p.length<8)return msg('Lozinka mora imati najmanje 8 znakova.');act(id,{key:await stretch(u,p)},u+': lozinka je promijenjena.')}};
$('#rows').onchange=(e)=>{const k=e.target.closest('[data-cap]');if(k){const tr=k.closest('tr'),v=parseFloat(k.value.replace(',','.'));if(!(v>=0))return msg('Limit mora biti broj.');return act(tr.dataset.id,{aiCap:v},tr.dataset.u+': mjesečni AI limit je '+v+' $.')}
const c=e.target.closest('[data-mode]');if(!c)return;const tr=c.closest('tr');act(tr.dataset.id,{modes:[...tr.querySelectorAll('[data-mode]:checked')].map((x)=>x.dataset.mode)},tr.dataset.u+': vrste programa su spremljene.')};
$('#nf').onsubmit=async(e)=>{e.preventDefault();const b=$('#nb');b.disabled=true;try{const u=$('#nu').value;
await api('/api/admin/users',{username:u,name:$('#nn').value,company:$('#nc').value,key:await stretch(u,$('#np').value),months:+$('#nm').value,modes:[...document.querySelectorAll('#nmodes input:checked')].map((x)=>x.value)});
msg('Korisnik '+u+' je dodan. Javi mu korisničko ime i lozinku.',true);$('#nf').reset();document.querySelector('#nmodes input').checked=true;await load()}catch(x){msg(x.message)}b.disabled=false};
$('#out').onclick=async()=>{await api('/api/logout',{});location.href='/login'};load().catch((x)=>msg(x.message));`);
