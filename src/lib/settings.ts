import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * The freeze flag: when true, all player writes (submissions, votes,
 * answers) are rejected and the leaderboard is final.
 */
export async function isFrozen(): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, "frozen"),
  });
  return row?.value === true;
}

export async function setFrozen(frozen: boolean): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "frozen", value: frozen })
    .onConflictDoUpdate({ target: settings.key, set: { value: frozen } });
}

/**
 * Leaderboard display mode for players:
 *  - "relative" (default): show only you and the players just above/below you
 *  - "absolute": show the full top of the board
 */
export type LeaderboardMode = "relative" | "absolute";

export async function getLeaderboardMode(): Promise<LeaderboardMode> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, "leaderboard_mode"),
  });
  return row?.value === "absolute" ? "absolute" : "relative";
}

export async function setLeaderboardMode(mode: LeaderboardMode): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "leaderboard_mode", value: mode })
    .onConflictDoUpdate({ target: settings.key, set: { value: mode } });
}
