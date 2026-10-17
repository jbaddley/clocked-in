# Clocked In

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

| | File | Database | API |
| --- | --- | --- | --- |
| Local | `.env` | PostgreSQL | Next.js |
| Staging | `.env.staging` | PostgreSQL | Next.js |
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

Both servers implement the HTTP contract in [docs/api/http.md](docs/api/http.md). The Next.js routes are on port 3025. The .NET API listens on port 5103. They share `JWT_SIGNING_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`, and the Resend settings in `.env`.

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
