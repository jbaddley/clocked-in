#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: node .cursor/skills/feature-workflow/scripts/workflow.mjs <command> [options]

Commands:
  worktree-add --feature <name> --description <text> [--id <id>]
  init --feature <name> --description <text> [--id <id>]
  show [id]
  set-plan [id] --path <path>
  set-issue [id] --number <n> --url <url>
  set-pr [id] --url <url>
  set-sha [id] --sha <sha>
  status [id] <status>
  check [id] <step-id>
  issue [id]
  push-staging [id]
  wait-deploy --env staging|production [--sha <sha>] [id]
  wait-staging-e2e [id]
  test --target local|staging|production [id]
  create-pr [id]
  wait-pr-merged [id]
  worktree-remove [id] [--force]
`;

const STATUSES = [
  "planning",
  "implementing",
  "testing",
  "awaiting_staging_approval",
  "awaiting_pr_approval",
  "awaiting_production",
  "done",
];

const STEPS = [
  { id: "issue", label: "Create or lookup a GitHub issue" },
  { id: "implement", label: "Implement the feature using the approved plan or description" },
  { id: "tests", label: "Create tests (HTTP contract and e2e); tests must pass" },
  { id: "staging", label: "Push to staging and wait for the Staging E2E GitHub Action" },
  { id: "staging-approval", label: "Staging E2E passed, so continue without a manual staging check" },
  { id: "pr", label: "Create a PR into main; notify user to approve" },
  { id: "production", label: "After PR approval, wait for main deploy and verify clocked-in.baddley.us" },
];

const HEALTH = {
  staging: "https://staging.clocked-in.baddley.us/health",
  production: "https://clocked-in.baddley.us/health",
};

const DEPLOY_ATTEMPTS = 40;
const DEPLOY_WAIT_MS = 15_000;
const STAGING_E2E_ATTEMPTS = 90;
const STAGING_E2E_WAIT_MS = 15_000;
const PR_ATTEMPTS = 60;
const PR_WAIT_MS = 15_000;

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
        continue;
      }
      flags[key] = next;
      i += 1;
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional };
}

function run(command, args, { cwd, inherit = false, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    if (!inherit) {
      const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
      if (detail) console.error(detail);
    }
    process.exit(result.status ?? 1);
  }
  return inherit ? "" : (result.stdout ?? "").trim();
}

function tryRun(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function git(args, opts) {
  return run("git", args, opts);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) fail("Could not derive an id from the feature name.");
  return slug;
}

function assertId(id) {
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    fail(`Invalid workflow id "${id ?? ""}". Use lowercase letters, numbers, and hyphens.`);
  }
  return id;
}

function primaryRoot() {
  const common = git(["rev-parse", "--git-common-dir"]);
  const abs = path.resolve(process.cwd(), common);
  return path.basename(abs) === ".git" ? path.dirname(abs) : abs;
}

function worktreePath(root, id) {
  return path.join(root, ".worktrees", id);
}

function workflowJsonPath(wt) {
  return path.join(wt, ".workflows", `${path.basename(wt)}.json`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeWorkflow(file, data) {
  const next = { ...data, updatedAt: nowIso() };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function listWorktreePaths(root) {
  const listed = [];
  const porcelain = tryRun("git", ["worktree", "list", "--porcelain"], { cwd: root });
  if (porcelain.status === 0) {
    for (const line of porcelain.stdout.split("\n")) {
      if (line.startsWith("worktree ")) listed.push(line.slice("worktree ".length));
    }
  }
  const extraDir = path.join(root, ".worktrees");
  if (fs.existsSync(extraDir)) {
    for (const entry of fs.readdirSync(extraDir, { withFileTypes: true })) {
      if (entry.isDirectory()) listed.push(path.join(extraDir, entry.name));
    }
  }
  return [...new Set(listed)];
}

function discoverWorkflows(root) {
  const found = [];
  for (const wt of listWorktreePaths(root)) {
    const dir = path.join(wt, ".workflows");
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(dir, name);
      try {
        const data = readJson(file);
        found.push({ file, worktree: wt, data });
      } catch {
        // skip malformed
      }
    }
  }
  return found.sort((a, b) => String(b.data.updatedAt ?? "").localeCompare(String(a.data.updatedAt ?? "")));
}

function resolveWorkflow(root, id) {
  const all = discoverWorkflows(root);
  if (id) {
    const match = all.find((item) => item.data.id === id);
    if (!match) fail(`No workflow found for id "${id}".`);
    return match;
  }
  if (all.length === 0) fail("No workflow found. Run worktree-add first.");
  return all[0];
}

function withResolved(item) {
  return {
    ...item.data,
    resolvedWorktreePath: item.worktree,
    resolvedJsonPath: item.file,
  };
}

function emptySteps() {
  return STEPS.map((step) => ({ ...step, done: false }));
}

function createWorkflowRecord({ id, feature, description, worktreeRel, branch }) {
  const createdAt = nowIso();
  return {
    id,
    feature,
    description,
    status: "planning",
    worktreePath: worktreeRel,
    worktreeBranch: branch,
    githubTicketId: null,
    githubTicketUrl: null,
    plan: `.workflows/plans/${id}.md`,
    prUrl: null,
    commitSha: null,
    steps: emptySteps(),
    createdAt,
    updatedAt: createdAt,
  };
}

function linkEnvFiles(root, wt) {
  for (const name of [".env", ".env.staging", ".env.production", ".env.local"]) {
    const source = path.join(root, name);
    const target = path.join(wt, name);
    if (!fs.existsSync(source) || fs.existsSync(target)) continue;
    fs.symlinkSync(source, target);
  }
}

function requireFlag(flags, key) {
  const value = flags[key];
  if (value === undefined || value === true || value === "") {
    fail(`Missing --${key}.`);
  }
  return String(value);
}

function commandWorktreeAdd(root, flags) {
  const feature = requireFlag(flags, "feature");
  const description = requireFlag(flags, "description");
  const id = assertId(flags.id && flags.id !== true ? String(flags.id) : slugify(feature));
  const branch = `workflow/${id}`;
  const wt = worktreePath(root, id);
  const rel = path.relative(root, wt);
  const existing = discoverWorkflows(root).find((item) => item.data.id === id);

  if (existing) {
    printJson({ reused: true, ...withResolved(existing) });
    return;
  }

  git(["fetch", "origin", "main"], { cwd: root, inherit: true });

  if (fs.existsSync(wt)) {
    if (!listWorktreePaths(root).includes(wt)) {
      fail(`Path ${rel} already exists and is not a git worktree.`);
    }
    linkEnvFiles(root, wt);
    const record = initInWorktree(wt, { id, feature, description, worktreeRel: rel, branch });
    printJson({ reused: true, ...record, resolvedWorktreePath: wt, resolvedJsonPath: workflowJsonPath(wt) });
    return;
  }

  const hasBranch = tryRun("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: root,
  }).status === 0;

  if (hasBranch) {
    git(["worktree", "add", wt, branch], { cwd: root, inherit: true });
  } else {
    git(["worktree", "add", "-b", branch, wt, "origin/main"], { cwd: root, inherit: true });
  }

  linkEnvFiles(root, wt);
  run("npm", ["ci"], { cwd: wt, inherit: true });

  const record = initInWorktree(wt, { id, feature, description, worktreeRel: rel, branch });
  printJson({ created: true, ...record, resolvedWorktreePath: wt, resolvedJsonPath: workflowJsonPath(wt) });
}

function initInWorktree(wt, { id, feature, description, worktreeRel, branch }) {
  const file = workflowJsonPath(wt);
  if (fs.existsSync(file)) return readJson(file);

  const plansDir = path.join(wt, ".workflows", "plans");
  fs.mkdirSync(plansDir, { recursive: true });
  const record = createWorkflowRecord({ id, feature, description, worktreeRel, branch });
  const planFile = path.join(wt, record.plan);
  if (!fs.existsSync(planFile)) fs.writeFileSync(planFile, "");
  return writeWorkflow(file, record);
}

function commandInit(root, flags) {
  const feature = requireFlag(flags, "feature");
  const description = requireFlag(flags, "description");
  const id = assertId(flags.id && flags.id !== true ? String(flags.id) : slugify(feature));
  const wt = worktreePath(root, id);
  if (!fs.existsSync(wt)) fail(`Worktree ${path.relative(root, wt)} does not exist. Run worktree-add first.`);
  const record = initInWorktree(wt, {
    id,
    feature,
    description,
    worktreeRel: path.relative(root, wt),
    branch: `workflow/${id}`,
  });
  printJson({ ...record, resolvedWorktreePath: wt, resolvedJsonPath: workflowJsonPath(wt) });
}

function commandShow(root, id) {
  printJson(withResolved(resolveWorkflow(root, id)));
}

function updateWorkflow(root, id, patch) {
  const item = resolveWorkflow(root, id);
  const next = writeWorkflow(item.file, { ...item.data, ...patch });
  printJson({ ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
}

function commandSetPlan(root, id, flags) {
  updateWorkflow(root, id, { plan: requireFlag(flags, "path") });
}

function commandSetIssue(root, id, flags) {
  const number = Number(requireFlag(flags, "number"));
  if (!Number.isInteger(number) || number <= 0) fail("--number must be a positive integer.");
  updateWorkflow(root, id, {
    githubTicketId: number,
    githubTicketUrl: requireFlag(flags, "url"),
  });
}

function commandSetPr(root, id, flags) {
  updateWorkflow(root, id, { prUrl: requireFlag(flags, "url") });
}

function commandSetSha(root, id, flags) {
  updateWorkflow(root, id, { commitSha: requireFlag(flags, "sha") });
}

function commandStatus(root, id, status) {
  if (!STATUSES.includes(status)) {
    fail(`Invalid status "${status}". Use one of: ${STATUSES.join(", ")}`);
  }
  updateWorkflow(root, id, { status });
}

function commandCheck(root, id, stepId) {
  const item = resolveWorkflow(root, id);
  const steps = item.data.steps.map((step) => (step.id === stepId ? { ...step, done: true } : step));
  if (!steps.some((step) => step.id === stepId)) {
    fail(`Unknown step "${stepId}". Use one of: ${STEPS.map((step) => step.id).join(", ")}`);
  }
  const next = writeWorkflow(item.file, { ...item.data, steps });
  printJson({ ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
}

function commandIssue(root, id) {
  const item = resolveWorkflow(root, id);
  const title = item.data.feature;
  const search = tryRun(
    "gh",
    ["issue", "list", "--state", "all", "--limit", "50", "--json", "number,title,url,state", "--search", title],
    { cwd: item.worktree },
  );
  if (search.status !== 0) fail(search.stderr || "gh issue list failed.");

  const issues = JSON.parse(search.stdout || "[]");
  const exact = issues.find((issue) => String(issue.title).toLowerCase() === title.toLowerCase());
  const open = issues.find((issue) => issue.state === "OPEN");
  const found = exact ?? open ?? issues[0];

  if (found) {
    const next = writeWorkflow(item.file, {
      ...item.data,
      githubTicketId: found.number,
      githubTicketUrl: found.url,
    });
    printJson({ lookedUp: true, ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
    return;
  }

  const created = tryRun(
    "gh",
    ["issue", "create", "--title", title, "--body", item.data.description ?? ""],
    { cwd: item.worktree },
  );
  if (created.status !== 0) fail(created.stderr || "gh issue create failed.");

  const url = created.stdout.trim();
  const numberMatch = url.match(/\/issues\/(\d+)/);
  if (!numberMatch) fail(`Created issue but could not parse number from: ${url}`);

  const next = writeWorkflow(item.file, {
    ...item.data,
    githubTicketId: Number(numberMatch[1]),
    githubTicketUrl: url,
  });
  printJson({ created: true, ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
}

function commandPushStaging(root, id) {
  const item = resolveWorkflow(root, id);
  git(["push", "--force-with-lease", "origin", "HEAD:staging"], { cwd: item.worktree, inherit: true });
  const sha = git(["rev-parse", "HEAD"], { cwd: item.worktree });
  const next = writeWorkflow(item.file, { ...item.data, commitSha: sha });
  printJson({ pushed: true, ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
}

async function commandWaitDeploy(root, id, flags) {
  const envName = requireFlag(flags, "env");
  if (!HEALTH[envName]) fail('--env must be "staging" or "production".');
  const item = id
    ? resolveWorkflow(root, id)
    : discoverWorkflows(root)[0] ?? null;
  const sha = flags.sha && flags.sha !== true ? String(flags.sha) : item?.data.commitSha;
  if (!sha) fail("Missing --sha and no commitSha on the workflow. Push staging first.");

  const url = HEALTH[envName];
  for (let attempt = 1; attempt <= DEPLOY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
      const body = await response.json();
      console.error(`attempt ${attempt}: ${body.commit ?? "missing"} (${response.status})`);
      if (body.commit === sha) {
        if (item) writeWorkflow(item.file, { ...item.data, commitSha: sha });
        printJson({ ready: true, env: envName, sha, url, attempt });
        return;
      }
    } catch (error) {
      console.error(`attempt ${attempt}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(DEPLOY_WAIT_MS);
  }
  fail(`${envName} did not serve ${sha}.`);
}

