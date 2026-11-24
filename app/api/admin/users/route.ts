import { randomUUID } from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import {
  member,
  organization,
  organizationProfiles,
  pendingOrganizations,
  user,
} from "@/app/db/schema";
import { getPlatformRole, getSession } from "@/app/lib/server-auth";
import { platformRoleUpdateSchema } from "@/app/lib/validations";

async function getAdminSession(request: Request) {
  const session = await getSession(request.headers);
  if (!session) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }
  if (!session.user.emailVerified) {
    return {
      response: NextResponse.json({ error: "Verify your email before continuing." }, { status: 403 }),
    };
  }
  if ((await getPlatformRole(session.user.id, session.user.email)) !== "admin") {
    return {
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    };
  }
  return { session };
}

export async function GET(request: Request) {
  const admin = await getAdminSession(request);
  if ("response" in admin) return admin.response;

  const [users, facilities, memberships] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
        createdAt: user.createdAt,
        organizationType: pendingOrganizations.organizationType,
      })
      .from(user)
      .leftJoin(
        pendingOrganizations,
        and(
          eq(pendingOrganizations.email, user.email),
          eq(pendingOrganizations.userId, user.id),
        ),
      )
      .orderBy(asc(user.email)),
    db
      .select({
        organizationId: organization.id,
        name: organization.name,
        organizationType: organizationProfiles.organizationType,
      })
      .from(organization)
      .innerJoin(
        organizationProfiles,
        eq(organizationProfiles.organizationId, organization.id),
      )
      .orderBy(asc(organization.name)),
    db
      .select({
        userId: member.userId,
        organizationId: organization.id,
        organizationName: organization.name,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .orderBy(asc(organization.name)),
  ]);
  const membershipsByUser = new Map<string, {
    organizationId: string;
    organizationName: string;
    role: string;
  }[]>();
  for (const membership of memberships) {
    const userMemberships = membershipsByUser.get(membership.userId) ?? [];
    userMemberships.push({
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      role: membership.role,
    });
    membershipsByUser.set(membership.userId, userMemberships);
  }

  return NextResponse.json({
    users: users.map((account) => ({
      ...account,
      memberships: membershipsByUser.get(account.id) ?? [],
    })),
    facilities,
  });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession(request);
  if ("response" in admin) return admin.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = platformRoleUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Choose a valid user role." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (
    data.scope === "platform" &&
    data.userId === admin.session.user.id &&
    data.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "You cannot remove your own administrator access." },
      { status: 409 },
    );
  }

  if (data.scope === "facility") {
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(761204821)`);

      const [target] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, data.userId))
        .limit(1);
      if (!target) return "not-found" as const;

      const [facility] = await transaction
        .select({ id: organizationProfiles.organizationId })
        .from(organizationProfiles)
        .where(eq(organizationProfiles.organizationId, data.organizationId))
        .limit(1);
      if (!facility) return "facility-not-found" as const;

      const [ownerMembership] = await transaction
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, facility.id),
            eq(member.userId, target.id),
            eq(member.role, "owner"),
          ),
        )
        .limit(1);
      if (ownerMembership) return "owner-protected" as const;

      const [existingMembership] = await transaction
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, facility.id),
            eq(member.userId, target.id),
          ),
        )
        .limit(1);

      if (existingMembership) {
        await transaction
          .update(member)
          .set({ role: data.role })
          .where(eq(member.id, existingMembership.id));
      } else {
        await transaction.insert(member).values({
          id: randomUUID(),
          organizationId: facility.id,
          userId: target.id,
          role: data.role,
          createdAt: new Date(),
        });
      }
      return "updated" as const;
    });

    if (result === "not-found") {
      return NextResponse.json({ error: "That user could not be found." }, { status: 404 });
    }
    if (result === "facility-not-found") {
      return NextResponse.json({ error: "That facility could not be found." }, { status: 404 });
    }
    if (result === "owner-protected") {
      return NextResponse.json({ error: "The facility owner cannot be changed here." }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      membership: {
        userId: parsed.data.userId,
        organizationId: data.organizationId,
        role: data.role,
      },
    });
  }

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(761204821)`);

    const [target] = await transaction
      .select({ id: user.id, email: user.email, platformRole: user.platformRole })
      .from(user)
      .where(eq(user.id, data.userId))
      .limit(1);
    if (!target) return "not-found" as const;

    const initialAdminEmail = process.env.QUEUEPILOT_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    if (
      target.platformRole === "admin" &&
      data.role === "user" &&
      initialAdminEmail &&
      target.email.toLowerCase() === initialAdminEmail
    ) {
      return "bootstrap-admin" as const;
    }

    if (target.platformRole === "admin" && data.role === "user") {
      const [adminCount] = await transaction
        .select({ value: count() })
        .from(user)
        .where(eq(user.platformRole, "admin"));
      if ((adminCount?.value ?? 0) <= 1) return "last-admin" as const;
    }

    await transaction
      .update(user)
      .set({ platformRole: data.role })
      .where(eq(user.id, target.id));
    if (data.role === "admin") {
      await transaction
        .update(pendingOrganizations)
        .set({ organizationType: data.organizationType })
        .where(
          and(
            eq(pendingOrganizations.email, target.email),
            eq(pendingOrganizations.userId, target.id),
          ),
        );
    }
    return "updated" as const;
  });

  if (result === "not-found") {
    return NextResponse.json({ error: "That user could not be found." }, { status: 404 });
  }
  if (result === "last-admin") {
    return NextResponse.json(
      { error: "QueuePilot must always have at least one administrator." },
      { status: 409 },
    );
  }
  if (result === "bootstrap-admin") {
    return NextResponse.json(
      { error: "The configured first administrator cannot be demoted." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: parsed.data.userId,
      platformRole: data.role,
      organizationType: data.role === "admin" ? data.organizationType : null,
    },
  });
}
