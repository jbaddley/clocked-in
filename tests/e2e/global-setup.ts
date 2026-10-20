import { execSync } from "node:child_process";
import path from "node:path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: path.join(root, ".env") });

export default function globalSetup() {
  if (!process.env.SEED_SUPERADMIN_PASSWORD?.trim()) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required.");
  }

  const e2eEnv = process.env.E2E_ENV?.toUpperCase();
  if (e2eEnv === "PROD" || e2eEnv === "STAGING" || process.env.E2E_SKIP_SEED === "1") {
    return;
  }

  execSync("npm run db:seed:caswj", { stdio: "inherit", cwd: root, env: process.env });
}
