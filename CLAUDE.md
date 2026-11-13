# Upute za rad na ovom repozitoriju

- Jezik korisnika i sučelja: hrvatski. Komentari u kodu na hrvatskom.
- Vlasnik: gradi firmu za AI implementaciju; program prodaje po EU-u, počinje od Hrvatske.
- Ciljni korisnici: projektant i izvođač. Princip: kompleksno iznutra, vrlo jednostavno za korisnika.
- Pravilo AI-a: AI predlaže (status `ai`), čovjek potvrđuje; sve mora biti ručno ispravljivo.
- `web/app.js` – aplikacija (bez frameworka); `web/viz3d.js` – 3D prikaz (three.js r160, MIT, preko import mape);
  `web/model.js` – čisti podaci bez three.js: model objekta, geometrija krova (`roofGeom`), katalog opcija izvedbe s
  okvirnim cijenama (`OPT`, `PRICE`), količine (`quantities`), stavke izvedbe (`buildItems`), informativna statika (`statika`).
  `web/lib/` – pdf.js 6.2.108 i three.js r160 s dodacima, ne mijenjati.
- 3D model projekta je `P.model` {fp tlocrt u m (x desno, z dolje), eave, ridge, ridgeX, ov, openings[{e,u,w,h,s,t}],
  balcony, canopy, chimneys, colors}; `demoModel()` je složen iz priloženih nacrta, `autoModel()` iz dimenzija.
- Model podataka (projekt): `items[]` {group, desc, unit, qty, price, priceSrc, phase, status, qtyMode, basis},
  `meas[]` {page, type length|area|count, pts u PDF točkama, value, factor, itemId}, `pageScale{page:{mPerPt}}`,
  `phases[]`, `meta{}` (podaci za ugovor), `contract{html, edited}`, `chat[]`.
- GDPR/Data Act: podaci po korisniku privatni; izvoz cijelog projekta u JSON mora uvijek raditi.
- Prije objave provjeriti: `node --check web/app.js`.
- 3D brzina (v0.4): sjene se osvježavaju samo na zahtjev (`invalidateShadows()`), mreže se spajaju po materijalu
  (`mergeMeshes`), boje se mijenjaju preko `setColors()` bez ponovne izgradnje. Dok se model miče crta se brza
  slika (okluzija u pola rezolucije; na sporim računalima i niža rezolucija), a 140 ms nakon mirovanja puna kvaliteta.
  Novi dijelovi scene moraju pozvati `invalidateShadows()` ili postaviti `needFull`.
- Nacrt se crta u točnim fizičkim pikselima (`pdfSizes`), izvan ekrana, pa se zamijeni; ne vraćati `Math.floor` skaliranje.
- Izvedba (v0.5): `P.build` {tlo, temelji, konstrukcija, krovOblik, pokrov, fasada, stolarija, staklo, klizna, seizmika};
  mijenja se samo preko `setBuild()` (poništavanje, boje, 3D, troškovnik). Stavke izvedbe imaju `slot` + `key` + `opt`;
  `applySlots()` ih zamjenjuje, a ručne/izmjerene količine i ručno upisane cijene (uz istu opciju) ostaju.
  `priceSrc: 'kat'` = okvirna kataloška cijena, čeka potvrdu kao AI prijedlog (`needsOk`). `P.buildLinked` = troškovnik prati izvedbu.
- Statika je uvijek informativna: nikad ne tvrditi da je konstrukcija dokazana; šuplja opeka (vodoravne šupljine) samo kao ispuna.
  Uz svaku novu opciju konstrukcije dodati provjere u `statika()` i napomenu o ovlaštenom inženjeru.
- Novi oblik krova: dodati granu u `roofGeom()` (plohe + H + wallTop); 3D i količine ga tada preuzimaju sami.
- Objekt (v0.6): `P.modelType` (id iz `MD.TYPES`) + `P.modelDims` {W, D, floors, storeyH, pitch, ov}; mijenja se samo preko
  `setObjekt(type, dims)`. Model iz nacrta se uvijek izvodi iz izvornog `demoModel()` preko `resizeModel()` (ne kumulativno);
  ostale vrste preko `autoModel()`. Granice su u `DIM_LIM`. Dimenzije u `TYPES` su polazne vrijednosti, ne propis.
- Dokumenti (v0.7): `P.docs[]` {id, name, url|session, demo, pageScale}, `P.docId`; `P.pdf` i `P.pageScale` uvijek pokazuju na
  aktivni dokument (`linkDoc`). Izmjere imaju `doc`; filtrirati s `inPage(m, page)`. Učitavanje PDF-a nikad ne briše podatke.
- 3D model se NIKAD ne izmišlja: `ensureModel()` vraća null ako model nije iz primjera, iz AI čitanja (`aiBuildModel` →
  `MD.modelFromAi`, izvor u `P.modelBase`, tip `ai`) ili zadan dimenzijama. Bez modela `show3dEmpty()`.
- AI čitanje nacrta: slike idu preko `cap.sample(..., { images })` (alati ne mogu vraćati slike); kote se šalju kao tekst s položajem.
- `cap.sample` prima najviše 4 slike po upitu (`cap.maxImages`): `aiBuildModel` zato ide u koracima (stranice → obris →
  visine i krov → otvori po dva pročelja), s međurezultatima u `aiMemo` da ponovni pokušaj nastavi gdje je stao.
- Više dijelova (v0.9): `P.modelSpec` {fp, roof, ridgeDir, ov, parts[{name, floors, heights[], inset{g,d,dl,l}}], facades[]} je
  izvor istine za AI model; `MD.modelFromAi(spec)` slaže `P.model` (podnožje) + `P.model.vols[]` (gornji dijelovi s `y0`,
  `levels`, vlastitim `openings`). Mjere se mijenjaju samo kroz `specWithDims` → `setObjekt`. Kod uvijek ide kroz
  `volsOf(m)`, `levelsOf(v)`, `floorsAll(m)`, `topOf(m)`; krov iz odabira nosi najgornji dio, niži imaju ravni krov (terasu).
  U 3D-u se gornji dio gradi u grupi `this.cur` podignutoj na `y0`. Stari AI modeli bez `modelSpec` idu preko `modelBase`.
- Usklađivanje (v0.10): pročelja u `modelSpec.facades[]` nose {side, sideAi, name, width, upper[{part,x0,x1}], openings[]};
  `MD.resolveSpec(spec)` bira strane pročelja i položaj gornjih dijelova (bodovi: AI očitanje, širina pročelja, otvori na zidovima;
  strane svijeta u nazivima samo kao blaga prednost, nikad kao uvjet) i postavlja `spec.res = 2`; izvorno očitana uvlaka ostaje
  u `parts[i].insetAi`. Zove se samo nakon AI čitanja i u migraciji 9, nikad nakon ručne izmjene.
  Ručno: `setObjekt(null, { parts, sides })`.
