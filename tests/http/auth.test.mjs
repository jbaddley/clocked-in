import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertError,
  assertKeys,
  assertSession,
  assertUser,
  callApi,
  identity,
  logIn,
  signUp,
  suite,
  waitForCode,
} from "./client.mjs";

describe("auth / sign up", suite, () => {
  test("creates a user and returns a session", async () => {
    const person = identity("signup");
    const response = await callApi("/auth/user", {
      method: "POST",
      body: {
        username: person.username.toUpperCase(),
        email: person.email.toUpperCase(),
        password: person.password,
        firstName: "  Ada  ",
        lastName: person.lastName,
        displayName: "Addie",
        timezone: "America/Denver",
        phone: "801-555-0100",
        ignored: true,
      },
    });
    assert.equal(response.status, 201);
    assertSession(response.json, {
      username: person.username,
      email: person.email,
      firstName: "Ada",
      timezone: "America/Denver",
    });
    assert.equal(response.json.user.profile.displayName, "Addie");
    assert.equal(response.json.user.profile.phone, "801-555-0100");
    assert.equal(response.json.user.isSuperAdmin, false);
  });

  test("rejects a short password and an invalid username", async () => {
    const person = identity("signupbad");
    const password = await callApi("/auth/user", {
      method: "POST",
      body: { ...person, password: "short" },
    });
    const username = await callApi("/auth/user", {
      method: "POST",
      body: { ...person, username: "no" },
    });
    const body = await callApi("/auth/user", { method: "POST", body: "not-json" });
    assertError(password, 400, "validation_error", "password must be 8 to 200 characters.");
    assertError(
      username,
      400,
      "validation_error",
      "username must be 3 to 50 characters and use lowercase letters, numbers, dots, underscores, or hyphens.",
    );
    assertError(body, 400, "validation_error", "Request body must be JSON.");
  });

  test("rejects a duplicate username or email", async () => {
    const person = await signUp("signupdup");
    const username = await callApi("/auth/user", {
      method: "POST",
      body: { ...identity("signupother"), username: person.username },
    });
    const email = await callApi("/auth/user", {
      method: "POST",
      body: { ...identity("signupother"), email: person.email.toUpperCase() },
    });
    assertError(username, 409, "conflict", "That username is already in use.");
    assertError(email, 409, "conflict", "That email is already in use.");
  });
});

describe("auth / log in", suite, () => {
  test("returns a session for the username and password", async () => {
    const person = await signUp("login");
    const session = await logIn(person.username.toUpperCase(), person.password);
    assert.equal(session.user.id, person.user.id);
    assert.notEqual(session.refreshToken, person.refreshToken);
  });

  test("rejects an unknown user or the wrong password", async () => {
    const person = await signUp("loginbad");
    const password = await callApi("/auth/login", {
      method: "POST",
      body: { username: person.username, password: "wrong-password" },
    });
    const missing = await callApi("/auth/login", {
      method: "POST",
      body: { username: "nobody123", password: person.password },
    });
    assertError(password, 401, "unauthorized", "The username or password is incorrect.");
    assertError(missing, 401, "unauthorized", "The username or password is incorrect.");
  });
});

describe("auth / refresh", suite, () => {
  test("rotates the refresh token", async () => {
    const person = await signUp("refresh");
    const response = await callApi("/auth/refresh", {
      method: "POST",
      body: { refreshToken: person.refreshToken },
    });
    assert.equal(response.status, 200);
    assertSession(response.json, person);
    assert.notEqual(response.json.refreshToken, person.refreshToken);
    const reused = await callApi("/auth/refresh", {
      method: "POST",
      body: { refreshToken: person.refreshToken },
    });
    assertError(reused, 401, "unauthorized", "Authentication is required.");
    const again = await callApi("/auth/refresh", {
      method: "POST",
      body: { refreshToken: response.json.refreshToken },
    });
    assert.equal(again.status, 200);
  });

  test("rejects a missing refresh token", async () => {
    const response = await callApi("/auth/refresh", { method: "POST", body: {} });
    assertError(response, 400, "validation_error", "refreshToken is required.");
  });
});

describe("auth / log out", suite, () => {
  test("revokes the refresh token", async () => {
    const person = await signUp("logout");
    const response = await callApi("/auth/logout", {
      method: "POST",
      token: person.accessToken,
      body: { refreshToken: person.refreshToken },
    });
    assert.equal(response.status, 200);
    assertKeys(response.json, ["ok"]);
    assert.equal(response.json.ok, true);
    const refreshed = await callApi("/auth/refresh", {
      method: "POST",
      body: { refreshToken: person.refreshToken },
    });
    assertError(refreshed, 401, "unauthorized", "Authentication is required.");
  });

  test("requires authentication", async () => {
    const response = await callApi("/auth/logout", { method: "POST", body: { refreshToken: "token" } });
    assertError(response, 401, "unauthorized", "Authentication is required.");
  });
});

describe("auth / forgot password", suite, () => {
  test("always acknowledges an address and resets with the mailed code", async () => {
    const person = await signUp("reset");
    const missing = await callApi("/auth/user/forgot-password");
    const unknown = await callApi("/auth/user/forgot-password", { query: { email: "missing@example.com" } });
    const invalid = await callApi("/auth/user/forgot-password", { query: { email: "not-an-email" } });
    const requested = await callApi("/auth/user/forgot-password", { query: { email: person.email.toUpperCase() } });
    assertError(missing, 400, "validation_error", "email is required.");
    assert.deepEqual(unknown.json, { ok: true });
    assert.deepEqual(invalid.json, { ok: true });
    assert.deepEqual(requested.json, { ok: true });

    const code = await waitForCode(person.email);
    const bad = await callApi("/auth/user/forgot-password", {
      method: "POST",
      body: { email: person.email, code: "nope", password: "new-password-1" },
    });
    assertError(bad, 400, "validation_error", "The code is not valid.");

    const confirmed = await callApi("/auth/user/forgot-password", {
      method: "POST",
      body: { email: person.email, code, password: "new-password-1" },
    });
    assert.deepEqual(confirmed.json, { ok: true });
    const oldRefresh = await callApi("/auth/refresh", {
      method: "POST",
      body: { refreshToken: person.refreshToken },
    });
    assertError(oldRefresh, 401, "unauthorized", "Authentication is required.");
    const oldPassword = await callApi("/auth/login", {
      method: "POST",
      body: { username: person.username, password: person.password },
    });
    assertError(oldPassword, 401, "unauthorized", "The username or password is incorrect.");
    const session = await logIn(person.username, "new-password-1");
    assertUser(session.user, person);
  });
});
