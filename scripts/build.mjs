import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";
import { assertAppEnv } from "./app-env.mjs";

assertAppEnv();

const env = {
  ...process.env,
  PATH: `${join(process.cwd(), "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
};

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("prisma", ["generate"]);
run("next", ["build"]);
