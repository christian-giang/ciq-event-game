import { NextResponse } from "next/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { DEMO_EMAIL } from "@/lib/leaderboard";
import { getPlayerId } from "@/lib/session";

/** Roster for the "who else worked on this?" picker: activated, onboarded
 *  players, excluding the caller and the admin demo player. */
export async function GET() {
  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const rows = await db
    .select({
      id: players.id,
      username: players.username,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(
      and(
        eq(players.isActivated, true),
        eq(players.isBlocked, false),
        isNotNull(players.username),
        ne(players.email, DEMO_EMAIL),
        ne(players.id, playerId),
      ),
    );

  rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
  return NextResponse.json({ players: rows });
}
