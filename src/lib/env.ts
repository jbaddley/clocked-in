export type AppEnv = "local" | "staging" | "production";
export type DatabaseProvider = "postgresql" | "sqlserver";
export type ApiTarget = "next" | "csharp";

export function appEnv(): AppEnv {
  const value = process.env.APP_ENV;
  if (value === "staging" || value === "production") return value;
  return "local";
}

export function databaseProvider(): DatabaseProvider {
  return process.env.DATABASE_PROVIDER === "sqlserver" ? "sqlserver" : "postgresql";
}

export function apiTarget(): ApiTarget {
  return process.env.API_TARGET === "csharp" ? "csharp" : "next";
}

/** Origin of the C# API in production. Empty for the in-process Next.js API. */
export function apiBaseUrl() {
  const value = process.env.API_BASE_URL?.trim().replace(/\/$/, "");
  return value || null;
}
