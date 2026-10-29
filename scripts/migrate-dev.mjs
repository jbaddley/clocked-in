import { spawnSync } from "node:child_process";
import { assertAppEnv } from "./app-env.mjs";

assertAppEnv();
const database = new URL(process.env.DATABASE_URL ?? "");
if (process.env.APP_ENV !== "local" || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) {
  throw new Error("migrate dev is restricted to local PostgreSQL. Use db:deploy for staging and production.");
}

const result = spawnSync("prisma", ["migrate", "dev", "--config", "prisma7.config.ts", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
