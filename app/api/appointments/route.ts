import { and, count, eq, gte, ilike, inArray, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { appointmentEvents, appointments, departments, patients } from "@/app/db/schema";
import { member, user } from "@/app/db/auth-schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { findAppointmentConflict, lockAppointmentResources } from "@/app/lib/appointment-db";
import { hasPermission } from "@/app/lib/permissions";
import { appointmentCreateSchema } from "@/app/lib/validations";
import { z } from "zod";

const pageSize = 25;
const appointmentStatuses = [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  const canReadAll = hasPermission(result.context.role, "appointments:read");
  const canReadAssigned = hasPermission(result.context.role, "appointments:read-assigned");
  if (!canReadAll && !canReadAssigned) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() ?? "";
  const statusValue = params.get("status") ?? "";
  const status = appointmentStatuses.find((value) => value === statusValue);
  const staffId = params.get("staff") ?? "";
  const rawPage = params.get("page") ?? "1";
  const page = Number(rawPage);
  const fromValue = params.get("from");
  const toValue = params.get("to");
  if (search.length > 100) {
    return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
  }
  if (statusValue && !status) {
    return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });
  }
  if (staffId && !z.string().min(1).max(128).safeParse(staffId).success) {
    return NextResponse.json({ error: "Invalid staff filter." }, { status: 400 });
  }
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  if (
    (fromValue && (!from || !Number.isFinite(from.getTime()))) ||
    (toValue && (!to || !Number.isFinite(to.getTime()))) ||
    (from && to && (from >= to || to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000))
  ) {
    return NextResponse.json({ error: "Invalid appointment date range." }, { status: 400 });
  }
  const filter = and(
    eq(appointments.organizationId, result.context.organizationId),
    status ? eq(appointments.status, status) : undefined,
    staffId ? eq(appointments.assignedStaffId, staffId) : undefined,
    canReadAll ? undefined : eq(appointments.assignedStaffId, result.context.userId),
    from ? gte(appointments.startsAt, from) : undefined,
    to ? lt(appointments.startsAt, to) : undefined,
    search
      ? or(ilike(patients.fullName, `%${search}%`), ilike(patients.medicalRecordNumber, `%${search}%`))
      : undefined,
  );
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.fullName,
        medicalRecordNumber: patients.medicalRecordNumber,
        departmentId: appointments.departmentId,
        departmentName: departments.name,
        assignedStaffId: appointments.assignedStaffId,
        assignedStaffName: user.name,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        reason: appointments.reason,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .innerJoin(
        patients,
        and(eq(appointments.patientId, patients.id), eq(appointments.organizationId, patients.organizationId)),
      )
      .innerJoin(
        departments,
        and(eq(appointments.departmentId, departments.id), eq(appointments.organizationId, departments.organizationId)),
      )
      .leftJoin(user, eq(appointments.assignedStaffId, user.id))
      .where(filter)
      .orderBy(appointments.startsAt, appointments.id)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(appointments)
      .innerJoin(
        patients,
        and(eq(appointments.patientId, patients.id), eq(appointments.organizationId, patients.organizationId)),
      )
      .where(filter),
  ]);
  const total = totals[0]?.value ?? 0;
  return NextResponse.json({
    appointments: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "appointments:create")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = appointmentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the appointment details." },
      { status: 400 },
    );
  }
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (startsAt <= new Date()) {
    return NextResponse.json({ error: "Appointments must be scheduled in the future." }, { status: 400 });
  }

  const resourceKeys = [
    `idempotency:${parsed.data.idempotencyKey}`,
    `patient:${parsed.data.patientId}`,
    ...(parsed.data.assignedStaffId ? [`staff:${parsed.data.assignedStaffId}`] : []),
  ].sort();
  const resultFromTransaction = await db.transaction(async (transaction) => {
    await lockAppointmentResources(transaction, result.context.organizationId, resourceKeys);

    const [existingRequest] = await transaction
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, result.context.organizationId),
          eq(appointments.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingRequest) return { appointmentId: existingRequest.id, duplicate: true };

    const [patient] = await transaction
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.id, parsed.data.patientId),
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
          eq(departments.id, parsed.data.departmentId),
          eq(departments.organizationId, result.context.organizationId),
          eq(departments.isActive, true),
        ),
      )
      .limit(1);
    if (!department) return { error: "That department is unavailable.", status: 404 };

    if (parsed.data.assignedStaffId) {
      const [staff] = await transaction
        .select({ id: member.userId })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, result.context.organizationId),
            eq(member.userId, parsed.data.assignedStaffId),
            inArray(member.role, ["doctor", "nurse"]),
          ),
        )
        .limit(1);
      if (!staff) return { error: "Select an active doctor or nurse in this facility.", status: 400 };
    }

    const conflict = await findAppointmentConflict(
      transaction,
      result.context.organizationId,
      parsed.data.patientId,
      parsed.data.assignedStaffId,
      startsAt,
      endsAt,
    );
    if (conflict) return { error: conflict, status: 409 };

    const [appointment] = await transaction
      .insert(appointments)
      .values({
        organizationId: result.context.organizationId,
        patientId: parsed.data.patientId,
        departmentId: parsed.data.departmentId,
        assignedStaffId: parsed.data.assignedStaffId,
        idempotencyKey: parsed.data.idempotencyKey,
        startsAt,
        endsAt,
        reason: parsed.data.reason || null,
        createdBy: result.context.userId,
      })
      .returning({ id: appointments.id });
    await transaction.insert(appointmentEvents).values({
      organizationId: result.context.organizationId,
      appointmentId: appointment.id,
      actorUserId: result.context.userId,
      eventType: "scheduled",
      details: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
    });
    return { appointmentId: appointment.id, duplicate: false };
  });

  if ("error" in resultFromTransaction) {
    return NextResponse.json(
      { error: resultFromTransaction.error },
      { status: resultFromTransaction.status },
    );
  }
  return NextResponse.json(
    { appointmentId: resultFromTransaction.appointmentId, duplicate: resultFromTransaction.duplicate },
    { status: resultFromTransaction.duplicate ? 200 : 201 },
  );
}
