import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { member, user } from "@/app/db/auth-schema";
import { db } from "@/app/db";
import { appointmentEvents, appointments, departments, patients } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { findAppointmentConflict, lockAppointmentResources } from "@/app/lib/appointment-db";
import { getAppointmentTransition } from "@/app/lib/appointment-workflow.js";
import { hasPermission } from "@/app/lib/permissions";
import {
  appointmentStatusActionSchema,
  appointmentUpdateSchema,
} from "@/app/lib/validations";

type Props = { params: Promise<{ appointmentId: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  const { appointmentId } = await params;
  if (!z.string().uuid().safeParse(appointmentId).success) {
    return NextResponse.json({ error: "Invalid appointment ID." }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("action" in payload)) {
    return NextResponse.json({ error: "Choose an appointment action." }, { status: 400 });
  }
  const action = payload.action;
  const isReschedule = action === "reschedule";
  const parsedStatusAction = isReschedule
    ? null
    : appointmentStatusActionSchema.safeParse(payload);
  const parsedReschedule = isReschedule
    ? appointmentUpdateSchema.safeParse(payload)
    : null;
  if (
    (isReschedule && !parsedReschedule?.success) ||
    (!isReschedule && !parsedStatusAction?.success)
  ) {
    const issues = parsedReschedule?.success === false
      ? parsedReschedule.error.issues
      : parsedStatusAction?.success === false
        ? parsedStatusAction.error.issues
        : [];
    return NextResponse.json(
      { error: issues[0]?.message ?? "Review the appointment details." },
      { status: 400 },
    );
  }

  const canUpdateAll = hasPermission(result.context.role, "appointments:update");
  const canUpdateAssigned = hasPermission(result.context.role, "appointments:update-assigned");
  if (isReschedule && !canUpdateAll) {
    return NextResponse.json({ error: "You cannot reschedule appointments." }, { status: 403 });
  }
  if (action === "cancel" && !hasPermission(result.context.role, "appointments:cancel")) {
    return NextResponse.json({ error: "You cannot cancel appointments." }, { status: 403 });
  }
  if (!isReschedule && !canUpdateAll && !canUpdateAssigned) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const mutation = await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        departmentId: appointments.departmentId,
        assignedStaffId: appointments.assignedStaffId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.organizationId, result.context.organizationId),
        ),
      )
      .for("update")
      .limit(1);
    if (!existing) return { error: "Appointment not found.", status: 404 };
    if (!canUpdateAll && existing.assignedStaffId !== result.context.userId) {
      return { error: "You can only manage appointments assigned to you.", status: 403 };
    }

    if (isReschedule && parsedReschedule?.success) {
      if (!["scheduled", "confirmed"].includes(existing.status)) {
        return { error: "Only scheduled or confirmed appointments can be edited.", status: 409 };
      }
      const data = parsedReschedule.data;
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      if (startsAt <= new Date()) {
        return { error: "Appointments must be scheduled in the future.", status: 400 };
      }
      await lockAppointmentResources(transaction, result.context.organizationId, [
        `patient:${existing.patientId}`,
        `patient:${data.patientId}`,
        ...(existing.assignedStaffId ? [`staff:${existing.assignedStaffId}`] : []),
        ...(data.assignedStaffId ? [`staff:${data.assignedStaffId}`] : []),
      ]);
      const [patient] = await transaction
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, data.patientId),
            eq(patients.organizationId, result.context.organizationId),
            isNull(patients.archivedAt),
          ),
        )
        .limit(1);
      if (!patient) return { error: "That patient is unavailable.", status: 404 };
      const [department] = await transaction
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.id, data.departmentId),
            eq(departments.organizationId, result.context.organizationId),
            eq(departments.isActive, true),
          ),
        )
        .limit(1);
      if (!department) return { error: "That department is unavailable.", status: 404 };
      if (data.assignedStaffId) {
        const [staff] = await transaction
          .select({ id: member.userId })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.organizationId, result.context.organizationId),
              eq(member.userId, data.assignedStaffId),
              inArray(member.role, ["doctor", "nurse"]),
            ),
          )
          .limit(1);
        if (!staff) return { error: "Select an active doctor or nurse in this facility.", status: 400 };
      }
      const conflict = await findAppointmentConflict(
        transaction,
        result.context.organizationId,
        data.patientId,
        data.assignedStaffId,
        startsAt,
        endsAt,
        appointmentId,
      );
      if (conflict) return { error: conflict, status: 409 };

      await transaction
        .update(appointments)
        .set({
          patientId: data.patientId,
          departmentId: data.departmentId,
          assignedStaffId: data.assignedStaffId,
          startsAt,
          endsAt,
          reason: data.reason || null,
        })
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.organizationId, result.context.organizationId),
          ),
        );
      await transaction.insert(appointmentEvents).values({
        organizationId: result.context.organizationId,
        appointmentId,
        actorUserId: result.context.userId,
        eventType: "rescheduled",
        details: {
          previousPatientId: existing.patientId,
          patientId: data.patientId,
          previousDepartmentId: existing.departmentId,
          departmentId: data.departmentId,
          previousAssignedStaffId: existing.assignedStaffId,
          assignedStaffId: data.assignedStaffId,
          previousStartsAt: existing.startsAt.toISOString(),
          previousEndsAt: existing.endsAt.toISOString(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      });
      return { status: 200 };
    }

    if (!parsedStatusAction?.success) {
      return { error: "Choose an appointment action.", status: 400 };
    }
    const statusAction = parsedStatusAction.data.action;
    const nextStatus = getAppointmentTransition(existing.status, statusAction);
    if (!nextStatus) return { error: "That appointment status transition is not allowed.", status: 409 };
    if (statusAction === "cancel" && !["scheduled", "confirmed"].includes(existing.status)) {
      return { error: "Only scheduled or confirmed appointments can be cancelled.", status: 409 };
    }
    if (statusAction === "no_show" && existing.startsAt > new Date()) {
      return { error: "An appointment cannot be marked no-show before its start time.", status: 409 };
    }

    await transaction
      .update(appointments)
      .set({
        status: nextStatus,
        cancelledAt: nextStatus === "cancelled" ? new Date() : undefined,
      })
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.organizationId, result.context.organizationId),
        ),
      );
    await transaction.insert(appointmentEvents).values({
      organizationId: result.context.organizationId,
      appointmentId,
      actorUserId: result.context.userId,
      eventType: statusAction,
      details: { previousStatus: existing.status, status: nextStatus },
    });
    return { status: 200, nextStatus };
  });

  if ("error" in mutation) {
    return NextResponse.json({ error: mutation.error }, { status: mutation.status });
  }
  return NextResponse.json({ status: mutation.nextStatus ?? "rescheduled" });
}
