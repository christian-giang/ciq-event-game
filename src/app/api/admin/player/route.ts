import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { invalidateLeaderboardCache } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  playerId: z.uuid(),
  isBlocked: z.boolean(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const [updated] = await db
    .update(players)
    .set({ isBlocked: body.isBlocked })
    .where(eq(players.id, body.playerId))
    .returning({ id: players.id });

  if (!updated) {
    return NextResponse.json({ error: "No such player." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Hard-deletes a player, freeing their email + username to sign up fresh.
 * Their submissions, quiz answers and votes cascade away with them.
 */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing player id." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(players)
    .where(eq(players.id, parsed.data))
    .returning({ id: players.id });

  if (!deleted) {
    return NextResponse.json({ error: "No such player." }, { status: 404 });
  }
  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true });
}
