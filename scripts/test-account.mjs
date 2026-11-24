import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Client } from "pg";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const [action] = process.argv.slice(2);
const baseUrl = "http://127.0.0.1:3001";
const facilityName = process.env.QUEUEPILOT_TEST_FACILITY?.trim();
const email = process.env.QUEUEPILOT_TEST_EMAIL?.trim();
const password = process.env.QUEUEPILOT_TEST_PASSWORD;
const ownerName = process.env.QUEUEPILOT_TEST_OWNER_NAME?.trim();
const directDatabaseUrl = process.env.QUEUEPILOT_TEST_DATABASE_URL_UNPOOLED;

function isProductionBranch(branch) {
  return /(^|[-_])(prod|production|main)([-_]|$)/i.test(branch ?? "");
}

function normalizedDatabaseHost(connectionString) {
  return new URL(connectionString).hostname.replace("-pooler", "");
}

function databaseFingerprint(connectionString) {
  return createHash("sha256")
    .update(normalizedDatabaseHost(connectionString))
    .digest("hex");
}

function requireTestEnvironment() {
  if (process.env.QUEUEPILOT_TEST_MODE !== "true") {
    throw new Error("Set QUEUEPILOT_TEST_MODE=true before using test-account setup.");
  }
  if (
    !process.env.QUEUEPILOT_TEST_BRANCH ||
    isProductionBranch(process.env.QUEUEPILOT_TEST_BRANCH)
  ) {
    throw new Error("QUEUEPILOT_TEST_BRANCH must identify a non-production branch.");
  }
  if (!process.env.QUEUEPILOT_TEST_DATABASE_URL || !directDatabaseUrl) {
    throw new Error(
      "Set the isolated test branch's pooled and unpooled database URLs.",
    );
  }
  if (
    process.env.DATABASE_URL &&
    normalizedDatabaseHost(process.env.DATABASE_URL) ===
      normalizedDatabaseHost(process.env.QUEUEPILOT_TEST_DATABASE_URL)
  ) {
    throw new Error(
      "The test database endpoint matches DATABASE_URL; refusing to use the linked database.",
    );
  }
  if (
    !email ||
    !password ||
    !ownerName ||
    !facilityName ||
    !directDatabaseUrl
  ) {
    throw new Error(
      "Set QUEUEPILOT_TEST_EMAIL, QUEUEPILOT_TEST_PASSWORD, QUEUEPILOT_TEST_OWNER_NAME, QUEUEPILOT_TEST_FACILITY, and QUEUEPILOT_TEST_DATABASE_URL_UNPOOLED.",
    );
  }
  if (!facilityName.startsWith("QueuePilot QA ")) {
    throw new Error(
      'QUEUEPILOT_TEST_FACILITY must start with "QueuePilot QA " to keep the workspace clearly synthetic.',
    );
  }
  if (process.env.QUEUEPILOT_TEST_TERMS_ACCEPTED !== "true") {
    throw new Error(
      "Set QUEUEPILOT_TEST_TERMS_ACCEPTED=true only after reviewing the signup terms.",
    );
  }
}

async function assertIsolatedTestServer() {
  const response = await fetch(new URL("/api/dev/test-database", baseUrl), {
    headers: { Host: "127.0.0.1:3001" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      "The local server is not running in isolated test mode. Start it with npm run test:dev; no account was created.",
    );
  }
  const result = await response.json();
  if (
    result.branch !== process.env.QUEUEPILOT_TEST_BRANCH ||
    result.databaseFingerprint !==
      databaseFingerprint(process.env.QUEUEPILOT_TEST_DATABASE_URL)
  ) {
    throw new Error(
      "The local server database does not match the configured test branch; no account was created.",
    );
  }
}

async function postJson(path, body, cookie) {
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    throw new Error(`The local app returned a non-JSON response (${response.status}).`);
  }
  return { response, result };
}

async function signup() {
  await assertIsolatedTestServer();
  const { response } = await postJson("/api/auth/register", {
    name: ownerName,
    organizationName: facilityName,
    email,
    phone: "",
    password,
    confirmPassword: password,
    organizationType: "clinic",
    termsAccepted: true,
  });
  if (response.status !== 201) {
    throw new Error(
      `The existing signup flow rejected the test account (HTTP ${response.status}). Resolve the signup response in the local app; credentials were not printed.`,
    );
  }
  console.log(
    "Signup submitted through /api/auth/register. Verify the test email using the normal email link, then run: npm run test:account -- onboard",
  );
}

async function onboard() {
  await assertIsolatedTestServer();
  const { response: signInResponse } = await postJson(
    "/api/auth/sign-in/email",
    { email, password, rememberMe: true, callbackURL: `${baseUrl}/dashboard` },
  );
  if (!signInResponse.ok) {
    throw new Error(
      `Sign-in failed (HTTP ${signInResponse.status}). Verify the test email and confirm the account credentials; no auth bypass was attempted.`,
    );
  }

  const cookieHeaders =
    typeof signInResponse.headers.getSetCookie === "function"
      ? signInResponse.headers.getSetCookie()
      : [signInResponse.headers.get("set-cookie") ?? ""];
  const cookie = cookieHeaders
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) {
    throw new Error("The existing authentication flow did not issue a session cookie.");
  }

  const { response, result } = await postJson(
    "/api/auth/onboarding",
    {
      organizationName: facilityName,
      organizationType: "clinic",
      phone: "",
      termsAccepted: true,
    },
    cookie,
  );
  if (!response.ok || result.success !== true) {
    throw new Error(
      `Owner onboarding failed (HTTP ${response.status}). No test workspace was confirmed.`,
    );
  }

  const client = new Client({ connectionString: directDatabaseUrl });
  try {
    await client.connect();
    const membership = await client.query(
      `select o.name as organization_name, m.role
       from public."user" u
       join public.member m on m.user_id = u.id
       join public.organization o on o.id = m.organization_id
       where lower(u.email) = lower($1)`,
      [email],
    );
    if (
      membership.rowCount !== 1 ||
      membership.rows[0].organization_name !== facilityName ||
      membership.rows[0].role !== "owner"
    ) {
      throw new Error(
        "Database verification did not find exactly one owner membership for the dedicated test facility.",
      );
    }
  } finally {
    await client.end();
  }

  console.log(
    "Verified the test facility and owner membership in the isolated database. Continue by signing in through the local /login page.",
  );
}

try {
  requireTestEnvironment();
  if (action === "signup") {
    await signup();
  } else if (action === "onboard") {
    await onboard();
  } else {
    throw new Error("Usage: npm run test:account -- <signup|onboard>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Test account setup failed.");
  process.exitCode = 1;
}
