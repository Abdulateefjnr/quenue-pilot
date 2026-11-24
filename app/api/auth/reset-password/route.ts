import { APIError } from "better-auth/api";
import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { passwordResetSchema } from "@/app/lib/validations";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = passwordResetSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the new password." },
      { status: 400 },
    );
  }

  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.newPassword },
      headers: request.headers,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: error.statusCode },
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
