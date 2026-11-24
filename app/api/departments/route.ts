import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { departments } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";
import { departmentSchema } from "@/app/lib/validations";

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      code: departments.code,
      isActive: departments.isActive,
      createdAt: departments.createdAt,
    })
    .from(departments)
    .where(eq(departments.organizationId, result.context.organizationId))
    .orderBy(asc(departments.name));
  return NextResponse.json({ departments: rows });
}

export async function POST(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:update")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = departmentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the department details." },
      { status: 400 },
    );
  }

  try {
    const [department] = await db
      .insert(departments)
      .values({
        organizationId: result.context.organizationId,
        name: parsed.data.name,
        code: parsed.data.code,
      })
      .returning({
        id: departments.id,
        name: departments.name,
        code: departments.code,
      });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "That department code is already in use." },
        { status: 409 },
      );
    }
    throw error;
  }
}
