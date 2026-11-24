import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { member, user } from "@/app/db/auth-schema";
import { appointments } from "@/app/db/schema";
import { db } from "@/app/db";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "appointments:create")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const startValue = params.get("start");
  const endValue = params.get("end");
  const excludeValue = params.get("exclude") ?? "";
  const startsAt = startValue ? new Date(startValue) : null;
  const endsAt = endValue ? new Date(endValue) : null;
  if (
    !startsAt ||
    !endsAt ||
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt ||
    endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: "Provide a valid appointment time window of up to 8 hours." }, { status: 400 });
  }
  if (excludeValue && !z.string().uuid().safeParse(excludeValue).success) {
    return NextResponse.json({ error: "Invalid appointment ID." }, { status: 400 });
  }

  const staffRows = await db
    .select({ id: user.id, name: user.name, role: member.role })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, result.context.organizationId),
        inArray(member.role, ["doctor", "nurse"]),
      ),
    );
  const staffIds = staffRows.map(({ id }) => id);
  if (!staffIds.length) return NextResponse.json({ staff: [] });

  const conflicts = await db
    .select({ staffId: appointments.assignedStaffId })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, result.context.organizationId),
        inArray(appointments.assignedStaffId, staffIds),
        inArray(appointments.status, ["scheduled", "confirmed", "checked_in"]),
        lt(appointments.startsAt, endsAt),
        gt(appointments.endsAt, startsAt),
        excludeValue ? ne(appointments.id, excludeValue) : undefined,
      ),
    );
  const unavailable = new Set(conflicts.map(({ staffId }) => staffId));
  return NextResponse.json({
    staff: staffRows.filter(({ id }) => !unavailable.has(id)),
  });
}
