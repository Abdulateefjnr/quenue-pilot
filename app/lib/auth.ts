import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import type { BetterAuthOptions } from "better-auth";
import { db } from "@/app/db";
import * as schema from "@/app/db/schema";
import { securityEvents } from "@/app/db/schema";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/app/lib/email";
import { resolveAuthUrls } from "@/app/lib/auth-urls.mjs";

const statement = {
  organization: ["read", "update", "delete"],
  members: ["read", "create", "update", "delete"],
  queue: ["read", "update"],
  patients: ["read-own", "read-assigned", "read-basic", "register"],
} as const;

const accessControl = createAccessControl(statement);
const ownerRole = accessControl.newRole({
  organization: ["read", "update", "delete"],
  members: ["read", "create", "update", "delete"],
  queue: ["read", "update"],
  patients: ["read-own", "read-assigned", "read-basic", "register"],
});
const adminRole = accessControl.newRole({
  organization: ["read", "update"],
  members: ["read", "create", "update", "delete"],
  queue: ["read", "update"],
  patients: ["read-own", "read-assigned", "read-basic", "register"],
});
const doctorRole = accessControl.newRole({
  organization: ["read"],
  queue: ["read"],
  patients: ["read-own", "read-assigned"],
});
const nurseRole = accessControl.newRole({
  organization: ["read"],
  queue: ["read", "update"],
  patients: ["read-own", "read-assigned"],
});
const receptionistRole = accessControl.newRole({
  organization: ["read"],
  queue: ["read", "update"],
  patients: ["read-basic", "register"],
});
const patientRole = accessControl.newRole({
  organization: ["read"],
  patients: ["read-own"],
});

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  socialProviders.microsoft = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}

const authSecret = process.env.BETTER_AUTH_SECRET;
export const { appUrl, authUrl } = resolveAuthUrls();

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

function sanitizeAuthLogArgument(argument: unknown): unknown {
  if (argument instanceof Error) {
    const code = getErrorCode(argument);
    const statusCode =
      "statusCode" in argument && typeof argument.statusCode === "number"
        ? argument.statusCode
        : undefined;
    return {
      errorName: argument.name,
      ...(code ? { causeCode: code } : {}),
      ...(statusCode ? { statusCode } : {}),
    };
  }
  if (
    argument === null ||
    typeof argument === "number" ||
    typeof argument === "boolean"
  ) {
    return argument;
  }
  return "[redacted]";
}

if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
}
export const auth = betterAuth({
  appName: "QueuePilot",
  baseURL: authUrl,
  secret: authSecret,
  logger: {
    log: (level, message, ...args) => {
      console[level](`[Better Auth] ${message}`, ...args.map(sanitizeAuthLogArgument));
    },
  },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [...new Set([appUrl, authUrl])],
  socialProviders,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
      creatorRole: "owner",
      organizationLimit: 1,
      ac: accessControl,
      roles: {
        owner: ownerRole,
        admin: adminRole,
        doctor: doctorRole,
        nurse: nurseRole,
        receptionist: receptionistRole,
        patient: patientRole,
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-up/email") {
        const registrationToken = context.headers?.get(
          "x-queuepilot-registration-token",
        );
        if (registrationToken !== authSecret) {
          throw new APIError("FORBIDDEN", {
            message: "Registration must use the validated QueuePilot signup endpoint.",
          });
        }
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-in/email") {
        const userId = context.context.newSession?.user.id;
        if (userId) {
          await db.insert(securityEvents).values({
            userId,
            eventType: "sign_in",
          });
        }
      }
    }),
  },
});
