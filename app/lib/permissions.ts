export const organizationRoles = [
  "owner",
  "admin",
  "doctor",
  "nurse",
  "receptionist",
  "patient",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

const permissions: Record<OrganizationRole, readonly string[]> = {
  owner: ["organization:*", "members:*", "queue:*", "patients:*", "appointments:*"],
  admin: ["organization:read", "organization:update", "members:*", "queue:*", "patients:*", "appointments:*"],
  doctor: ["organization:read", "queue:read", "patients:read-assigned", "appointments:read-assigned", "appointments:update-assigned"],
  nurse: ["organization:read", "queue:read", "queue:update", "patients:read-assigned", "appointments:read-assigned", "appointments:update-assigned"],
  receptionist: ["organization:read", "queue:*", "patients:register", "patients:read-basic", "appointments:*"],
  patient: ["organization:read", "patients:read-own", "queue:read-own"],
};

export function hasPermission(role: string, permission: string) {
  if (!organizationRoles.includes(role as OrganizationRole)) return false;

  const rolePermissions = permissions[role as OrganizationRole];
  const [resource] = permission.split(":");

  return (
    rolePermissions.includes(`${resource}:*`) ||
    rolePermissions.includes(permission)
  );
}
