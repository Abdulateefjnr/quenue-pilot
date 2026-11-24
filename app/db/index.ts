import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

export const pool = new Pool({
  connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full"),
  max: 5,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on("error", (error: Error & { code?: string }) => {
  console.error("Database pool error", { code: error.code });
});

export const db = drizzle(pool);
