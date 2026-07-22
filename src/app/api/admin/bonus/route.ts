import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bonusPoints, players } from "@/db/schema";
import { invalidateLeaderboardCache } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  playerIds: z.array(z.uuid()).min(1).max(300),
  points: z.number().int().refine((n) => n !== 0, "Points can't be zero"),
  reason: z.string().trim().min(1).max(100),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Enter points and a short reason, and pick at least one player." },
      { status: 400 },
    );
  }

  if (Math.abs(body.points) > 10000) {
    return NextResponse.json({ error: "That's a lot of points." }, { status: 400 });
  }

  // Only award to real, non-blocked players.
  const ids = [...new Set(body.playerIds)];
  const valid = await db
    .select({ id: players.id })
    .from(players)
    .where(inArray(players.id, ids));
  const validIds = valid.map((v) => v.id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid players." }, { status: 400 });
  }

  const batchId = randomUUID();
  await db.insert(bonusPoints).values(
    validIds.map((playerId) => ({
      batchId,
      playerId,
      points: body.points,
      reason: body.reason,
    })),
  );
  invalidateLeaderboardCache();

  return NextResponse.json({ ok: true, count: validIds.length });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const batchId = new URL(req.url).searchParams.get("batchId");
  const parsed = z.uuid().safeParse(batchId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing award id." }, { status: 400 });
  }
  await db.delete(bonusPoints).where(eq(bonusPoints.batchId, parsed.data));
  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true });
}
