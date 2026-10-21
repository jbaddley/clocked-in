# Voluntime

Next.js app with Tailwind CSS, shadcn/ui, and Prisma. Local, staging, and production use PostgreSQL.

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma with PostgreSQL

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d
dotnet ef database update --project ClockedIn.Api
npx prisma generate
npm run dev
```

Open [http://localhost:3025](http://localhost:3025).

## Environments

|            | File              | Database   | API     |
| ---------- | ----------------- | ---------- | ------- |
| Local      | `.env`            | PostgreSQL | Next.js |
| Staging    | `.env.staging`    | PostgreSQL | Next.js |
| Production | `.env.production` | PostgreSQL | Next.js |

`APP_ENV` is `local`, `staging`, or `production`. `DATABASE_PROVIDER` is `postgresql`. `API_TARGET` is `next` for the Next.js API and `csharp` when the contract tests call the .NET API.

```bash
npm run dev
npm run dev:staging
npm run build:staging
npm run build:production
npm run env:print
```

The Prisma schema uses the PostgreSQL provider. Prisma and the .NET API both read a `postgres://` or `postgresql://` URL.

## Database

One local Postgres database runs in Docker on port 5435. Both apps use it:

- `DATABASE_URL` is what Prisma and the Next.js API read.
- `EF_DATABASE_URL` is what the .NET API reads. Locally it is the same connection. The .NET host reads `.env`, or `.env.staging` / `.env.production` when `APP_ENV` is set.

Entity Framework owns DDL. Apply schema changes with `dotnet ef migrations add` and `dotnet ef database update --project ClockedIn.Api`. After an EF migration, refresh Prisma types with `npm run db:pull`. Do not run Prisma migrations.

The Prisma schema is `prisma/schema.prisma`. Connection settings are in `prisma7.config.ts`. `prisma generate` runs after install and before `next build`.

The .NET API is in `ClockedIn.Api`. It reads `EF_DATABASE_URL` from the repo `.env`.

```bash
dotnet ef database update --project ClockedIn.Api
dotnet run --project ClockedIn.Api --launch-profile http
```

Both servers implement the HTTP contract in [docs/api/http.md](docs/api/http.md). The Next.js routes are on port 3025. The .NET API listens on port 5103. They share `JWT_SIGNING_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`, `API_KEY_PEPPER`, the Resend settings, and optional `GITHUB_TOKEN` / `GITHUB_REPO` in `.env`.

Docs live in [docs/README.md](docs/README.md). Brand files and seed workbooks are in [docs/base/](docs/base/). The [original goals assessment](docs/original-goals-assessment.md) tracks brief vs shipped.

## Seed and Playwright

```bash
npm run db:seed:caswj
npm run db:seed:caswj:anon
```

`db:seed:caswj` imports `docs/base/2026 Volunteer Hours.xlsx` (real names) and is **local-only**. It no-ops on staging/production unless `SEED_ALLOW_REAL_NAMES=1`. Staging uses the anonymized Clockify sample. The Playwright golden suite (`tests/e2e/caswj-hours.spec.ts`) needs that named local seed and must never run against production. Production e2e is the read-only cache-bust crawl.

Set `CSHARP_API_URL` (for example `http://127.0.0.1:5103` or the App Service origin) to make Next.js a BFF that forwards REST calls to ClockedIn.Api. Leave it unset to keep the Next.js API. `/health` stays on Next.js.

## Deploy the .NET API

Publish to **Azure App Service on Linux** (no container):

```bash
dotnet publish ClockedIn.Api -c Release -o ./publish
```

`.github/workflows/deploy-api.yml` publishes that folder with `azure/webapps-deploy` and runs `dotnet ef database update --project ClockedIn.Api` first. Startup does not migrate. Set GitHub secrets `AZURE_WEBAPP_NAME`, `AZURE_WEBAPP_PUBLISH_PROFILE`, and `EF_DATABASE_URL`.

Give the web app a system-assigned managed identity and store secrets in Key Vault. Point App Settings at Key Vault with `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/)`. Use `/health` as the health path.

| App Setting                                     | Role                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `EF_DATABASE_URL`                               | Postgres URL (`postgres://` or `postgresql://`)                                              |
| `JWT_SIGNING_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE` | Same values as the Next.js app                                                               |
| `API_KEY_PEPPER`                                | HMAC pepper for organization and platform API keys (at least 32 characters)                  |
| `APP_URL`                                       | Public site URL used in invite and reset emails                                              |
| `RESEND_API_KEY`, `EMAIL_FROM`                  | Outbound mail                                                                                |
| `GITHUB_TOKEN`, `GITHUB_REPO`                   | Optional. Create a GitHub issue for each feedback item (`owner/name`)                        |
| `ASPNETCORE_ENVIRONMENT`                        | `Production` or `Staging`                                                                    |
| `CORS_ORIGINS`                                  | Optional comma-separated browser origins (Vercel and MCP web clients). Defaults to `APP_URL` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING`         | Optional Application Insights                                                                |

MCP is Streamable HTTP at `/mcp` on both hosts. ClockedIn.Api accepts organization API keys on REST and MCP. The Next.js app accepts the same keys on `/mcp` (Bearer or `X-Api-Key`); Next.js REST routes still require a user JWT. Clients change only the URL:

```json
{
  "mcpServers": {
    "clocked-in": {
      "url": "https://<next-host>/mcp",
      "headers": {
        "Authorization": "Bearer cki_live_…"
      }
    }
  }
}
```

A SuperAdmin is a user flag, not a membership role. Set the first one in the shared database:

```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE "email" = 'you@example.com';
```

HTTP contract tests (`npm run test:http:next` and `npm run test:http:csharp`) share this database. Run one target at a time.

## Deploy

Import this repo in [Vercel](https://vercel.com/new). The build command is `npm run build`.

Vercel sets `NODE_ENV=production` for both Production and Preview, so Next.js would load `.env.production` for a staging deploy if that file were in the repo. Leave `.env`, `.env.staging`, and `.env.production` uncommitted. Set the variables in the Vercel project instead:

- **Production** — the values from `.env.production`: `APP_ENV=production`, `DATABASE_PROVIDER=postgresql`, `API_TARGET=next`, and the production `postgres://` or `postgresql://` `DATABASE_URL`.
- **Preview** — the values from `.env.staging`: `APP_ENV=staging`, `DATABASE_PROVIDER=postgresql`, `API_TARGET=next`, and the staging Postgres URL. Preview is staging. A custom environment named `staging` is treated the same way.

Once ClockedIn.Api is the public API and MCP host, set `CSHARP_API_URL` on Vercel to the App Service origin so the Next.js app is a BFF. Keep `JWT_SIGNING_KEY`, `JWT_ISSUER`, and `JWT_AUDIENCE` in sync. Organization and platform API keys live only on ClockedIn.Api.
