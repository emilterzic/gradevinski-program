# Upute za rad na ovom repozitoriju

- Jezik korisnika i sučelja: hrvatski. Komentari u kodu na hrvatskom.
- Vlasnik: gradi firmu za AI implementaciju; program prodaje po EU-u, počinje od Hrvatske.
- Ciljni korisnici: projektant i izvođač. Princip: kompleksno iznutra, vrlo jednostavno za korisnika.
- Pravilo AI-a: AI predlaže (status `ai`), čovjek potvrđuje; sve mora biti ručno ispravljivo.
- `web/app.js` – cijela aplikacija (bez frameworka). `web/lib/` – pdf.js 6.2.108 (Apache-2.0), ne mijenjati.
- Model podataka (projekt): `items[]` {group, desc, unit, qty, price, priceSrc, phase, status, qtyMode, basis},
  `meas[]` {page, type length|area|count, pts u PDF točkama, value, factor, itemId}, `pageScale{page:{mPerPt}}`,
  `phases[]`, `meta{}` (podaci za ugovor), `contract{html, edited}`, `chat[]`.
- GDPR/Data Act: podaci po korisniku privatni; izvoz cijelog projekta u JSON mora uvijek raditi.
- Prije objave provjeriti: `node --check web/app.js`.
