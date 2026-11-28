# BIS program

Bazni građevinski program za EU: nacrt (PDF/BIM) → izmjera (AI prijedlog + ručno) → troškovnik → ugovor.
Korisnici: **projektant** (opisi i količine, projektantski troškovnik) i **izvođač** (cijene, ponuda, ugovor).

## Stanje: v0.28 (studeni 2026.)

Web aplikacija u mapi `web/` (čisti HTML + JavaScript, bez build koraka):

- **Nacrt**: PDF nacrti (pdf.js), automatsko mjerilo iz zaglavlja („mjerilo: 1:100”) ili kalibracija po poznatoj koti;
  alati Duljina (m), Površina (m²), Komad (kom) s faktorom (npr. × visina zida).
- **Stavke**: svaka ima status *AI prijedlog* / *Potvrđeno* / *Ručno* / *Izmjereno* i obrazloženje količine.
  Sve se može ručno ispraviti; izmjere se automatski zbrajaju u količinu stavke.
- **Troškovnik**: 14 vrsta radova (pripremni → instalacije), faze gradnje, rekapitulacija, PDV 25 %,
  izvoz u Excel (.csv) i Word (.docx), izvoz/uvoz projekta (.json, prenosivost podataka).
- **Ugovor**: ugovor o građenju generiran iz troškovnika (plaćanje po fazama, jamstva, rokovi), uređiv, izvoz .docx.
- **3D prikaz**: model kuće iz nacrta (tlocrt, presjek, pročelja) u three.js; pogledi na sva pročelja, perspektiva i
  odozgo; 6 faza gradnje (iskop → gotov objekt) s iznosima iz troškovnika; boje materijala i gotove palete;
  klik na dio kuće prikazuje njegove stavke; slike do 3200 × 1800 (zadano 2560 × 1440) s natpisom.
- **Izvedba i cijene** (v0.5, kartica 3D prikaz): odluke o izvedbi s okvirnim tržišnim cijenama za konkretan objekt:
  vrsta tla za iskop (III., IV.–V., VI.–VII. kategorija, ručno), temelji (trakasti, temeljna ploča, samci + vezne grede),
  nosiva konstrukcija (blok opeka 25/30 cm ili puna opeka sa serklažima, armirani beton, AB skelet s ispunom),
  oblik krova (dvostrešni, četverostrešni, jednostrešni, ravni), pokrov (crijep, lim, membrana + šljunak, zeleni krov),
  fasada (ETICS EPS/vuna, ventilirana, kamen, klinker, drvo), stolarija (PVC, ALU, drvo, drvo-ALU; dvostruko/trostruko
  staklo; HS/PSK klizne stijene). Odabir odmah mijenja 3D model i zamjenjuje pripadne stavke troškovnika
  (količine iz modela, cijena označena kao okvirna dok je korisnik ne potvrdi; ručne količine ostaju).
- **Dokumenti projekta** (v0.7): više PDF-ova po projektu; novi dokument se dodaje na popis (ništa se ne zamjenjuje ni ne
  briše), mjerila i izmjere vode se po dokumentu. Sličice stranica crtaju se tek kad su vidljive.
- **3D model iz nacrta (AI)** (v0.7): AI odabere stranice (tlocrt, presjek, pročelja), odredi vanjski obris na tlocrtu
  (uz kote iz PDF teksta i mjerilo), pročita etaže, visine, krov i otvore po pročeljima i složi model (`modelFromAi`).
  Rezultat je AI prijedlog koji se ispravlja u „Objekt i dimenzije”. Bez modela 3D prikaz pokazuje prazno stanje:
  program više nikad sam ne stvara okvirnu kuću.
- **Zgrada iz više dijelova** (v0.9): podnožje + uvučeni gornji dijelovi, svaki sa svojim obrisom, brojem etaža i
  visinama etaža (npr. poslovno prizemlje 5,76 m, stambeni katovi 3 m). AI ih čita iz presjeka, tlocrta kata i pročelja;
  u „Objekt i dimenzije” svaki se dio ručno ispravlja (etaže, visine, uvlake) ili dodaje. Količine, terasa nižeg dijela
  i statika računaju se po dijelovima.
