# Docs

- [VolunTime requirements and feedback audit](voluntime-audit.md) — current status vs the Oct 15 brief and Dillon’s Oct 27 feedback, remaining gaps, and answers to his questions.
- [Original goals assessment](original-goals-assessment.md) — Oct 21 snapshot against the brief. Superseded for current status.
- [HTTP contract](api/http.md) — shared Next.js and ClockedIn.Api API.
- [Domain schema](schema/domain.md) — entities, roles, rates, and time modes.
- [CASWJ portal runbook](ops/caswj-portal.md) — subdomain install, ownership, and DNS.

## Base materials

Brand, brief, and seed workbooks live in [`docs/base/`](base/):

- `2026 Volunteer Hours.xlsx` — named local seed and the 14,609-hour golden suite. Never point Playwright `caswj-hours` at production.
- `clockify-export-ANONYMIZED-sample.xlsx` — synthetic names for `npm run db:seed:caswj:anon` on staging.
- `caswj-gradient-usage.png` — approved brand-hero treatments.
- CASWJ brand guidelines and the original project brief.

Named workbook import is local-only (`APP_ENV=local`) unless `SEED_ALLOW_REAL_NAMES=1`.
