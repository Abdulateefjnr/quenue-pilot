import assert from "node:assert/strict";
import { test } from "node:test";
import { platformRoleUpdateSchema } from "../app/lib/platform-role-update-schema.mjs";

test("accepts a platform admin role update with a facility type", () => {
  const result = platformRoleUpdateSchema.safeParse({
    scope: "platform",
    userId: "user-1",
    role: "admin",
    organizationType: "hospital",
  });

  assert.equal(result.success, true);
});

test("accepts platform user and facility role updates", () => {
  const platformUser = platformRoleUpdateSchema.safeParse({
    scope: "platform",
    userId: "user-1",
    role: "user",
  });
  const facilityRole = platformRoleUpdateSchema.safeParse({
    scope: "facility",
    userId: "user-1",
    organizationId: "facility-1",
    role: "nurse",
  });

  assert.equal(platformUser.success, true);
  assert.equal(facilityRole.success, true);
});

test("requires a facility type when granting platform admin", () => {
  const result = platformRoleUpdateSchema.safeParse({
    scope: "platform",
    userId: "user-1",
    role: "admin",
  });

  assert.equal(result.success, false);
});
