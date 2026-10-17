const url = process.env.DATABASE_URL ?? "";
const scheme = url.includes("://") ? url.slice(0, url.indexOf("://")) : url ? "set" : "unset";

console.log(
  JSON.stringify(
    {
      APP_ENV: process.env.APP_ENV ?? null,
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? null,
      API_TARGET: process.env.API_TARGET ?? null,
      DATABASE_URL: scheme,
      API_BASE_URL: process.env.API_BASE_URL ? "set" : "unset",
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV ?? null,
    },
    null,
    2,
  ),
);