- **Usklađivanje nacrta** (v0.10): AI zna zamijeniti strane pročelja ili položaj gornjeg dijela. `MD.resolveSpec` zato
  provjerava da se nacrti međusobno slažu: nacrtana širina pročelja mora odgovarati širini ili dubini tlocrta, a prozori i izlozi moraju
  pasti na stvarne zidove; strane svijeta u nazivima pročelja su samo blaga prednost jer se nazivi znaju krivo pročitati.
  Veličina gornjeg dijela uzima se s tlocrta, položaj s pročelja. Što je ispravljeno piše u poruci, a strane pročelja i uvlake korisnik mijenja ručno.
  Izlozi širi od 6 m crtaju se u punoj širini (polja po 4 m), ostakljenje preko više etaža kao polja jedno iznad drugog.
- **Tlocrt kata i balkoni** (v0.11): dodatni korak AI čitanja uzima tlocrt kata: točan obris te etaže (krila, istaci,
  uvučena stubišta), položaj prema podnožju i sve balkone s vrstom ograde (staklena, metalna, zidana) i etažama na
  kojima se ponavljaju. Balkoni se crtaju u 3D-u, uređuju ručno i ulaze u troškovnik (ploče u m², ograde u m).
  Zadnje AI čitanje se bilježi u `ailog_<projekt>` (koraci, pročitani podaci, pogreška).
- **Temeljitije čitanje** (v0.12): pročelja se čitaju s izreza samog crteža (bez zaglavlja i praznog papira), pa su
  otvori na slici oko dvostruko veći; izlaz na krov je zaseban dio zgrade. `tests/model.test.mjs` je stalna provjera
  modela prema stvarnoj zgradi iz `tests/fixtures/` (pokretanje: `node tests/model.test.mjs`).
- **Kosi teren i kota poda** (v0.13): etaža ispod prizemlja koja se na nekom pročelju vidi cijelom visinom broji se u
  model. `modelSpec.z0` je kota poda najdonje etaže (parapeti otvora su zadani od ±0,00). Ako pročelja pokazuju više
  podnožje nego što je pročitano iz presjeka, program sam dodaje donju etažu i to napiše u poruci.
- **Tlocrt ima prednost** (v0.14): položaj gornjeg dijela pročitan s tlocrta pouzdaniji je od AI procjene koje je
  pročelje na kojoj strani (na stvarnom projektu AI je kraća pročelja zamijenio u većini čitanja). Proturječje s
  tlocrtom zato vrijedi više od glasova AI-a. Ručno ispravljen model (`P.specManual`) usklađivanje više ne dira.
- **Skenirani nacrti i testni način** (v0.15): PDF bez tekstnog sloja razvrstava se po izgledu stranica (vrsta crteža,
  naslov, mjerilo sa slike). Testni način: projekti navedeni u dokumentu baze `aitest` {queue[]} čitaju se redom pri
  otvaranju programa, a rezultat ide u `ailog_<projekt>`.
- **BIM alati** (v0.17), kartica „Model” u 3D prikazu: popis etaža s količinama (zidovi, ploča, otvori, balkoni) i
  izdvajanje etaže, presjek (uzdužni, poprečni, vodoravni) s klizačem, prozirni prikaz, svojstva kliknutog elementa
  (prozor, vrata, zid, balkon: mjere, etaža, pročelje, izvedba) uz stavke troškovnika. AI sažetak ima red „kontrola”
  (pročelja n/4, otvori pročitani i bez zida, balkoni viđeni na pročeljima a nisu u modelu).
- **Zemljani radovi: iskop po zadanoj dubini** (v0.28): dubina se upiše ili izgovori („1,73”, „metar i pol”, „173 cm”),
  3D prikaz pokaže građevinsku jamu u mjerilu s kotom dubine, a iskop, odvoz, šljunčani nasip, zatrpavanje i drenaža
  izračunaju se iz jame (radni prostor, pokos) i upišu u ponudu. Količine su za ponudu, u sraslom stanju.
