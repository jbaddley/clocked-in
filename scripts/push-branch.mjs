import { spawnSync } from "node:child_process";

const usage = `Usage: node scripts/push-branch.mjs --branch <name> -- "<message>"
       npm run push:staging -- "<message>"
       npm run push:production -- "<message>"`;

function fail(message) {
  console.error(message);
  console.error(usage);
  process.exit(1);
}

function git(args, { inherit = false } = {}) {
  const result = spawnSync("git", args, {
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (!inherit) {
      const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
      if (detail) console.error(detail);
    }
    process.exit(result.status ?? 1);
  }
  return inherit ? "" : (result.stdout ?? "").trim();
}

function refExists(ref) {
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function parseArgs(argv) {
  let branch = "";
  const messageParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--branch" || arg === "-b") {
      const value = argv[i + 1];
      if (!value || value === "--" || value.startsWith("-")) {
        fail("Missing value for --branch.");
      }
      branch = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--branch=")) {
      branch = arg.slice("--branch=".length);
      continue;
    }
    messageParts.push(arg);
  }

  return { branch, message: messageParts.join(" ").trim() };
}

const { branch, message } = parseArgs(process.argv.slice(2));

if (!branch) fail("Branch is required. Pass --branch <name>.");
if (!message) fail("Commit message is required.");
if (branch.startsWith("-") || branch.includes("..") || /[\s~^:?*[\\]/.test(branch)) {
  fail(`Invalid branch name "${branch}".`);
}

git(["rev-parse", "--show-toplevel"]);

const hasLocal = refExists(`refs/heads/${branch}`);
const hasRemote = refExists(`refs/remotes/origin/${branch}`);
if (!hasLocal && !hasRemote) {
  console.error(
    `Branch "${branch}" does not exist locally or on origin. Create it before pushing.`,
  );
  process.exit(1);
}

const current = git(["branch", "--show-current"]);
if (current !== branch) {
  git(hasLocal ? ["switch", branch] : ["switch", "--track", `origin/${branch}`], {
    inherit: true,
  });
}

git(["add", "-A"], { inherit: true });

const staged = spawnSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
if (staged.status === 0) {
  console.error("Nothing to commit.");
  process.exit(1);
}
if (staged.status !== 1) process.exit(staged.status ?? 1);

git(["commit", "-m", message], { inherit: true });
git(["push", "-u", "origin", branch], { inherit: true });
