import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyTenantHost, isValidTenantSlug, tenantOrigin } from "../src/lib/portal";

describe("classifyTenantHost", () => {
  test("production APP_HOST=voluntime.app classifies tenant subdomains and reserves staging", () => {
    assert.equal(classifyTenantHost("voluntime.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("www.voluntime.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("caswj.voluntime.app", "voluntime.app"), "caswj");
    assert.equal(classifyTenantHost("CASWJ.VOLUNTIME.APP:443", "voluntime.app"), "caswj");
    assert.equal(classifyTenantHost("staging.voluntime.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("admin.voluntime.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("caswj.staging.voluntime.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("preview-123.vercel.app", "voluntime.app"), null);
    assert.equal(classifyTenantHost("clocked-in.baddley.us", "voluntime.app"), null);
  });

  test("staging APP_HOST=staging.voluntime.app classifies caswj.staging.voluntime.app and ignores caswj.voluntime.app", () => {
    assert.equal(classifyTenantHost("staging.voluntime.app", "staging.voluntime.app"), null);
    assert.equal(classifyTenantHost("www.staging.voluntime.app", "staging.voluntime.app"), null);
    assert.equal(classifyTenantHost("caswj.staging.voluntime.app", "staging.voluntime.app"), "caswj");
    assert.equal(classifyTenantHost("caswj.voluntime.app", "staging.voluntime.app"), null);
    assert.equal(classifyTenantHost("api.staging.voluntime.app", "staging.voluntime.app"), null);
  });

  test("local APP_HOST=localhost and unset APP_HOST", () => {
    assert.equal(classifyTenantHost("localhost:3025", "localhost"), null);
    assert.equal(classifyTenantHost("127.0.0.1:3025", "localhost"), null);
    assert.equal(classifyTenantHost("caswj.localhost:3025", "localhost"), "caswj");
    assert.equal(classifyTenantHost("caswj.voluntime.app", undefined), null);
    assert.equal(classifyTenantHost("caswj.voluntime.app", ""), null);
  });

  test("slug validation and tenantOrigin", () => {
    assert.equal(isValidTenantSlug("caswj"), true);
    assert.equal(isValidTenantSlug("west-jordan-1"), true);
    assert.equal(isValidTenantSlug("a"), true);
    assert.equal(isValidTenantSlug("-caswj"), false);
    assert.equal(isValidTenantSlug("caswj-"), false);
    assert.equal(isValidTenantSlug("staging"), false);
    assert.equal(isValidTenantSlug("www"), false);
    assert.equal(isValidTenantSlug("bad_slug"), false);

    assert.equal(
      tenantOrigin("caswj", "https://voluntime.app", "voluntime.app"),
      "https://caswj.voluntime.app",
    );
    assert.equal(
      tenantOrigin("caswj", "https://staging.voluntime.app", "staging.voluntime.app"),
      "https://caswj.staging.voluntime.app",
    );
    assert.equal(
      tenantOrigin("caswj", "http://localhost:3025", ""),
      "http://caswj.localhost:3025",
    );
    assert.equal(
      tenantOrigin(null, "https://voluntime.app", "voluntime.app"),
      "https://voluntime.app",
    );
  });
});
