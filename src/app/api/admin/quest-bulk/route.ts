import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invalidateLeaderboardCache } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  action: z.enum(["release-all", "open-voting-all", "complete-all"]),
});

/**
 * Bulk quest-state transitions for running the event:
 *  - release-all:     every unreleased quest → released
 *  - open-voting-all: every released voted (text/media) quest → voting
 *  - complete-all:    every in-play quest (released or voting) → completed
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let action: z.infer<typeof bodySchema>["action"];
  try {
    action = bodySchema.parse(await req.json()).action;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const query =
    action === "release-all"
      ? sql`UPDATE quests SET data = jsonb_set(data, '{state}', '"released"'::jsonb), updated_at = now() WHERE data->>'state' = 'unreleased'`
      : action === "open-voting-all"
        ? sql`UPDATE quests SET data = jsonb_set(data, '{state}', '"voting"'::jsonb), updated_at = now() WHERE data->>'state' = 'released' AND data->>'type' IN ('text','media')`
        : sql`UPDATE quests SET data = jsonb_set(data, '{state}', '"completed"'::jsonb), updated_at = now() WHERE data->>'state' IN ('released','voting')`;

  const result = await db.execute(query);
  invalidateLeaderboardCache();
  return NextResponse.json({
    ok: true,
    count: (result as { rowCount?: number | null }).rowCount ?? 0,
  });
}
