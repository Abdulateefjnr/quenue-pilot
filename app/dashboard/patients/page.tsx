import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/app/db";
import { departments, patients } from "@/app/db/schema";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import PatientRegistration from "@/app/components/dashboard/patient-registration";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

export default async function PatientsPage() {
  const session = await requireOrganization();
  if (!hasPermission(session.membership.role, "patients:read-basic")) {
    redirect("/dashboard");
  }
  const activeDepartments = await db
    .select({ id: departments.id, name: departments.name, code: departments.code })
    .from(departments)
    .where(
      and(
        eq(departments.organizationId, session.membership.organizationId),
        eq(departments.isActive, true),
      ),
    )
    .orderBy(departments.name);
  const [recentPatients, patientCount] = await Promise.all([
    db
    .select({
      id: patients.id,
      medicalRecordNumber: patients.medicalRecordNumber,
      fullName: patients.fullName,
      phone: patients.phone,
      dateOfBirth: patients.dateOfBirth,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, session.membership.organizationId),
        isNull(patients.archivedAt),
      ),
    )
    .orderBy(desc(patients.createdAt))
    .limit(25),
    db
      .select({ value: count() })
      .from(patients)
      .where(
        and(
          eq(patients.organizationId, session.membership.organizationId),
          isNull(patients.archivedAt),
        ),
      ),
  ]);

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard/patients"
      title="Patients"
      description="Register a patient, create today's visit, and issue a department queue ticket."
      actions={
        hasPermission(session.membership.role, "organization:update") ? (
          <Link
            href="/dashboard/departments"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage departments
          </Link>
        ) : null
      }
    >
      <PatientRegistration
        departments={activeDepartments}
        initialPatients={recentPatients.map((patient) => ({
          ...patient,
          createdAt: patient.createdAt.toISOString(),
        }))}
        initialTotal={patientCount[0]?.value ?? 0}
        canDeletePatients={hasPermission(session.membership.role, "patients:delete")}
      />
    </DashboardShell>
    );
}
