# Clocked In

Next.js app with Tailwind CSS, shadcn/ui, and Prisma (PostgreSQL), ready to deploy on Vercel.

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma with PostgreSQL

## Local setup

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your Postgres connection string, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

The Prisma schema is `prisma/schema.prisma`. Connection settings are in `prisma7.config.ts`.

```bash
npx prisma migrate dev
```

`prisma generate` runs after install and before `next build`.

## Deploy

Import this repo in [Vercel](https://vercel.com/new) and set `DATABASE_URL` in the project environment. Use the default Next.js build.
