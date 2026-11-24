import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/app/db";
import { patients } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "patients:delete")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { patientId } = await params;
  if (!z.string().uuid().safeParse(patientId).success) {
    return NextResponse.json({ error: "Invalid patient record." }, { status: 400 });
  }

  const [patient] = await db
    .update(patients)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.organizationId, result.context.organizationId),
        isNull(patients.archivedAt),
      ),
    )
    .returning({ id: patients.id });

  if (!patient) {
    return NextResponse.json({ error: "Patient record not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
