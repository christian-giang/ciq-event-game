import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questsTable, quizAnswers, submissions } from "@/db/schema";
import type { Quest } from "@/content/quests";
import { questSchema, questsSchema } from "@/content/quests.schema";

/**
 * Quests live in the DB (seeded from src/content/quests.ts) so they can be
 * created and edited from /admin. Every read and write goes through the
 * same Zod validation the config file uses.
 */

export async function getQuests(): Promise<Quest[]> {
  const rows = await db.select().from(questsTable);
  const parsed = rows.map((r) => questSchema.parse(r.data) as Quest);
  return parsed.sort((a, b) => a.order - b.order);
}

/** Everything a player may see: released, voting or completed. */
export async function getVisibleQuests(): Promise<Quest[]> {
  return (await getQuests()).filter((q) => q.state !== "unreleased");
}

/** Quests currently open for voting. */
export async function getVotingQuests(): Promise<
  Exclude<Quest, { type: "quiz" }>[]
> {
  return (await getQuests()).filter(
    (q): q is Exclude<Quest, { type: "quiz" }> =>
      q.state === "voting" && q.type !== "quiz",
  );
}

/** Only completed quests count toward the leaderboard. */
export async function getCompletedQuests(): Promise<Quest[]> {
  return (await getQuests()).filter((q) => q.state === "completed");
}

export async function getQuest(id: string): Promise<Quest | null> {
  const row = await db.query.questsTable.findFirst({
    where: eq(questsTable.id, id),
  });
  return row ? (questSchema.parse(row.data) as Quest) : null;
}

/**
 * Creates or updates one quest. Validates the quest itself AND the whole
 * resulting set (unique ids, unique orders), so a bad save can't corrupt
 * the game. Throws with a readable message on invalid input.
 */
export async function upsertQuest(candidate: unknown): Promise<Quest> {
  const quest = questSchema.parse(candidate) as Quest;

  const others = (await getQuests()).filter((q) => q.id !== quest.id);
  const result = questsSchema.safeParse([...others, quest]);
  if (!result.success) {
    // Surface the human-relevant refinement message (e.g. duplicate order).
    const msg = result.error.issues.map((i) => i.message).join("; ");
    throw new Error(msg);
  }

  await db
    .insert(questsTable)
    .values({ id: quest.id, data: quest, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: questsTable.id,
      set: { data: quest, updatedAt: new Date() },
    });
  return quest;
}

/**
 * Hard-deletes a quest and everything attached to it (submissions, quiz
 * answers; votes cascade from submissions). Irreversible — the admin UI
 * confirms first.
 */
export async function deleteQuest(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(submissions).where(eq(submissions.questId, id));
    await tx.delete(quizAnswers).where(eq(quizAnswers.questId, id));
    await tx.delete(questsTable).where(eq(questsTable.id, id));
  });
}
