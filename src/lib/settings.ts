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
