import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/app/db";
import { departments } from "@/app/db/schema";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import DepartmentManagement from "@/app/components/dashboard/department-management";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

export default async function DepartmentsPage() {
  const session = await requireOrganization();
  if (!hasPermission(session.membership.role, "organization:update")) {
    redirect("/dashboard");
  }
  const departmentRows = await db
    .select({
      id: departments.id,
      name: departments.name,
      code: departments.code,
      isActive: departments.isActive,
    })
    .from(departments)
    .where(eq(departments.organizationId, session.membership.organizationId))
    .orderBy(asc(departments.name));

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard/departments"
      title="Departments"
      description="Add and manage the departments that receive patient queue tickets."
    >
      <DepartmentManagement initialDepartments={departmentRows} />
    </DashboardShell>
  );
}
