import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  classifyTenantHost,
  displayAppOrigin,
  isValidTenantSlug,
  resolveRequestTenantSlug,
  tenantAddress,
  tenantHeader,
  tenantOrigin,
} from "../src/lib/portal";

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

  test("displayAppOrigin uses APP_HOST, then the current host, then APP_URL", () => {
    assert.equal(
      displayAppOrigin({
        configuredAppHost: "voluntime.app",
        configuredAppUrl: "https://voluntime.app",
        requestHost: "localhost:3025",
        requestProtocol: "http",
      }),
      "https://voluntime.app",
    );
    assert.equal(
      tenantAddress(
        displayAppOrigin({
          configuredAppHost: "staging.voluntime.app",
          configuredAppUrl: "https://staging.voluntime.app",
          requestHost: "caswj.staging.voluntime.app",
          requestProtocol: "https",
        }),
        "caswj",
      ),
      "https://caswj.staging.voluntime.app",
    );
    assert.equal(
      tenantAddress(
        displayAppOrigin({
          configuredAppHost: "",
          configuredAppUrl: "http://localhost:3025",
          requestHost: "localhost:3025",
        }),
        "CASWJ",
      ),
      "http://caswj.localhost:3025",
    );
    assert.equal(
      displayAppOrigin({
        configuredAppHost: null,
        configuredAppUrl: null,
        requestHost: "caswj.localhost:3025",
        requestProtocol: "http",
      }),
      "http://localhost:3025",
    );
    assert.equal(
      tenantAddress(
        displayAppOrigin({
          configuredAppHost: undefined,
          configuredAppUrl: undefined,
          requestHost: "staging.voluntime.app, internal",
          requestProtocol: "https",
        }),
        "caswj",
      ),
      "https://caswj.staging.voluntime.app",
    );
    assert.equal(
      displayAppOrigin({
        configuredAppHost: "",
        configuredAppUrl: "https://staging.voluntime.app/app",
        requestHost: null,
      }),
      "https://staging.voluntime.app",
    );
    assert.equal(
      displayAppOrigin({
        configuredAppHost: "localhost",
        configuredAppUrl: "http://localhost:3025",
        requestHost: "127.0.0.1:9999",
      }),
      "http://localhost:3025",
    );
    assert.equal(tenantAddress("https://voluntime.app", null), "https://voluntime.app");
  });

  test("resolveRequestTenantSlug resolves Host/X-Forwarded-Host and blocks header spoofing on configured hosts", () => {
    const prodHeaders = new Headers({
      host: "caswj.voluntime.app",
      [tenantHeader]: "spoofed",
    });
    assert.equal(resolveRequestTenantSlug(prodHeaders, "voluntime.app"), "caswj");

    const apexSpoofHeaders = new Headers({
      host: "voluntime.app",
      [tenantHeader]: "spoofed",
    });
    assert.equal(resolveRequestTenantSlug(apexSpoofHeaders, "voluntime.app"), null);

    const stagingForwardedHeaders = new Headers({
      host: "internal.vercel.app",
      "x-forwarded-host": "caswj.staging.voluntime.app",
    });
    assert.equal(resolveRequestTenantSlug(stagingForwardedHeaders, "staging.voluntime.app"), "caswj");

    const localSubdomainHeaders = new Headers({
      host: "caswj.localhost:3025",
    });
    assert.equal(resolveRequestTenantSlug(localSubdomainHeaders, ""), "caswj");

    const localHeaderFallback = new Headers({
      host: "127.0.0.1:3025",
      [tenantHeader]: "CASWJ",
    });
    assert.equal(resolveRequestTenantSlug(localHeaderFallback, ""), "caswj");
    assert.equal(resolveRequestTenantSlug(localHeaderFallback, "", "http://localhost:3025"), "caswj");

    const stagingWithoutAppHost = new Headers({
      host: "internal.vercel.app",
      "x-forwarded-host": "caswj.staging.voluntime.app, clocked-in.vercel.app",
    });
    assert.equal(
      resolveRequestTenantSlug(stagingWithoutAppHost, "", "https://staging.voluntime.app"),
      "caswj",
    );
    assert.equal(
      resolveRequestTenantSlug(new Headers({ host: "caswj.voluntime.app" }), "", "https://voluntime.app"),
      "caswj",
    );
    assert.equal(
      resolveRequestTenantSlug(
        new Headers({ host: "caswj.staging.voluntime.app" }),
        "",
        "https://voluntime.app",
      ),
      null,
    );
    assert.equal(
      resolveRequestTenantSlug(
        new Headers({ "x-forwarded-host": "caswj.staging.voluntime.app, internal" }),
        "staging.voluntime.app",
      ),
      "caswj",
    );
  });
});
