// @ts-check

/**
 * @template T
 * @typedef {{ status: "selected", membership: T } | { status: "none" } | { status: "selection-required" } | { status: "invalid-active-organization" }} OrganizationSelection
 */

/**
 * @template {{ organizationId: string }} T
 * @param {string | null | undefined} activeOrganizationId
 * @param {T[]} memberships
 * @returns {OrganizationSelection<T>}
 */
function resolveActiveOrganization(activeOrganizationId, memberships) {
  if (activeOrganizationId) {
    const membership = memberships.find(
      (item) => item.organizationId === activeOrganizationId,
    );
    return membership
      ? { status: "selected", membership }
      : { status: "invalid-active-organization" };
  }

  if (memberships.length === 1) {
    return { status: "selected", membership: memberships[0] };
  }
  if (memberships.length > 1) {
    return { status: "selection-required" };
  }
  return { status: "none" };
}

module.exports = { resolveActiveOrganization };
