# Građevinski program

Bazni građevinski program za EU: nacrt (PDF/BIM) → izmjera (AI prijedlog + ručno) → troškovnik → ugovor.
Korisnici: **projektant** (opisi i količine, projektantski troškovnik) i **izvođač** (cijene, ponuda, ugovor).

## Stanje: prototip v0.11 (studeni 2026.)

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
