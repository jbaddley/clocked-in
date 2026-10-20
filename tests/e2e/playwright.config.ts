import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

const root = process.cwd();
config({ path: path.join(root, ".env") });

const prod = process.env.E2E_ENV?.toUpperCase() === "PROD";
const baseURL = prod
  ? process.env.E2E_BASE_URL || "https://clocked-in.baddley.us/"
  : process.env.E2E_BASE_URL || "http://localhost:3025";

export default defineConfig({
  testDir: ".",
  testIgnore: prod ? ["**/caswj-hours.spec.ts", "**/add-person.spec.ts"] : ["**/cache-bust.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: prod ? 240_000 : 120_000,
  expect: { timeout: prod ? 20_000 : 15_000 },
  globalSetup: "./global-setup.ts",
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    !prod && process.env.E2E_WEB_SERVER === "1"
      ? {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          cwd: root,
        }
      : undefined,
});
