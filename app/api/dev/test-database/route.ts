import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

function isProductionBranch(branch: string) {
  return /(^|[-_])(prod|production|main)([-_]|$)/i.test(branch);
}

export async function GET(request: Request) {
  const branch = process.env.NEON_BRANCH ?? "";
  const testBranch = process.env.QUEUEPILOT_TEST_BRANCH ?? "";
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.QUEUEPILOT_TEST_MODE !== "true" ||
    request.headers.get("host") !== "127.0.0.1:3001" ||
    !testBranch ||
    branch !== testBranch ||
    isProductionBranch(branch) ||
    !process.env.DATABASE_URL
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const databaseHost = new URL(process.env.DATABASE_URL).hostname.replace(
    "-pooler",
    "",
  );
  const databaseFingerprint = createHash("sha256")
    .update(databaseHost)
    .digest("hex");

  return NextResponse.json({ branch, databaseFingerprint });
}
