import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { departments, patients, queueTickets } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";
import { z } from "zod";

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "queue:read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const query = search.get("q")?.trim() ?? "";
  const departmentId = search.get("department") ?? "";
  const requestedStatus = search.get("status") ?? "";
  const activeStatuses = ["waiting", "called", "in_service"] as const;
  const status = activeStatuses.find((value) => value === requestedStatus);
  const page = Number(search.get("page") ?? "1");
  if (departmentId && !z.string().uuid().safeParse(departmentId).success) {
    return NextResponse.json({ error: "Invalid department filter." }, { status: 400 });
  }
  if (query.length > 100) {
    return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
  }
  if (requestedStatus && !status) {
    return NextResponse.json({ error: "Invalid queue status filter." }, { status: 400 });
  }
  const filters = and(
    eq(queueTickets.organizationId, result.context.organizationId),
    inArray(queueTickets.status, activeStatuses),
    departmentId ? eq(queueTickets.departmentId, departmentId) : undefined,
    status ? eq(queueTickets.status, status) : undefined,
    query
      ? or(
          ilike(patients.fullName, `%${query}%`),
          ilike(patients.medicalRecordNumber, `%${query}%`),
        )
      : undefined,
  );
  const pageSize = 25;

  const [departmentRows, tickets, totalRows] = await Promise.all([
    db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
      })
      .from(departments)
      .where(
        and(
          eq(departments.organizationId, result.context.organizationId),
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
      .where(filters)
      .orderBy(asc(queueTickets.queuedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(queueTickets)
      .innerJoin(
        patients,
        and(
          eq(queueTickets.patientId, patients.id),
          eq(queueTickets.organizationId, patients.organizationId),
        ),
      )
      .where(filters),
  ]);

  return NextResponse.json({
    departments: departmentRows,
    pagination: {
      page,
      pageSize,
      total: totalRows[0]?.value ?? 0,
      totalPages: Math.ceil((totalRows[0]?.value ?? 0) / pageSize),
    },
    tickets: tickets.map((ticket) => ({
      ...ticket,
      ticketLabel: `${ticket.departmentCode}-${String(ticket.ticketNumber).padStart(3, "0")}`,
    })),
  });
}
