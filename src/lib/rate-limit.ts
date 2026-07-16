import { createHash } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const MAX_ATTEMPTS_PER_IP_PER_MINUTE = 10;

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${process.env.SESSION_SECRET}`)
    .digest("hex");
}

export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/** True if this IP is over the login-attempt budget for the last minute. */
export async function isRateLimited(ip: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [{ attempts }] = await db
    .select({ attempts: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipHash, hashIp(ip)),
        gt(loginAttempts.createdAt, oneMinuteAgo),
      ),
    );
  return attempts >= MAX_ATTEMPTS_PER_IP_PER_MINUTE;
}

export async function recordLoginAttempt(
  ip: string,
  success: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({ ipHash: hashIp(ip), success });
}