async function commandWaitStagingE2e(root, id) {
  const item = resolveWorkflow(root, id);
  const sha = item.data.commitSha;
  if (!sha) fail("No commitSha. Push staging first.");

  for (let attempt = 1; attempt <= STAGING_E2E_ATTEMPTS; attempt += 1) {
    const listed = tryRun(
      "gh",
      [
        "run",
        "list",
        "--commit",
        sha,
        "--workflow",
        "staging-e2e.yml",
        "--json",
        "databaseId,status,conclusion,url,headSha,displayTitle",
        "--limit",
        "5",
      ],
      { cwd: item.worktree },
    );
    if (listed.status !== 0) fail(listed.stderr || "gh run list failed.");
    const runs = JSON.parse(listed.stdout || "[]");
    const run = runs.find((entry) => entry.headSha === sha) ?? runs[0];
    if (!run) {
      console.error(`attempt ${attempt}: Staging E2E has not started`);
      await sleep(STAGING_E2E_WAIT_MS);
      continue;
    }

    console.error(`attempt ${attempt}: ${run.status}${run.conclusion ? ` ${run.conclusion}` : ""} ${run.url}`);
    if (run.status === "completed") {
      if (run.conclusion === "success") {
        printJson({ passed: true, sha, url: run.url, id: item.data.id });
        return;
      }
      fail(`Staging E2E ${run.conclusion}: ${run.url}`);
    }
    await sleep(STAGING_E2E_WAIT_MS);
  }

  fail(`Staging E2E did not finish for ${sha}.`);
}

