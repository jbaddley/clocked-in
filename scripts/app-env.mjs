import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const appEnvs = ["local", "staging", "production"];

const envFiles = {
  local: ".env",
  staging: ".env.staging",
  production: ".env.production",
};

export function detectAppEnv() {
  const explicit = process.env.APP_ENV?.trim();
  if (explicit) {
    return requireAppEnv(explicit, "APP_ENV");
  }

  const target = process.env.VERCEL_TARGET_ENV?.trim();
  if (target === "production") return "production";
  if (target === "staging") return "staging";
  if (target === "preview") return "staging";
  if (target === "development") return "local";
  if (target) {
    throw new Error(
      `VERCEL_TARGET_ENV "${target}" is not supported. Use production, preview, development, or a custom environment named staging.`,
    );
  }

  const vercel = process.env.VERCEL_ENV?.trim();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "staging";
  if (vercel === "development") return "local";
  if (vercel) {
    throw new Error(`VERCEL_ENV "${vercel}" is not supported.`);
  }

  return "local";
}

export function envFileFor(appEnv) {
  return envFiles[requireAppEnv(appEnv, "app environment")];
}

/**
 * Load the env file for this deployment.
 * Platform variables already in the environment win, unless `forceFile` is set
 * (an explicit local, staging, or production command).
 */
export function loadAppEnv({ appEnv, forceFile = false } = {}) {
  if (appEnv) {
    process.env.APP_ENV = requireAppEnv(appEnv, "app environment");
  }

  const resolved = detectAppEnv();
  const file = envFileFor(resolved);
  const path = resolve(file);
  if (existsSync(path)) {
    const kept = forceFile ? protectedKeys() : new Set(Object.keys(process.env));
    for (const [key, value] of parseEnv(readFileSync(path, "utf8"))) {
      if (forceFile ? !kept.has(key) : !kept.has(key) || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  } else if (forceFile) {
    throw new Error(`Missing ${file}. Copy the matching block in .env.example.`);
  }

  process.env.APP_ENV = resolved;
  process.env.DATABASE_PROVIDER = normalizeProvider(process.env.DATABASE_PROVIDER);

  return resolved;
}

export function assertAppEnv() {
  const appEnv = requireAppEnv(process.env.APP_ENV?.trim() || detectAppEnv(), "APP_ENV");
  process.env.DATABASE_PROVIDER = normalizeProvider(process.env.DATABASE_PROVIDER);
  if (process.env.VERCEL && !isPostgresUrl(process.env.DATABASE_URL)) {
    throw new Error(
      `${label(appEnv)} DATABASE_URL must be a postgresql:// or postgres:// URL. Set it in the Vercel ${appEnv === "production" ? "Production" : "Preview"} environment.`,
    );
  }
}

export function normalizeProvider(value) {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "" || raw === "postgres" || raw === "postgresql" || raw === "postgressql") return "postgresql";
  throw new Error(`DATABASE_PROVIDER must be "postgresql"${seen(value)}.`);
}

function requireAppEnv(value, source) {
  if (appEnvs.includes(value)) return value;
  throw new Error(`${source} must be "local", "staging", or "production"${seen(value)}.`);
}

function protectedKeys() {
  return new Set(["PATH", "HOME", "USER", "SHELL", "TMPDIR", "NODE_OPTIONS", "npm_config_user_agent"]);
}

function parseEnv(text) {
  const entries = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = body.indexOf("=");
    if (separator <= 0) continue;
    const key = body.slice(0, separator).trim();
    let value = body.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}

function isPostgresUrl(value) {
  return value?.startsWith("postgresql://") || value?.startsWith("postgres://") || false;
}

function label(appEnv) {
  if (appEnv === "staging") return "Staging";
  if (appEnv === "production") return "Production";
  return "Local";
}

function seen(value) {
  return value ? ` (got "${value}")` : " (unset)";
}
