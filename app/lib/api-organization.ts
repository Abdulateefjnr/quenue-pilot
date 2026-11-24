import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import {
  member,
  organization,
  organizationProfiles,
} from "@/app/db/schema";
import { getSession } from "@/app/lib/server-auth";
import { resolveActiveOrganization } from "@/app/lib/organization-selection.js";

export async function getApiOrganizationContext(request: Request) {
  const session = await getSession(request.headers);
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }
  if (!session.user.emailVerified) {
    return {
      response: NextResponse.json(
        { error: "Verify your email before continuing." },
        { status: 403 },
      ),
    };
  }

  const memberships = await db
    .select({
      organizationId: organization.id,
      organizationName: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organization.id),
    )
    .where(eq(member.userId, session.user.id))
    .orderBy(organization.name);

  const selection = resolveActiveOrganization(
    session.session.activeOrganizationId,
    memberships,
  );
  if (
    selection.status === "selection-required" ||
    selection.status === "invalid-active-organization"
  ) {
    return {
      response: NextResponse.json(
        { error: "Select a facility before continuing.", code: "FACILITY_SELECTION_REQUIRED" },
        { status: 409 },
      ),
    };
  }
  if (selection.status !== "selected") {
    return {
      response: NextResponse.json(
        { error: "Set up your organization before continuing." },
        { status: 403 },
      ),
    };
  }
  const membership = selection.membership;

  return {
    context: {
      userId: session.user.id,
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      role: membership.role,
    },
  };
}
