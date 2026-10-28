import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { peopleRowMatch } from "../src/lib/import/people-review.ts";
import { usernameFromName } from "../src/lib/import/username.ts";
import {
  adminPermissions,
  defaultPermissionsForCode,
  defaultScopeForCode,
  groupManagerPermissions,
  isPermission,
  staffPermissions,
  volunteerPermissions,
} from "../src/lib/permissions.ts";

describe("permissions catalog", () => {
  test("keeps current Admin, Staff, and Volunteer defaults", () => {
    assert.ok(defaultPermissionsForCode("ADMIN").includes("manage_roles"));
    assert.ok(defaultPermissionsForCode("ADMIN").includes("approve_access_requests"));
    assert.deepEqual(defaultPermissionsForCode("MEMBER"), staffPermissions);
    assert.deepEqual(defaultPermissionsForCode("VOLUNTEER"), volunteerPermissions);
    assert.equal(defaultScopeForCode("VOLUNTEER"), "self");
    assert.ok(groupManagerPermissions.includes("create_needs"));
    assert.ok(groupManagerPermissions.includes("log_event_totals"));
    assert.ok(adminPermissions.includes("export_reports"));
  });

  test("rejects unknown permission keys", () => {
    assert.equal(isPermission("log_own_time"), true);
    assert.equal(isPermission("delete_the_world"), false);
  });
});

describe("usernameFromName", () => {
  test("reserves first initial plus last name", () => {
    assert.equal(usernameFromName("Jason", "Baddley"), "jbaddley");
    assert.equal(usernameFromName("Ada", "Lovelace"), "alovelace");
  });
});

describe("people import review", () => {
  const members = [
    { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" },
    { email: "al@example.org", firstName: "Ada", lastName: "Lovelace" },
  ];

  test("flags exact email and same-name near matches", () => {
    assert.equal(peopleRowMatch({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }, members), "Existing email");
    assert.equal(peopleRowMatch({ firstName: "Ada", lastName: "Lovelace", email: "new@example.com" }, members), "Near match");
    assert.equal(peopleRowMatch({ firstName: "Grace", lastName: "Hopper", email: "grace@example.com" }, members), "New");
  });
});
