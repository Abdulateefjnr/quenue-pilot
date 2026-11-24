import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, DrizzleQueryError, eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { db } from "@/app/db";
import { member, organization, organizationProfiles, user } from "@/app/db/schema";
import type { OrganizationRole } from "@/app/lib/permissions";
import { resolveActiveOrganization } from "@/app/lib/organization-selection.js";

export type PlatformRole = "user" | "admin";

function findDrizzleQueryError(error: unknown): DrizzleQueryError | undefined {
  const seen = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof DrizzleQueryError) return current;
    current = "cause" in current ? current.cause : undefined;
  }
}

function getErrorCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if (
      "code" in current &&
      typeof current.code === "string" &&
      /^[A-Z0-9_]+$/.test(current.code)
    ) {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
}

function getTransientConnectionCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string") {
      if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(current.code)) {
        return current.code;
      }
    }
    if ("message" in current && typeof current.message === "string") {
      if (/connection terminated due to connection timeout/i.test(current.message)) {
        return "CONNECTION_TIMEOUT";
      }
      if (/connection terminated unexpectedly/i.test(current.message)) {
        return "CONNECTION_TERMINATED";
      }
    }
    current = "cause" in current ? current.cause : undefined;
  }
}

function isUnauthorizedSessionError(error: unknown) {
  return error instanceof APIError && error.statusCode === 401;
}

function logSessionQueryFailure(error: unknown) {
  const queryError = findDrizzleQueryError(error);
  const diagnosticError = queryError?.cause ?? error;
  console.error("Better Auth session query failed.", {
    causeCode:
      getErrorCode(diagnosticError) ??
      getTransientConnectionCode(diagnosticError) ??
      "UNKNOWN",
  });
}

export async function getPlatformRole(userId: string, email: string): Promise<PlatformRole> {
  const initialAdminEmail = process.env.QUEUEPILOT_INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (initialAdminEmail && email.toLowerCase() === initialAdminEmail) {
    await db
      .update(user)
      .set({ platformRole: "admin" })
      .where(and(eq(user.id, userId), eq(user.platformRole, "user")));
    return "admin";
  }

  const [account] = await db
    .select({ platformRole: user.platformRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return account?.platformRole === "admin" ? "admin" : "user";
}

export async function getSession(requestHeaders?: Headers) {
  const sessionHeaders = requestHeaders ?? (await headers());
  try {
    return await auth.api.getSession({
      headers: sessionHeaders,
    });
  } catch (error) {
    if (isUnauthorizedSessionError(error)) return null;

    const queryError = findDrizzleQueryError(error);
    const causeCode = getTransientConnectionCode(queryError?.cause ?? error);
    if (causeCode) {
      console.warn("Transient database connection failure during session lookup; retrying once.", {
        causeCode,
      });
      try {
        return await auth.api.getSession({ headers: sessionHeaders });
      } catch (retryError) {
        if (isUnauthorizedSessionError(retryError)) return null;
        logSessionQueryFailure(retryError);
        throw new Error("Unable to retrieve the current session.");
      }
    }
    logSessionQueryFailure(error);
    throw new Error("Unable to retrieve the current session.");
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformRole = await getPlatformRole(session.user.id, session.user.email);
  return { ...session, user: { ...session.user, platformRole } };
}

export async function requireVerifiedUser() {
  const session = await requireAuth();
  if (!session.user.emailVerified) redirect("/verify-email");
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireVerifiedUser();
  if (session.user.platformRole !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}

export async function requireOrganization() {
  const session = await requireVerifiedUser();
  const memberships = await db
    .select({
      id: member.id,
      role: member.role,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationType: organizationProfiles.organizationType,
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
    memberships.map((membership) => ({
      ...membership,
      organizationId: membership.organizationId,
    })),
  );
  if (selection.status === "selection-required" ||
      selection.status === "invalid-active-organization") {
    redirect("/facilities/select");
  }
  if (selection.status === "none") {
    redirect(session.user.platformRole === "admin" ? "/onboarding" : "/pending-approval");
  }
  const membership = selection.membership;
  return {
    ...session,
    membership,
  };
}

export async function requireOrganizationRole(roles: OrganizationRole[]) {
  const session = await requireOrganization();
  if (!roles.includes(session.membership.role as OrganizationRole)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}
