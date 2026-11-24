import { and, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { appointments } from "@/app/db/schema";
import { db } from "@/app/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const activeAppointmentStatuses = ["scheduled", "confirmed", "checked_in"] as const;

export async function lockAppointmentResources(
  transaction: Transaction,
  organizationId: string,
  resourceKeys: string[],
) {
  for (const resourceKey of [...new Set(resourceKeys)].sort()) {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${resourceKey}))`,
    );
  }
}

export async function findAppointmentConflict(
  transaction: Transaction,
  organizationId: string,
  patientId: string,
  staffId: string | null,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
) {
  const [conflict] = await transaction
    .select({ patientId: appointments.patientId, assignedStaffId: appointments.assignedStaffId })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, organizationId),
        inArray(appointments.status, activeAppointmentStatuses),
        lt(appointments.startsAt, endsAt),
        gt(appointments.endsAt, startsAt),
        excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined,
        or(
          eq(appointments.patientId, patientId),
          staffId ? eq(appointments.assignedStaffId, staffId) : undefined,
        ),
      ),
    )
    .limit(1);
  if (!conflict) return null;
  if (conflict.patientId === patientId) return "This patient already has an overlapping appointment.";
  return "This staff member already has an overlapping appointment.";
}