function commandTest(root, id, flags) {
  const target = requireFlag(flags, "target");
  const item = resolveWorkflow(root, id);
  const cwd = item.worktree;
  if (target === "local") {
    run("npm", ["run", "test:http"], { cwd, inherit: true });
    run("npm", ["run", "test:e2e"], { cwd, inherit: true });
  } else if (target === "staging") {
    run("npm", ["run", "test:e2e:staging"], {
      cwd,
      inherit: true,
      env: { E2E_ENV: "STAGING", E2E_BASE_URL: "https://staging.clocked-in.baddley.us/" },
    });
  } else if (target === "production") {
    run("npm", ["run", "test:e2e:prod"], {
      cwd,
      inherit: true,
      env: { E2E_ENV: "PROD", E2E_BASE_URL: "https://clocked-in.baddley.us/" },
    });
  } else {
    fail('--target must be "local", "staging", or "production".');
  }
  printJson({ passed: true, target, id: item.data.id });
}

function commandCreatePr(root, id) {
  const item = resolveWorkflow(root, id);
  const listed = tryRun(
    "gh",
    ["pr", "list", "--base", "main", "--head", "staging", "--json", "url,number,state,title"],
    { cwd: item.worktree },
  );
  if (listed.status !== 0) fail(listed.stderr || "gh pr list failed.");
  const existing = (JSON.parse(listed.stdout || "[]")).find((pr) => pr.state === "OPEN");
  if (existing) {
    const next = writeWorkflow(item.file, { ...item.data, prUrl: existing.url });
    printJson({ reused: true, ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
    return;
  }

  const body = [
    item.data.description ?? "",
    item.data.plan ? `\nPlan: ${item.data.plan}` : "",
    item.data.githubTicketUrl ? `\nFixes ${item.data.githubTicketUrl}` : "",
  ]
    .join("")
    .trim();

  const created = tryRun(
    "gh",
    [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "staging",
      "--title",
      item.data.feature,
      "--body",
      body || item.data.feature,
    ],
    { cwd: item.worktree },
  );
  if (created.status !== 0) fail(created.stderr || "gh pr create failed.");

  const next = writeWorkflow(item.file, { ...item.data, prUrl: created.stdout.trim() });
  printJson({ created: true, ...next, resolvedWorktreePath: item.worktree, resolvedJsonPath: item.file });
}

async function commandWaitPrMerged(root, id) {
  const item = resolveWorkflow(root, id);
  if (!item.data.prUrl) fail("Workflow has no prUrl. Run create-pr first.");

  for (let attempt = 1; attempt <= PR_ATTEMPTS; attempt += 1) {
    const viewed = tryRun("gh", ["pr", "view", item.data.prUrl, "--json", "state,mergedAt,url"], {
      cwd: item.worktree,
    });
    if (viewed.status !== 0) fail(viewed.stderr || "gh pr view failed.");
    const pr = JSON.parse(viewed.stdout);
    console.error(`attempt ${attempt}: ${pr.state}${pr.mergedAt ? ` mergedAt=${pr.mergedAt}` : ""}`);
    if (pr.state === "MERGED") {
      printJson({ merged: true, url: pr.url, mergedAt: pr.mergedAt });
      return;
    }
    if (pr.state === "CLOSED") fail(`PR was closed without merging: ${pr.url}`);
    await sleep(PR_WAIT_MS);
  }
  fail(`PR was not merged: ${item.data.prUrl}`);
}

function commandWorktreeRemove(root, flags, id) {
  const item = resolveWorkflow(root, id);
  if (item.data.status !== "done" && !flags.force) {
    fail(`Refusing to remove worktree while status is "${item.data.status}". Finish production verify or pass --force.`);
  }

  const remove = tryRun("git", ["worktree", "remove", "--force", item.worktree], { cwd: root });
  if (remove.status !== 0 && fs.existsSync(item.worktree)) {
    fail(remove.stderr || `Failed to remove worktree ${item.worktree}`);
  }

  const branch = item.data.worktreeBranch;
  if (branch) {
    const deleted = tryRun("git", ["branch", "-D", branch], { cwd: root });
    if (deleted.status !== 0) {
      console.error(deleted.stderr || `Could not delete local branch ${branch}`);
    }
  }

  printJson({ removed: true, id: item.data.id, worktreePath: item.worktree, branch });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  const rest = positional.slice(1);
  if (!command || command === "help" || flags.help) {
    console.log(USAGE.trim());
    process.exit(command ? 0 : 1);
  }

  const root = primaryRoot();
  const idArg = rest[0] && !STATUSES.includes(rest[0]) && !STEPS.some((step) => step.id === rest[0])
    ? rest[0]
    : flags.id && flags.id !== true
      ? String(flags.id)
      : undefined;

  switch (command) {
    case "worktree-add":
      commandWorktreeAdd(root, flags);
      return;
    case "init":
      commandInit(root, flags);
      return;
    case "show":
      commandShow(root, rest[0] ?? idArg);
      return;
    case "set-plan":
      commandSetPlan(root, rest[0] ?? idArg, flags);
      return;
    case "set-issue":
      commandSetIssue(root, rest[0] ?? idArg, flags);
      return;
    case "set-pr":
      commandSetPr(root, rest[0] ?? idArg, flags);
      return;
    case "set-sha":
      commandSetSha(root, rest[0] ?? idArg, flags);
      return;
    case "status": {
      const status = STATUSES.includes(rest[0]) ? rest[0] : rest[1];
      const id = STATUSES.includes(rest[0]) ? idArg : rest[0];
      if (!status) {
        if (rest[0]) fail(`Invalid status "${rest[0]}". Use one of: ${STATUSES.join(", ")}`);
        fail("Missing status.");
      }
      commandStatus(root, id, status);
      return;
    }
    case "check": {
      const stepId = STEPS.some((step) => step.id === rest[0]) ? rest[0] : rest[1];
      const id = STEPS.some((step) => step.id === rest[0]) ? idArg : rest[0];
      if (!stepId) fail("Missing step id.");
      commandCheck(root, id, stepId);
      return;
    }
    case "issue":
      commandIssue(root, rest[0] ?? idArg);
      return;
    case "push-staging":
      commandPushStaging(root, rest[0] ?? idArg);
      return;
    case "wait-deploy":
      await commandWaitDeploy(root, rest[0] ?? idArg, flags);
      return;
    case "wait-staging-e2e":
      await commandWaitStagingE2e(root, rest[0] ?? idArg);
      return;
    case "test":
      commandTest(root, rest[0] ?? idArg, flags);
      return;
    case "create-pr":
      commandCreatePr(root, rest[0] ?? idArg);
      return;
    case "wait-pr-merged":
      await commandWaitPrMerged(root, rest[0] ?? idArg);
      return;
    case "worktree-remove":
      commandWorktreeRemove(root, flags, rest[0] ?? idArg);
      return;
    default:
      fail(`Unknown command "${command}".\n${USAGE}`);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
