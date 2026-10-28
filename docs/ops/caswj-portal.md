# CASWJ portal install and ownership

VolunTime stays a multi-tenant product at `clocked-in.baddley.us`. The CASWJ portal is the **same codebase** on a **subdomain**. Do not set Next.js `basePath=/portal` on the VolunTime Vercel project — emails, cookies, and `/brand/*` would break.

A later `wjarts.org/portal` path is only viable if a reverse proxy on the portal host can path-route without Next `basePath`.

## Environment

Set these on the portal project (Preview from `.env.staging`, Production from `.env.production`):

| Variable                  | Portal value                  | VolunTime product               |
| ------------------------- | ----------------------------- | ------------------------------- |
| `PUBLIC_SIGNUP`           | `false`                       | unset / `true`                  |
| `DEFAULT_ORGANIZATION_ID` | CASWJ organization UUID       | unset                           |
| `PORTAL_NAME`             | `CASWJ` or `West Jordan Arts` | unset (`VolunTime`)             |
| `APP_URL`                 | `https://portal.wjarts.org`   | `https://clocked-in.baddley.us` |

`PUBLIC_SIGNUP=false` hides Create account. Invite accept and admin Add person stay. Optional `APP_BASE_PATH` is reserved if a later path install is required; it is not in this cut.

## Hosting

1. Create a **new Vercel project** (or a custom domain on a CASWJ-owned project) for `portal.wjarts.org` pointing at this repo.
2. Copy Preview/Production env from `.env.staging` / `.env.production`, then set the portal keys above.
3. Keep `clocked-in.baddley.us` as the VolunTime product URL. Transfer or recreate that project as needed; do not replace it with the portal.
4. Move the portal (and its Postgres) to a **CASWJ-owned Vercel team**. Jason stays a collaborator.

## Azure API and Key Vault

ClockedIn.Api and secrets should live in a **CASWJ Azure tenant**, or stay shared with written access:

- Who can rotate `JWT_SIGNING_KEY`, `API_KEY_PEPPER`, `DATABASE_URL`, and Resend.
- App Service / Key Vault owners on the CASWJ side.
- Jason as collaborator until handover is done.

## DNS

- `portal.wjarts.org` → the CASWJ Vercel project.
- Later: `wjarts.org/portal` only if the portal host can reverse-proxy that path without Next `basePath`.

## Ownership checklist

This is ops, not app code. Waves 0–4 of the product do not wait on it.

- [ ] CASWJ-owned Vercel project (Jason as collaborator)
- [ ] Custom domain `portal.wjarts.org` on that project
- [ ] `PUBLIC_SIGNUP=false`
- [ ] `DEFAULT_ORGANIZATION_ID` = CASWJ organization UUID
- [ ] `PORTAL_NAME` set (`CASWJ` or `West Jordan Arts`)
- [ ] `APP_URL=https://portal.wjarts.org`
- [ ] Preview env from `.env.staging`, Production from `.env.production`
- [ ] Shared/staging seed is `npm run db:seed:caswj:anon`
- [ ] Named workbook only on a CASWJ machine with `SEED_ALLOW_REAL_NAMES=1`
- [ ] Postgres in a CASWJ tenant (or written shared-access agreement)
- [ ] ClockedIn.Api + Key Vault in a CASWJ Azure tenant (or written shared-access)
- [ ] Who can rotate `JWT_SIGNING_KEY`, `API_KEY_PEPPER`, `DATABASE_URL`, and Resend
- [ ] Do **not** set Next.js `basePath=/portal`

## Production seed

CASWJ staff run the **named** workbook import on the CASWJ-owned database (`SEED_ALLOW_REAL_NAMES=1` on that machine). Do not commit real names and do not auto-seed them from CI. Staging uses `npm run db:seed:caswj:anon`.