- **Čitanje nacrta bez odrezanih odgovora** (v0.26): AI servis ograničava duljinu jednog odgovora; program odrezan odgovor
  sam nastavlja, dugačke popise otvora dijeli po pročeljima i čita ih usporedno, a u najgorem slučaju zadržava sve
  pročitano do prekida i to jasno napiše. Model se više ne može složiti šutke bez prozora i vrata.
- **Novi nacrt = novi objekt, AI na webu** (v0.22–v0.25): AI ide kroz postojeći posrednik (bez ključa u programu), nacrt se
  prikazuje odmah iz memorije, učitani nacrt otvara novi projekt i odmah se čita u 3D model, kartica se sama osvježi
  na novu inačicu.
- **Web inačica s prijavom** (v0.21): program se na Cloudflareu poslužuje kroz Worker (`server/worker.js`) koji prije
  svega traži prijavu korisničkim imenom i lozinkom. Korisnici, sesije, projekti i nacrti su u bazi D1, odvojeni po
  korisniku. Administrator na `/admin` dodaje korisnike, bira vrste programa, produljuje valjanost (+1 mjesec) i
  isključuje pristup. Lozinke se ne spremaju (samo sažetak sa solju). Postavljanje: vidi „Cloudflare” niže.
- **Naziv i vrste programa** (v0.20): program se zove BIS program (Bridgeline Intelligence Systems).
  Vrste programa su zapisi u `MODES` u `web/app.js`: Cijela gradnja, Krovopokrivači, Zemljani radovi (iskopi, odvoz,
  nasipi, podbetoniranje temelja; izračun broja tura kamiona), Građevinska stolarija (pozicije prozora i vrata iz
  otvora 3D modela, ponuda po pozicijama). Svaka struka ima svoju ponudu, brze stavke, katalog i ugovor.
  `allowedModes()` je mjesto gdje će se vrste otključavati prema licenci tvrtke nakon prijave.
- **Brzina troškovnika, katalog i cjenik** (v0.19): troškovnik s 20 000 stavki crta se za oko 0,4 s, a izmjena jednog
  polja za oko 30 ms (prije: 1000 stavki 3 s po svakoj izmjeni). Katalog stavki (`web/katalog.js`, oko 300 opisa po
  vrstama radova, bez cijena) s pretragom (Ctrl+K ili „Katalog i cjenik”). Moj cjenik: cijene koje korisnik upiše pamte
  se po korisniku i nude pri sljedećem unosu iste stavke; uvoz i izvoz cjenika u .csv (do 50 000 redova).
  Krovopokrivači: marža (%) koja se ne ispisuje, popis materijala za narudžbu iz površine krova, sljemena, grebena i
  zabata s postotkom otpada (okvirne potrošnje, provjeriti prema proizvođaču). 3D: mjerenje udaljenosti između dvije
  točke (hvata ugao) i spremljeni pogledi uz projekt.
- **Vrsta programa** (v0.18): izbornik gore desno („Cijela gradnja” | „Krovopokrivači”), pamti se po projektu.
  Krovopokrivači: isti nacrti i 3D, a zbraja se i prikazuje samo krov (skupine tesarski, krovopokrivački, limarski i faza
  krov). Kartica „Ponuda”: podaci o krovu iz 3D modela, brzi gumbi za česte stavke, unos rečenicom upisanom ili
  izgovorenom („snjegobrani 24 komada po 6 eura”) koju AI pretvara u stavke, velika polja za ručni upis, zbroj s PDV-om,
  izvoz ponude u Word. Ugovor o izvođenju krovopokrivačkih radova složen iz ponude (predujam %, rok uz vremenske
  prilike, jamstvo, primopredaja); „Brza priprema ugovora” jednom izgovorenom ili upisanom rečenicom popuni podatke
  naručitelja, građevine, rokova i plaćanja. Nacrt ugovora treba provjeriti pravnik.
- **Objekt i dimenzije** (v0.6): vrsta objekta (po nacrtu, prizemnica, obiteljska kuća P+1, manja stambena zgrada P+2,
  stambena zgrada P+4) sa standardnim polaznim dimenzijama i uobičajenom izvedbom; širina, dubina, broj etaža, visina
  etaže, nagib i prepust krova mijenjaju se slobodno, i na modelu iz nacrta (tlocrt se rasteže, etaže se dodaju).
  Stavke izvedbe (uključujući AB stropne ploče) se preračunaju; ostale stavke može uskladiti AI asistent.
