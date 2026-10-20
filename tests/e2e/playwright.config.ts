import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

const root = process.cwd();
config({ path: path.join(root, ".env") });

const e2eEnv = process.env.E2E_ENV?.toUpperCase();
const prod = e2eEnv === "PROD";
const staging = e2eEnv === "STAGING";
const remote = prod || staging;
const defaultRemoteUrl = staging ? "https://staging.clocked-in.baddley.us/" : "https://clocked-in.baddley.us/";
const baseURL = remote ? process.env.E2E_BASE_URL || defaultRemoteUrl : process.env.E2E_BASE_URL || "http://localhost:3025";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const localSeedOnly = ["**/caswj-hours.spec.ts", "**/add-person.spec.ts", "**/feedback.spec.ts"];

export default defineConfig({
  testDir: ".",
  testMatch: prod ? "**/cache-bust.spec.ts" : "**/*.spec.ts",
  testIgnore: prod ? [] : staging ? localSeedOnly : ["**/cache-bust.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: remote ? 480_000 : 120_000,
  expect: { timeout: remote ? 60_000 : 15_000 },
  globalSetup: "./global-setup.ts",
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    !remote && process.env.E2E_WEB_SERVER === "1"
      ? {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          cwd: root,
        }
      : undefined,
});
