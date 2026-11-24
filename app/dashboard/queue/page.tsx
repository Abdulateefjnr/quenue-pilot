import Link from "next/link";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/app/db";
import { departments, patients, queueTickets } from "@/app/db/schema";
import DashboardShell from "@/app/components/dashboard/dashboard-shell";
import QueueManagement from "@/app/components/dashboard/queue-management";
import { hasPermission } from "@/app/lib/permissions";
import { requireOrganization } from "@/app/lib/server-auth";

export const instant = false;

function isActiveQueueTicket<T extends { status: string }>(
  ticket: T,
): ticket is T & { status: "waiting" | "called" | "in_service" } {
  return (
    ticket.status === "waiting" ||
    ticket.status === "called" ||
    ticket.status === "in_service"
  );
}

export default async function QueuePage() {
  const session = await requireOrganization();
  if (!hasPermission(session.membership.role, "queue:read")) {
    redirect("/dashboard");
  }
  const activeTicketFilter = and(
    eq(queueTickets.organizationId, session.membership.organizationId),
    inArray(queueTickets.status, ["waiting", "called", "in_service"]),
  );
  const [activeDepartments, activeTickets, activeTicketCount] = await Promise.all([
    db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
      })
      .from(departments)
      .where(
        and(
          eq(departments.organizationId, session.membership.organizationId),
          eq(departments.isActive, true),
        ),
      )
      .orderBy(asc(departments.name)),
    db
      .select({
        id: queueTickets.id,
        ticketNumber: queueTickets.ticketNumber,
        status: queueTickets.status,
        queuedAt: queueTickets.queuedAt,
        patientName: patients.fullName,
        medicalRecordNumber: patients.medicalRecordNumber,
        departmentId: departments.id,
        departmentName: departments.name,
        departmentCode: departments.code,
      })
      .from(queueTickets)
      .innerJoin(
        patients,
        and(
          eq(queueTickets.patientId, patients.id),
          eq(queueTickets.organizationId, patients.organizationId),
        ),
      )
      .innerJoin(
        departments,
        and(
          eq(queueTickets.departmentId, departments.id),
          eq(queueTickets.organizationId, departments.organizationId),
        ),
      )
      .where(activeTicketFilter)
      .orderBy(asc(queueTickets.queuedAt))
      .limit(25),
    db
      .select({ value: count() })
      .from(queueTickets)
      .where(activeTicketFilter),
  ]);
  const initialTickets = activeTickets
    .filter(isActiveQueueTicket)
    .map((ticket) => ({
      ...ticket,
      queuedAt: ticket.queuedAt.toISOString(),
      ticketLabel: `${ticket.departmentCode}-${String(ticket.ticketNumber).padStart(3, "0")}`,
    }));

  return (
    <DashboardShell
      organizationName={session.membership.organizationName}
      userName={session.user.name}
      role={session.membership.role}
      platformRole={session.user.platformRole}
      activeHref="/dashboard/queue"
      title="Queue management"
      description="Call patients, start consultations, complete visits, or transfer patients to another department."
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
      <QueueManagement
        canUpdate={hasPermission(session.membership.role, "queue:update")}
        initialDepartments={activeDepartments}
        initialTickets={initialTickets}
        initialTotal={activeTicketCount[0]?.value ?? 0}
      />
    </DashboardShell>
  );
}
