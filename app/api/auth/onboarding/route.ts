import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import {
  departments,
  member,
  notifications,
  organization,
  organizationProfiles,
  pendingOrganizations,
  user,
} from "@/app/db/schema";
import { getPlatformRole, getSession } from "@/app/lib/server-auth";
import {
  onboardingSchema,
  slugifyOrganizationName,
} from "@/app/lib/validations";

export async function GET(request: Request) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 });
  }
  if ((await getPlatformRole(session.user.id, session.user.email)) !== "admin") {
    return NextResponse.json({ error: "Only an administrator can create an organization." }, { status: 403 });
  }

  const [pending] = await db
    .select({
      organizationName: pendingOrganizations.name,
      organizationType: pendingOrganizations.organizationType,
      phone: pendingOrganizations.contactPhone,
    })
    .from(pendingOrganizations)
    .where(
      and(
        eq(pendingOrganizations.email, session.user.email),
        eq(pendingOrganizations.userId, session.user.id),
      ),
    )
    .limit(1);

  return NextResponse.json({ pending: pending ?? null });
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 });
  }
  if ((await getPlatformRole(session.user.id, session.user.email)) !== "admin") {
    return NextResponse.json({ error: "Only an administrator can create an organization." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the organization details." },
      { status: 400 },
    );
  }

  const [pending] = await db
    .select()
    .from(pendingOrganizations)
    .where(
      and(
        eq(pendingOrganizations.email, session.user.email),
        eq(pendingOrganizations.userId, session.user.id),
      ),
    )
    .limit(1);

  const organizationData = pending
    ? {
        name: pending.name,
        organizationType: pending.organizationType ?? parsed.data.organizationType,
        contactPhone: pending.contactPhone,
      }
    : {
        name: parsed.data.organizationName,
        organizationType: parsed.data.organizationType,
        contactPhone: parsed.data.phone || null,
      };

  const organizationId = randomUUID();
  const slug = `${slugifyOrganizationName(organizationData.name)}-${organizationId.slice(0, 8)}`;

  const created = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT ${user.id} FROM ${user} WHERE ${user.id} = ${session.user.id} FOR UPDATE`,
    );

    const [existingMembership] = await transaction
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, session.user.id))
      .limit(1);

    if (existingMembership) {
      return false;
    }

    await transaction.insert(organization).values({
      id: organizationId,
      name: organizationData.name,
      slug,
      createdAt: new Date(),
    });
    await transaction.insert(organizationProfiles).values({
      organizationId,
      organizationType: organizationData.organizationType,
      contactPhone: organizationData.contactPhone,
    });
    await transaction.insert(departments).values({
      organizationId,
      name: "General",
      code: "GEN",
    });
    await transaction.insert(member).values({
      id: randomUUID(),
      organizationId,
      userId: session.user.id,
      role: "owner",
      createdAt: new Date(),
    });
    await transaction.insert(notifications).values({
      userId: session.user.id,
      title: "Your workspace is ready",
      body: `${organizationData.name} is set up in QueuePilot.`,
    });
    await transaction
      .delete(pendingOrganizations)
      .where(eq(pendingOrganizations.email, session.user.email));
    return true;
  });

  return NextResponse.json({ success: true }, { status: created ? 201 : 200 });
}
