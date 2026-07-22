import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { questsTable, quizAnswers, submissions } from "@/db/schema";
import { questTemplate, questTemplateIds } from "@/content/quest-template";
import { validateQuests } from "@/content/quests.schema";
import { invalidateLeaderboardCache } from "@/lib/leaderboard";
import { isAdmin } from "@/lib/session";

/** Load the bundled quest template: inserts only quests not already present
 *  (so it never overwrites edits/images on quests you've already loaded). */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  validateQuests(questTemplate); // guard against a malformed template

  const inserted = await db
    .insert(questsTable)
    .values(questTemplate.map((q) => ({ id: q.id, data: q })))
    .onConflictDoNothing({ target: questsTable.id })
    .returning({ id: questsTable.id });

  invalidateLeaderboardCache();
  return NextResponse.json({
    ok: true,
    inserted: inserted.length,
    total: questTemplate.length,
  });
}

/** Remove all template quests (and their submissions/answers). */
export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const removed = await db.transaction(async (tx) => {
    await tx
      .delete(submissions)
      .where(inArray(submissions.questId, questTemplateIds));
    await tx
      .delete(quizAnswers)
      .where(inArray(quizAnswers.questId, questTemplateIds));
    const del = await tx
      .delete(questsTable)
      .where(inArray(questsTable.id, questTemplateIds))
      .returning({ id: questsTable.id });
    return del.length;
  });

  invalidateLeaderboardCache();
  return NextResponse.json({ ok: true, removed });
}
