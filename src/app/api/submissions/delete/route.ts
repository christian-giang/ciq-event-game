import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { storageDriver } from "@/lib/media/server";
import { getPlayerId } from "@/lib/session";

const bodySchema = z.object({ submissionId: z.uuid() });

/**
 * "Delete my submission" (privacy requirement §9). Players can only
 * delete their own; votes cascade with the row. Media file cleanup is
 * best-effort — the DB row is the source of truth.
 */
export async function POST(req: Request) {
  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(submissions)
    .where(
      and(
        eq(submissions.id, body.submissionId),
        eq(submissions.playerId, playerId),
      ),
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (deleted.mediaUrl) {
    try {
      if (storageDriver() === "local") {
        const name = deleted.mediaUrl.split("/").pop();
        if (name && /^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(name)) {
          await unlink(path.join(".uploads", name));
        }
      } else {
        const { del } = await import("@vercel/blob");
        await del(deleted.mediaUrl);
      }
    } catch (err) {
      console.warn("media cleanup failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
