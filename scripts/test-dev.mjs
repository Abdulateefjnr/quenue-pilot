import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const testBranch = process.env.QUEUEPILOT_TEST_BRANCH?.trim();
const testDatabaseUrl = process.env.QUEUEPILOT_TEST_DATABASE_URL;
const testDatabaseUrlUnpooled =
  process.env.QUEUEPILOT_TEST_DATABASE_URL_UNPOOLED;
const baseUrl = "http://127.0.0.1:3001";

function isProductionBranch(branch) {
  return /(^|[-_])(prod|production|main)([-_]|$)/i.test(branch ?? "");
}

function normalizedDatabaseHost(connectionString) {
  return new URL(connectionString).hostname.replace("-pooler", "");
}

if (process.env.QUEUEPILOT_TEST_MODE !== "true") {
  throw new Error("Set QUEUEPILOT_TEST_MODE=true to start the isolated test app.");
}
if (!testBranch || isProductionBranch(testBranch)) {
  throw new Error("QUEUEPILOT_TEST_BRANCH must name a non-production branch.");
}
if (!testDatabaseUrl || !testDatabaseUrlUnpooled) {
  throw new Error(
    "Set both QUEUEPILOT_TEST_DATABASE_URL and QUEUEPILOT_TEST_DATABASE_URL_UNPOOLED.",
  );
}

try {
  const productionUrl = process.env.DATABASE_URL;
  if (
    productionUrl &&
    normalizedDatabaseHost(productionUrl) ===
      normalizedDatabaseHost(testDatabaseUrl)
  ) {
    throw new Error(
      "The test database endpoint matches DATABASE_URL; refusing to run against the linked database.",
    );
  }
  new URL(testDatabaseUrlUnpooled);
} catch (error) {
  if (error instanceof Error && error.message.startsWith("The test database")) {
    throw error;
  }
  throw new Error("The test database connection URL is invalid.");
}

const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      QUEUEPILOT_TEST_MODE: "true",
      NEON_BRANCH: testBranch,
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_UNPOOLED: testDatabaseUrlUnpooled,
      BETTER_AUTH_URL: baseUrl,
      NEXT_PUBLIC_APP_URL: baseUrl,
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Could not start the isolated test app:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    return;
  }
  process.exitCode = code ?? 1;
});
