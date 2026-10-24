import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const port = 5103;
const url = `http://127.0.0.1:${port}/openapi/v1.json`;
const out = path.join("src", "lib", "developer", "openapi.json");

const child = spawn("dotnet", ["run", "--project", "ClockedIn.Api", "--launch-profile", "http"], {
  env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Development" },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

const deadline = Date.now() + 90_000;
let body = null;
while (Date.now() < deadline) {
  if (child.exitCode !== null) break;
  try {
    const response = await fetch(url);
    if (response.ok) {
      body = await response.text();
      break;
    }
  } catch {
    // The API is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

child.kill("SIGTERM");
await new Promise((resolve) => child.once("exit", resolve));

if (!body) {
  console.error(logs.slice(-4000));
  throw new Error(`Could not read ${url}`);
}

const document = JSON.parse(body);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${out} (${Object.keys(document.paths ?? {}).length} paths)`);
