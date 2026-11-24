import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { notifications } from "@/app/db/schema";
import { getSession } from "@/app/lib/server-auth";
import { getRealtimeServer, getRealtimeUrl } from "@/app/lib/neon-realtime";

export async function GET(request: Request) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "Email verification required." }, { status: 403 });
  }

  const query = db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      created_at: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  const sealedQuery = await getRealtimeServer().seal({ query });

  return NextResponse.json(
    { query: sealedQuery, url: getRealtimeUrl() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
