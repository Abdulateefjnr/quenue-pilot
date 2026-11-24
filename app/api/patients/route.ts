import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import {
  departments,
  patientJourneyEvents,
  patientJourneys,
  patients,
  queueEvents,
  queueTickets,
  queues,
  visits,
} from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";
import { patientCheckInSchema } from "@/app/lib/validations";

const TIMEZONE = "Africa/Lagos";

function getQueueDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "patients:read-basic")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (query && query.length > 100) {
    return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  }
  const rawPage = new URL(request.url).searchParams.get("page") ?? "1";
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
  }
  const pageSize = 25;
  const filter = and(
    eq(patients.organizationId, result.context.organizationId),
    isNull(patients.archivedAt),
    query
      ? or(
          ilike(patients.fullName, `%${query}%`),
          ilike(patients.medicalRecordNumber, `%${query}%`),
          ilike(patients.phone, `%${query}%`),
        )
      : undefined,
  );
  const [rows, totalRows] = await Promise.all([
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
    .where(filter)
    .orderBy(desc(patients.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(patients).where(filter),
  ]);

  return NextResponse.json({
    patients: rows,
    pagination: {
      page,
      pageSize,
      total: totalRows[0]?.value ?? 0,
      totalPages: Math.ceil((totalRows[0]?.value ?? 0) / pageSize),
    },
  });
}

export async function POST(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "patients:register")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patientCheckInSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the patient details." },
      { status: 400 },
    );
  }

  const phone = parsed.data.phone || null;
  const normalizedPhone = phone?.replace(/\D/g, "") || null;
  const dateOfBirth = parsed.data.dateOfBirth || null;
  const [department] = await db
    .select({
      id: departments.id,
      name: departments.name,
      code: departments.code,
    })
    .from(departments)
    .where(
      and(
        eq(departments.id, parsed.data.departmentId),
        eq(departments.organizationId, result.context.organizationId),
        eq(departments.isActive, true),
      ),
    )
    .limit(1);

  if (!department) {
    return NextResponse.json(
      { error: "That department is unavailable." },
      { status: 404 },
    );
  }

  const now = new Date();
  const patientId = randomUUID();
  const visitId = randomUUID();
  const journeyId = randomUUID();
  const medicalRecordNumber = `QP-${now.getFullYear()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;

  const checkIn = await db.transaction(async (transaction) => {
    if (normalizedPhone && dateOfBirth) {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${result.context.organizationId}), hashtext(${`${normalizedPhone}:${dateOfBirth}`}))`,
      );
      const [existing] = await transaction
        .select({
          id: patients.id,
          medicalRecordNumber: patients.medicalRecordNumber,
          fullName: patients.fullName,
        })
        .from(patients)
        .where(
          and(
            eq(patients.organizationId, result.context.organizationId),
            eq(patients.normalizedPhone, normalizedPhone),
            eq(patients.dateOfBirth, dateOfBirth),
            isNull(patients.archivedAt),
          ),
        )
        .limit(1);

      if (existing) return { duplicate: existing };
    }

    await transaction.insert(patients).values({
      id: patientId,
      organizationId: result.context.organizationId,
      medicalRecordNumber,
      fullName: parsed.data.fullName,
      phone,
      normalizedPhone,
      dateOfBirth,
      createdBy: result.context.userId,
    });

    await transaction.insert(visits).values({
      id: visitId,
      organizationId: result.context.organizationId,
      patientId,
      createdBy: result.context.userId,
    });

    const [queue] = await transaction
      .insert(queues)
      .values({
        organizationId: result.context.organizationId,
        departmentId: department.id,
        queueDate: getQueueDate(now),
        nextTicketNumber: 2,
      })
      .onConflictDoUpdate({
        target: [
          queues.organizationId,
          queues.departmentId,
          queues.queueDate,
        ],
        set: {
          nextTicketNumber: sql`${queues.nextTicketNumber} + 1`,
        },
      })
      .returning({
        id: queues.id,
        nextTicketNumber: queues.nextTicketNumber,
      });

    const ticketNumber = queue.nextTicketNumber - 1;
    const [ticket] = await transaction
      .insert(queueTickets)
      .values({
        organizationId: result.context.organizationId,
        queueId: queue.id,
        departmentId: department.id,
        patientId,
        visitId,
        ticketNumber,
        createdBy: result.context.userId,
      })
      .returning({ id: queueTickets.id });

    await transaction.insert(patientJourneys).values({
      id: journeyId,
      organizationId: result.context.organizationId,
      visitId,
      patientId,
    });
    await transaction.insert(queueEvents).values({
      organizationId: result.context.organizationId,
      visitId,
      ticketId: ticket.id,
      actorUserId: result.context.userId,
      eventType: "checked_in",
      details: { departmentId: department.id },
    });
    await transaction.insert(patientJourneyEvents).values({
      organizationId: result.context.organizationId,
      journeyId,
      departmentId: department.id,
      actorUserId: result.context.userId,
      eventType: "checked_in",
      details: { ticketNumber, department: department.name },
    });

    return { ticketNumber };
  });

  if ("duplicate" in checkIn) {
    return NextResponse.json(
      {
        error: "A patient with this phone number and date of birth already exists.",
        patient: checkIn.duplicate,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      patient: {
        id: patientId,
        medicalRecordNumber,
        fullName: parsed.data.fullName,
        phone,
        dateOfBirth,
      },
      queue: {
        department: department.name,
        ticketNumber: checkIn.ticketNumber,
        ticketLabel: `${department.code}-${String(checkIn.ticketNumber).padStart(3, "0")}`,
      },
    },
    { status: 201 },
  );
}
