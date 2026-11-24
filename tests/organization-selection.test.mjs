import assert from "node:assert/strict";
import { test } from "node:test";
import organizationSelection from "../app/lib/organization-selection.js";

const { resolveActiveOrganization } = organizationSelection;
const memberships = [
  { organizationId: "facility-a" },
  { organizationId: "facility-b" },
];

test("a single membership remains the default when no facility is active", () => {
  assert.deepEqual(
    resolveActiveOrganization(null, [memberships[0]]),
    { status: "selected", membership: memberships[0] },
  );
});

test("multiple memberships require an explicit facility selection", () => {
  assert.deepEqual(
    resolveActiveOrganization(null, memberships),
    { status: "selection-required" },
  );
});

test("an active facility is accepted only when the user is a member", () => {
  assert.deepEqual(
    resolveActiveOrganization("facility-b", memberships),
    { status: "selected", membership: memberships[1] },
  );
  assert.deepEqual(
    resolveActiveOrganization("facility-c", memberships),
    { status: "invalid-active-organization" },
  );
});
