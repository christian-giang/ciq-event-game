import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, submissions } from "@/db/schema";
import { getLeaderboards } from "@/lib/leaderboard";
import { isFrozen } from "@/lib/settings";

/**
 * Data feed for the projector view. Unauthenticated (the projector has no
 * keyboard); contains only what the room is meant to see: usernames,
 * points, and non-hidden media. CDN-cacheable for 10s.
 */
export async function GET() {
  const [boards, frozen, media] = await Promise.all([
    getLeaderboards(),
    isFrozen(),
    db
      .select({
        id: submissions.id,
        mediaUrl: submissions.mediaUrl,
        mediaKind: submissions.mediaKind,
        username: players.username,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(players, eq(players.id, submissions.playerId))
      .where(eq(submissions.isHidden, false))
      .orderBy(desc(submissions.createdAt))
      .limit(30),
  ]);

  return NextResponse.json(
    {
      frozen,
      top: boards.overall.slice(0, 10),
      photos: media
        .filter((m) => m.mediaUrl && m.mediaKind === "photo")
        .map((m) => ({ url: m.mediaUrl, username: m.username })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    },
  );
}