- **Statika (informativno)**: pravila za omeđeno ziđe (debljina ≥ 24 cm, vitkost ≤ 15, serklaži u uglovima, uz otvore
  > 1,5 m² i na ≤ 5 m, horizontalni na ≤ 4 m, udio zidova po smjeru prema potresnom području) i osnovne provjere za AB.
  Ne zamjenjuje statički proračun ovlaštenog inženjera.
- **AI asistent**: chat s glasovnim unosom i brzim gumbima; alatima mijenja troškovnik (dodaj/promijeni/obriši stavke,
  cijene, faze, podatke ugovora). Svaka AI promjena je označena i može se poništiti.

Objavljena verzija radi kao Claude artefakt (spremanje u oblak, AI, diktat, preuzimanja dolaze iz platforme).
Lokalno: `cd web && python3 -m http.server` → http://localhost:8000 (bez AI-ja; spremanje u preglednik).

## Okvirne cijene i pravila: izvori

Cijene u `web/model.js` (`OPT`, `PRICE`) su okvirne, EUR bez PDV-a, Hrvatska 2026., i uvijek čekaju potvrdu korisnika.
Rasponi su uzeti iz javnih cjenika (emajstor.hr, 2026.): iskop građevinske jame 9,6–18 €/m³, strojni iskop III. kat.
6,4–9,6 €/m³, ručni 20–25 €/m³, VI./VII. kat. 20–28 €/m³; trakasti temelji 70–150 €/m, temeljna ploča 90–160 €/m²;
zidanje blok opekom 90–150 €/m³, punom opekom 130–210 €/m³; beton C25/30 ugrađen 80–120 €/m³; krovna konstrukcija
24–40 €/m², glineni crijep 30–40 €/m², lim 18–30 €/m²; ETICS 35–60 €/m², ventilirana fasada 53–143 €/m², drvena
80–120 €/m²; prozori 159–302 €/m². Stavke bez javnog raspona (kamen, klinker, zeleni krov, klizne stijene, armatura,
limarija) su procjena i treba ih zamijeniti ponudama.

Pravila statike: HKIG, „Zidane omeđene konstrukcije” (2021.), HRN EN 1996-1-1, HRN EN 1998-1 (tablica 9.3 za
jednostavne zidane zgrade; vrijednosti u `PA_MIN` treba provjeriti prema važećem nacionalnom dodatku prije prodaje).

## Dokumenti

- `docs/koncept-v0.1.md` – koncept, arhitektura (jezgra + državni paketi), zakoni EU, plan faza.

## Plan

Faza 0 temelj → 1 MVP Hrvatska → 2 AI izmjera nacrta → 3 druga država → 4 gradilište/mobitel.

## Cloudflare (web inačica)

- `wrangler.jsonc`: Worker `bis-program`, statičke datoteke iz `web/` (`run_worker_first`), baza D1 `DB`.
- Baza: `server/schema.sql` (naredbe su ponovljive). Nacrti idu u R2 ako se doda binding `FILES`, inače u D1 u dijelovima.
- Objava: Cloudflare → Workers & Pages → Create application → GitHub → ovaj repozitorij → Deploy (naredba `npx wrangler deploy`).
  Svaki `git push` na `main` nakon toga sam objavljuje novu inačicu.
- AI: na Workeru dodati tajnu `ANTHROPIC_API_KEY` (Settings → Variables and Secrets). Model i mjesečni limit po korisniku su u
  `wrangler.jsonc` (`AI_MODEL`, `AI_MONTHLY_CAP_USD`); limit pojedinog korisnika mijenja se na `/admin`.
- Prvi ulazak: `/setup` otvara račun administratora (radi samo dok nema nijednog korisnika).
- Lokalno bez Cloudflarea: `node tests/dev-server.mjs` (baza u memoriji), provjere: `node tests/server.test.mjs`.
