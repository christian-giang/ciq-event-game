import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getPlayerId } from "@/lib/session";

export type Player = typeof players.$inferSelect;

/**
 * The logged-in, non-blocked player, or null. `username === null` means
 * they haven't finished onboarding (set their name) yet — callers gate on
 * that and send them to /me.
 */
export async function getCurrentPlayer(): Promise<Player | null> {
  const id = await getPlayerId();
  if (!id) return null;
  const player = await db.query.players.findFirst({
    where: eq(players.id, id),
  });
  if (!player || player.isBlocked) return null;
  return player;
}
