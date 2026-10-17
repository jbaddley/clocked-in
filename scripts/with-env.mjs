import { spawn } from "node:child_process";
import { delimiter, join } from "node:path";
import { loadAppEnv, appEnvs } from "./app-env.mjs";

const argv = process.argv.slice(2);
const separator = argv.indexOf("--");
if (separator < 0) {
  throw new Error("Usage: node scripts/with-env.mjs [local|staging|production] -- <command> [args]");
}

const requested = argv.slice(0, separator);
if (requested.length > 1 || (requested.length === 1 && !appEnvs.includes(requested[0]))) {
  throw new Error(`Expected one of ${appEnvs.join(", ")} before --.`);
}

const appEnv = loadAppEnv({
  appEnv: requested[0],
  forceFile: requested.length === 1,
});

const command = argv.slice(separator + 1);
if (command.length === 0) {
  throw new Error("Missing command after --.");
}

const env = {
  ...process.env,
  APP_ENV: appEnv,
  PATH: `${join(process.cwd(), "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
};

const child = spawn(command[0], command.slice(1), {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
