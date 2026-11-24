import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/app/db";
import {
  member,
  organization,
  organizationProfiles,
  session as authSession,
} from "@/app/db/schema";
import { getSession } from "@/app/lib/server-auth";
import { resolveActiveOrganization } from "@/app/lib/organization-selection.js";

export async function GET(request: Request) {
  const currentSession = await getSession(request.headers);
  if (!currentSession) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!currentSession.user.emailVerified) {
    return NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 });
  }

  const organizations = await db
    .select({
      organizationId: organization.id,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organization.id),
    )
    .where(eq(member.userId, currentSession.user.id))
    .orderBy(asc(organization.name));
  const selection = resolveActiveOrganization(
    currentSession.session.activeOrganizationId,
    organizations,
  );

  return NextResponse.json({
    organizations,
    activeOrganizationId:
      selection.status === "selected"
        ? selection.membership.organizationId
        : null,
  });
}

export async function POST(request: Request) {
  const currentSession = await getSession(request.headers);
  if (!currentSession) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!currentSession.user.emailVerified) {
    return NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = z.object({ organizationId: z.string().min(1).max(128) }).safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid facility." }, { status: 400 });
  }

  const [membership] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .innerJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, member.organizationId),
    )
    .where(
      and(
        eq(member.userId, currentSession.user.id),
        eq(member.organizationId, parsed.data.organizationId),
      ),
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "You do not have access to that facility." }, { status: 403 });
  }

  const updatedSessions = await db
    .update(authSession)
    .set({ activeOrganizationId: membership.organizationId })
    .where(
      and(
        eq(authSession.id, currentSession.session.id),
        eq(authSession.userId, currentSession.user.id),
      ),
    )
    .returning({ id: authSession.id });
  if (updatedSessions.length === 0) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
