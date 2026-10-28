import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalStandardSlug,
  designerLookupById,
  designerWaiting,
  isReportId,
  isReportViewerPath,
  isStandardSlug,
  newReportPath,
  reportPath,
  slugForSavedReport,
  slugify,
  standardSlugForKey,
  viewerSlug,
} from "../src/lib/report-slug.ts";

test("slugify lowercases and hyphenates a report name", () => {
  assert.equal(slugify("Grant Packet 2026"), "grant-packet-2026");
  assert.equal(slugify("  My Report!  "), "my-report");
  assert.equal(slugify("***"), "report");
});

test("reserved names get a suffix so they do not collide with standard routes", () => {
  assert.equal(slugForSavedReport("Summary"), "summary-2");
  assert.equal(slugForSavedReport("Group sessions"), "group-sessions-2");
  assert.equal(slugForSavedReport("New"), "new-2");
  assert.equal(slugForSavedReport("Grant Packet"), "grant-packet");
});

test("standard slug aliases resolve to canonical slugs", () => {
  assert.equal(canonicalStandardSlug("summary"), "summary");
  assert.equal(canonicalStandardSlug("groups"), "group-sessions");
  assert.equal(canonicalStandardSlug("standard"), "summary");
  assert.equal(canonicalStandardSlug("missing"), null);
  assert.equal(isStandardSlug("people"), true);
  assert.equal(isStandardSlug("groups"), false);
  assert.equal(standardSlugForKey("groups"), "group-sessions");
});

test("reportPath keeps a query string", () => {
  assert.equal(reportPath("summary"), "/reports/summary");
  assert.equal(reportPath("people", "from=2026-01-01"), "/reports/people?from=2026-01-01");
  assert.equal(reportPath("staff", new URLSearchParams("userId=abc")), "/reports/staff?userId=abc");
});

test("newReportPath copies filters and the template to start from", () => {
  assert.equal(newReportPath(), "/reports/new");
  assert.equal(newReportPath("from=2026-01-01"), "/reports/new?from=2026-01-01");
  assert.equal(newReportPath("from=2026-01-01", "summary"), "/reports/new?from=2026-01-01&startFrom=summary");
});

test("viewer paths exclude designer and reserved routes", () => {
  assert.equal(isReportViewerPath("/reports"), true);
  assert.equal(isReportViewerPath("/reports/summary"), true);
  assert.equal(isReportViewerPath("/reports/new"), false);
  assert.equal(isReportViewerPath("/reports/standard"), false);
  assert.equal(isReportViewerPath("/reports/grant-packet/design"), false);
  assert.equal(isReportViewerPath("/reports/templates/abc/design"), false);
  assert.equal(viewerSlug("/reports"), null);
  assert.equal(viewerSlug("/reports/summary"), "summary");
  assert.equal(isReportId("11111111-1111-4111-8111-111111111101"), true);
  assert.equal(isReportId("summary"), false);
});

test("designer lookup by id is only for UUID slugs missing from the list", () => {
  const id = "11111111-1111-4111-8111-111111111101";
  assert.equal(designerLookupById("amazing-report", false), false);
  assert.equal(designerLookupById("amazing-report", true), false);
  assert.equal(designerLookupById(id, true), false);
  assert.equal(designerLookupById(id, false), true);
  assert.equal(designerLookupById(undefined, false), false);
});

test("designer waits for the list or an enabled UUID lookup, not a disabled query", () => {
  assert.equal(
    designerWaiting({ listPending: true, foundInList: false, lookupEnabled: false, lookupPending: true }),
    true,
  );
  assert.equal(
    designerWaiting({ listPending: false, foundInList: true, lookupEnabled: false, lookupPending: true }),
    false,
  );
  assert.equal(
    designerWaiting({ listPending: false, foundInList: false, lookupEnabled: true, lookupPending: true }),
    true,
  );
  assert.equal(
    designerWaiting({ listPending: false, foundInList: false, lookupEnabled: true, lookupPending: false }),
    false,
  );
});
