import "server-only";
import { createRealtime } from "@neon/realtime/server";
import { drizzleAdapter } from "@neon/realtime-drizzle";

let client: ReturnType<typeof createRealtime> | undefined;

export function getRealtimeServer() {
  const secret = process.env.NEON_REALTIME_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!secret || !databaseUrl) {
    throw new Error("Neon Realtime is not configured.");
  }

  if (!client) {
    const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
    if (!databaseName) throw new Error("DATABASE_URL does not include a database name.");
    client = createRealtime({
      secret,
      db: databaseName,
      adapter: drizzleAdapter(),
    });
  }

  return client;
}

export function getRealtimeUrl() {
  const url = process.env.NEON_REALTIME_URL;
  if (!url) throw new Error("NEON_REALTIME_URL is not configured.");
  return url;
}
