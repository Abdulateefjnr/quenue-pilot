import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    microsoft: Boolean(
      process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
    ),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET,
    ),
  });
}
