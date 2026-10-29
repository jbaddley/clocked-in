import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/staging-e2e.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const healthCheck = workflow.match(/node --input-type=module <<'EOF'\r?\n([\s\S]*?)\r?\n\s+EOF/)?.[1];
assert.ok(healthCheck);

function runHealthCheck(responses: { status: number; body: string; contentType: string }[], secret = "test-bypass") {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", `
    const responses = ${JSON.stringify(responses)};
    globalThis.fetch = async (url, options) => {
      if (String(url) !== "https://staging-deployment.vercel.app/health") throw new Error("Wrong deployment URL");
      if (options.headers["x-vercel-protection-bypass"] !== "test-bypass") throw new Error("Missing bypass header");
      const response = responses.length > 1 ? responses.shift() : responses[0];
      return new Response(response.body, {
        status: response.status,
        headers: { "content-type": response.contentType },
      });
    };
    globalThis.setTimeout = (callback) => callback();
    ${healthCheck}
  `], {
    encoding: "utf8",
    env: {
      ...process.env,
      EXPECTED_SHA: "deployed-commit",
      E2E_BASE_URL: "https://staging-deployment.vercel.app/",
      VERCEL_AUTOMATION_BYPASS_SECRET: secret,
    },
  });
}

test("staging workflow uses the successful staging deployment for checkout and both test steps", () => {
  assert.match(workflow, /on:\s+deployment_status:/);
  assert.match(workflow, /github\.event\.deployment_status\.state == 'success'/);
  assert.match(workflow, /github\.event\.deployment\.environment != 'Production'/);
  assert.match(workflow, /ref: staging/);
  assert.doesNotMatch(workflow, /github\.event\.deployment\.ref/);
  assert.equal(workflow.match(/if: steps\.deployment\.outputs\.staging == 'true'/g)?.length, 5);
  assert.match(workflow, /EXPECTED_SHA: \$\{\{ github\.event\.deployment\.sha \}\}/);
  assert.match(workflow, /E2E_BASE_URL: \$\{\{ github\.event\.deployment_status\.environment_url \}\}/);
  assert.doesNotMatch(workflow, /staging\.clocked-in\.baddley\.us/);
});

for (const matchesStaging of [true, false]) {
  test(`deployment selection ${matchesStaging ? "accepts the staging SHA" : "skips other or superseded commits"}`, () => {
    const branchCheck = workflow.match(/run: \|\r?\n([\s\S]*?)\r?\n\s+- uses: actions\/setup-node/)?.[1];
    assert.ok(branchCheck);
    const directory = mkdtempSync(path.join(tmpdir(), "staging-workflow-"));
    const output = path.join(directory, "output");
    try {
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", `
        git() { echo "staging-commit"; }
        ${branchCheck}
      `], {
        encoding: "utf8",
        env: {
          ...process.env,
          DEPLOYMENT_SHA: matchesStaging ? "staging-commit" : "other-commit",
          GITHUB_OUTPUT: output,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(output, "utf8"), matchesStaging ? "staging=true\n" : "");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("health check reaches the deployment URL with protection bypass and waits for the matching commit", () => {
  const result = runHealthCheck([
    { status: 200, body: '{"commit":"old-commit"}', contentType: "application/json" },
    { status: 200, body: '{"commit":"deployed-commit"}', contentType: "application/json; charset=utf-8" },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /attempt 2: deployed-commit \(200\)/);
});

test("health check reports a missing deployment without a JSON parser error", () => {
  const result = runHealthCheck([
    { status: 404, body: "The deployment could not be found", contentType: "text/plain" },
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Health check returned HTTP 404/);
  assert.doesNotMatch(result.stdout, /Unexpected token/);
  assert.match(result.stderr, /Staging did not serve deployed-commit/);
});

test("health check rejects a non-JSON success response", () => {
  const result = runHealthCheck([
    { status: 200, body: "<html>Authentication required</html>", contentType: "text/html" },
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /non-JSON content \(HTTP 200\)/);
});

test("health check rejects unsuccessful responses even with the expected commit", () => {
  const result = runHealthCheck([
    { status: 503, body: '{"commit":"deployed-commit"}', contentType: "application/json" },
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Health check returned HTTP 503/);
});

test("health check fails when only an older commit is available", () => {
  const result = runHealthCheck([
    { status: 200, body: '{"commit":"old-commit"}', contentType: "application/json" },
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /attempt 40: old-commit/);
});

test("health check fails immediately when the protection bypass secret is missing", () => {
  const result = runHealthCheck([], "");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VERCEL_AUTOMATION_BYPASS_SECRET is required/);
  assert.equal(result.stdout, "");
});
