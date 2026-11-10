# Građevinski program

Bazni građevinski program za EU: nacrt (PDF/BIM) → izmjera (AI prijedlog + ručno) → troškovnik → ugovor.
Korisnici: **projektant** (opisi i količine, projektantski troškovnik) i **izvođač** (cijene, ponuda, ugovor).

## Stanje: prototip v0.1 (studeni 2026.)

Web aplikacija u mapi `web/` (čisti HTML + JavaScript, bez build koraka):

- **Nacrt**: PDF nacrti (pdf.js), automatsko mjerilo iz zaglavlja („mjerilo: 1:100”) ili kalibracija po poznatoj koti;
  alati Duljina (m), Površina (m²), Komad (kom) s faktorom (npr. × visina zida).
- **Stavke**: svaka ima status *AI prijedlog* / *Potvrđeno* / *Ručno* / *Izmjereno* i obrazloženje količine.
  Sve se može ručno ispraviti; izmjere se automatski zbrajaju u količinu stavke.
- **Troškovnik**: 14 vrsta radova (pripremni → instalacije), faze gradnje, rekapitulacija, PDV 25 %,
  izvoz u Excel (.csv) i Word (.docx), izvoz/uvoz projekta (.json, prenosivost podataka).
- **Ugovor**: ugovor o građenju generiran iz troškovnika (plaćanje po fazama, jamstva, rokovi), uređiv, izvoz .docx.
- **AI asistent**: chat s glasovnim unosom i brzim gumbima; alatima mijenja troškovnik (dodaj/promijeni/obriši stavke,
  cijene, faze, podatke ugovora). Svaka AI promjena je označena i može se poništiti.

Objavljena verzija radi kao Claude artefakt (spremanje u oblak, AI, diktat, preuzimanja dolaze iz platforme).
Lokalno: `cd web && python3 -m http.server` → http://localhost:8000 (bez AI-ja; spremanje u preglednik).

## Dokumenti

- `docs/koncept-v0.1.md` – koncept, arhitektura (jezgra + državni paketi), zakoni EU, plan faza.

## Plan

Faza 0 temelj → 1 MVP Hrvatska → 2 AI izmjera nacrta → 3 druga država → 4 gradilište/mobitel.
