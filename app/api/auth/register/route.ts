import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import {
  authRateLimits,
  pendingOrganizations,
  securityEvents,
  user,
} from "@/app/db/schema";
import { auth } from "@/app/lib/auth";
import { isEmailConfigured, EmailDeliveryError } from "@/app/lib/email";
import { registrationSchema } from "@/app/lib/validations";

async function consumeSignupRateLimit(email: string) {
  const identifier = createHash("sha256")
    .update(`signup:${email}`)
    .digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60_000);

  const [limit] = await db
    .insert(authRateLimits)
    .values({ identifier, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: authRateLimits.identifier,
      set: {
        count: sql`CASE WHEN ${authRateLimits.windowStartedAt} <= ${windowStart} THEN 1 ELSE ${authRateLimits.count} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${authRateLimits.windowStartedAt} <= ${windowStart} THEN ${now} ELSE ${authRateLimits.windowStartedAt} END`,
      },
    })
    .returning({ count: authRateLimits.count });

  return (limit?.count ?? 0) <= 5;
}

async function reconcilePendingOrganization(email: string): Promise<boolean> {
  const [registeredUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (registeredUser) {
    await db
      .update(pendingOrganizations)
      .set({ userId: registeredUser.id })
      .where(
        and(
          eq(pendingOrganizations.email, email),
          sql`${pendingOrganizations.userId} IS NULL`,
        ),
      );
    return true;
  }

  await db
    .delete(pendingOrganizations)
    .where(
      and(
        eq(pendingOrganizations.email, email),
        sql`${pendingOrganizations.userId} IS NULL`,
      ),
    );
  return false;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the signup details." },
      { status: 400 },
    );
  }

  const values = parsed.data;
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM." },
      { status: 503 },
    );
  }

  if (!(await consumeSignupRateLimit(values.email))) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const [pending] = await db
    .insert(pendingOrganizations)
    .values({
      email: values.email,
      name: values.organizationName,
      organizationType: null,
      contactPhone: values.phone || null,
      termsAcceptedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ email: pendingOrganizations.email });

  if (!pending) {
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, values.email))
      .limit(1);
    if (existingUser) {
      await db
        .update(pendingOrganizations)
        .set({ userId: existingUser.id })
        .where(
          and(
            eq(pendingOrganizations.email, values.email),
            sql`${pendingOrganizations.userId} IS NULL`,
          ),
        );
    }

    return NextResponse.json(
      {
        error: existingUser
          ? "An account already exists with this email. Sign in or verify your email instead."
          : "A signup is already in progress for this email. Try signing in or wait before retrying.",
      },
      { status: 409 },
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-queuepilot-registration-token",
    process.env.BETTER_AUTH_SECRET!,
  );

  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?verified=true`,
      },
      headers: requestHeaders,
    });
    const createdUser = result.user;

    await db
      .update(pendingOrganizations)
      .set({ userId: createdUser.id })
      .where(
        and(
          eq(pendingOrganizations.email, values.email),
          sql`${pendingOrganizations.userId} IS NULL`,
        ),
      );
    await db.insert(securityEvents).values({
      userId: createdUser.id,
      eventType: "sign_up",
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      const accountCreated = await reconcilePendingOrganization(values.email);
      return NextResponse.json(
        {
          error: accountCreated
            ? "Your account was created, but the verification email could not be delivered. Try resending it."
            : "The verification email could not be sent. Please try again.",
        },
        { status: 502 },
      );
    }

    if (error instanceof APIError) {
      await reconcilePendingOrganization(values.email);
      return NextResponse.json(
        { error: "Unable to create the account. Check the details or try signing in." },
        { status: error.statusCode },
      );
    }

    await reconcilePendingOrganization(values.email);
    throw error;
  }

  return NextResponse.json(
    { message: "Check your email for a verification link." },
    { status: 201 },
  );
}
