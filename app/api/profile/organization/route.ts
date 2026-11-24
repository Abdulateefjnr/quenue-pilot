import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { organization, organizationProfiles } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";
import { organizationProfileSchema } from "@/app/lib/validations";

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:update")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [profile] = await db
    .select({
      organizationName: organization.name,
      organizationType: organizationProfiles.organizationType,
      phone: organizationProfiles.contactPhone,
    })
    .from(organization)
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organization.id),
    )
    .where(eq(organization.id, result.context.organizationId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Facility profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
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

  const parsed = organizationProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the facility profile." },
      { status: 400 },
    );
  }

  const profile = await db.transaction(async (transaction) => {
    const [updatedProfile] = await transaction
      .update(organizationProfiles)
      .set({
        organizationType: parsed.data.organizationType,
        contactPhone: parsed.data.phone || null,
      })
      .where(eq(organizationProfiles.organizationId, result.context.organizationId))
      .returning({
        organizationType: organizationProfiles.organizationType,
        phone: organizationProfiles.contactPhone,
      });

    if (!updatedProfile) return null;

    await transaction
      .update(organization)
      .set({ name: parsed.data.organizationName })
      .where(eq(organization.id, result.context.organizationId));
    return updatedProfile;
  });

  if (!profile) {
    return NextResponse.json({ error: "Facility profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    profile: { ...profile, organizationName: parsed.data.organizationName },
  });
}
