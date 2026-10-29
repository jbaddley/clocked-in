import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { accessCookie, signAccessToken } from "../src/lib/api/security";

const originalEnv = { ...process.env };
let proxy: typeof import("../src/proxy").proxy;
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/proxy_unit_test";
process.env.JWT_SIGNING_KEY = "proxy-test-signing-key-at-least-32-characters";
process.env.JWT_ISSUER = "proxy-test";
process.env.JWT_AUDIENCE = "proxy-test";
process.env.CSHARP_API_URL = "http://127.0.0.1:1";
process.env.APP_HOST = "example.test";
before(async () => {
  proxy = (await import("../src/proxy")).proxy;
});
after(() => {
  process.env = originalEnv;
});

test("bearer API requests stay on Next even with an obsolete forwarding setting", async () => {
  const response = await proxy(
    new NextRequest("http://example.test/organizations", {
      headers: { authorization: "Bearer token" },
    }),
  );
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("feedback API rewrites preserve the query and document requests stay protected", async () => {
  const api = await proxy(
    new NextRequest("http://example.test/feedback?limit=5", {
      headers: { authorization: "Bearer token", accept: "application/json" },
    }),
  );
  assert.equal(api.headers.get("x-middleware-rewrite"), "http://example.test/api/feedback?limit=5");
  const document = await proxy(new NextRequest("http://example.test/feedback", { headers: { accept: "text/html" } }));
  assert.equal(new URL(document.headers.get("location")!).pathname, "/login");
});

test("protected redirects, public health, and tenant signup handling are preserved", async () => {
  const protectedPage = await proxy(new NextRequest("http://example.test/reports?view=hours"));
  assert.equal(new URL(protectedPage.headers.get("location")!).searchParams.get("next"), "/reports?view=hours");
  const health = await proxy(new NextRequest("http://example.test/health"));
  assert.equal(health.headers.get("x-middleware-next"), "1");
  const signup = await proxy(
    new NextRequest("http://tenant.example.test/signup", { headers: { host: "tenant.example.test" } }),
  );
  assert.equal(new URL(signup.headers.get("location")!).pathname, "/login");
  const invited = await proxy(
    new NextRequest("http://tenant.example.test/signup?next=%2Finvitations%3Fcode%3D123456", {
      headers: { host: "tenant.example.test" },
    }),
  );
  assert.equal(invited.headers.get("x-middleware-next"), "1");
});

test("valid sessions can access protected pages and redirect away from login", async () => {
  const { accessToken } = await signAccessToken({
    id: "test-user",
    username: "tester",
    email: "test@example.test",
    isSuperAdmin: false,
  });
  const headers = { cookie: `${accessCookie}=${accessToken}` };
  const dashboard = await proxy(new NextRequest("http://example.test/dashboard", { headers }));
  assert.equal(dashboard.headers.get("x-middleware-next"), "1");
  const login = await proxy(new NextRequest("http://example.test/login", { headers }));
  assert.equal(new URL(login.headers.get("location")!).pathname, "/dashboard");
});
