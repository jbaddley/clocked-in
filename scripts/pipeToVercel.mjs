#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const usage = `Usage:
  npm run pipeToVercel -- --env <staging|preview|production|local|development> --var <VAR_NAME> [--sensitive [true|false]]
  node scripts/pipeToVercel.mjs --env <staging|preview|production|local|development> --var <VAR_NAME> [--sensitive [true|false]]`;

function fail(message) {
  console.error(message);
  console.error(usage);
  process.exit(1);
}

function parseArgs(argv) {
  let env = "";
  let variable = "";
  let sensitive = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;

    if (arg === "--env" || arg === "-e") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) fail("Missing value for --env.");
      env = next.trim();
      i += 1;
      continue;
    }
    if (arg.startsWith("--env=")) {
      env = arg.slice("--env=".length).trim();
      continue;
    }

    if (arg === "--var" || arg === "-v") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) fail("Missing value for --var.");
      variable = next.trim();
      i += 1;
      continue;
    }
    if (arg.startsWith("--var=")) {
      variable = arg.slice("--var=".length).trim();
      continue;
    }

    if (arg === "--sensitive") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        const normalized = next.trim().toLowerCase();
        if (normalized === "true" || normalized === "1" || normalized === "yes") {
          sensitive = true;
          i += 1;
          continue;
        }
        if (normalized === "false" || normalized === "0" || normalized === "no") {
          sensitive = false;
          i += 1;
          continue;
        }
      }
      sensitive = true;
      continue;
    }
    if (arg.startsWith("--sensitive=")) {
      const normalized = arg.slice("--sensitive=".length).trim().toLowerCase();
      sensitive = normalized !== "false" && normalized !== "0" && normalized !== "no";
      continue;
    }
    if (arg === "--no-sensitive") {
      sensitive = false;
      continue;
    }

    fail(`Unknown argument "${arg}".`);
  }

  return { env, variable, sensitive };
}

function resolveEnvTarget(rawEnv) {
  const normalized = rawEnv.toLowerCase();
  if (normalized === "production" || normalized === "prod") {
    return { envFile: ".env.production", vercelEnv: "production" };
  }
  if (normalized === "staging" || normalized === "preview") {
    return { envFile: ".env.staging", vercelEnv: "preview" };
  }
  if (normalized === "local" || normalized === "development" || normalized === "dev") {
    return { envFile: ".env", vercelEnv: "development" };
  }
  fail(`Invalid --env "${rawEnv}". Expected staging, preview, production, local, or development.`);
}

function readVarFromEnvFile(filePath, targetKey) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    fail(`Environment file "${filePath}" does not exist.`);
  }

  const content = readFileSync(fullPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = body.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = body.slice(0, eqIndex).trim();
    if (key !== targetKey) continue;

    let value = body.slice(eqIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return null;
}

const { env, variable, sensitive } = parseArgs(process.argv.slice(2));
if (!env) fail("Missing required --env argument.");
if (!variable) fail("Missing required --var argument.");
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
  fail(`Invalid variable name "${variable}".`);
}

const { envFile, vercelEnv } = resolveEnvTarget(env);
const value = readVarFromEnvFile(envFile, variable);
if (value === null) {
  fail(`Variable "${variable}" was not found in ${envFile}.`);
}
if (value === "") {
  fail(`Variable "${variable}" is empty in ${envFile}.`);
}

const vercelArgs = [
  "env",
  "add",
  variable,
  "--environment",
  vercelEnv,
  sensitive ? "--sensitive" : "--no-sensitive",
  "--force",
  "--yes",
];

console.log(
  `Piping ${variable} from ${envFile} to Vercel (${vercelEnv}, ${sensitive ? "secret/sensitive" : "config"})...`,
);

const result = spawnSync("vercel", vercelArgs, {
  input: value,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
});

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 1);
