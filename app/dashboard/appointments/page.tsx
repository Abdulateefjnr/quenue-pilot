import { asc, and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/app/db";
import { departments } from "@/app/db/schema";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import AppointmentManagement from "@/app/components/dashboard/appointment-management";
import { facilityDateKey } from "@/app/lib/facility-time";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

export default async function AppointmentsPage() {
  const session = await requireOrganization();
  const canRead =
    hasPermission(session.membership.role, "appointments:read") ||
    hasPermission(session.membership.role, "appointments:read-assigned");
  if (!canRead) redirect("/dashboard");

  const availableDepartments = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(
      and(
        eq(departments.organizationId, session.membership.organizationId),
        eq(departments.isActive, true),
      ),
    )
    .orderBy(asc(departments.name));

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard/appointments"
      title="Appointments"
      description="Schedule and manage patient visits with conflict checks and a clear audit trail."
    >
      <AppointmentManagement
        initialDate={facilityDateKey(new Date())}
        canManage={hasPermission(session.membership.role, "appointments:update")}
        canUpdateAssigned={hasPermission(session.membership.role, "appointments:update-assigned")}
        canCreate={hasPermission(session.membership.role, "appointments:create")}
        departments={availableDepartments}
      />
    </DashboardShell>
  );
}
