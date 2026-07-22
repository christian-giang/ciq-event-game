import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, submissions, votes } from "@/db/schema";
import { getQuest } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { isFrozen } from "@/lib/settings";

const bodySchema = z.object({
  submissionId: z.uuid(),
  action: z.enum(["add", "remove"]),
});

/**
 * Vote toggle. Server-enforced (not just hidden buttons):
 *  - no voting on your own submission
 *  - one vote per submission per voter (UNIQUE constraint)
 *  - at most quest.voting.votesPerPlayer votes per quest, enforced under a
 *    per-(voter, quest) advisory lock so parallel taps can't exceed the cap
 */
export async function POST(req: Request) {
  const voterId = await getPlayerId();
  if (!voterId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const voter = await db.query.players.findFirst({
    where: eq(players.id, voterId),
  });
  if (!voter || voter.isBlocked) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  if (await isFrozen()) {
    return NextResponse.json(
      { error: "Voting is closed — the leaderboard is final!" },
      { status: 409 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, body.submissionId),
  });
  if (!submission || submission.isHidden) {
    return NextResponse.json({ error: "Unknown submission." }, { status: 404 });
  }
  if (
    submission.playerId === voterId ||
    submission.contributorIds.includes(voterId)
  ) {
    return NextResponse.json(
      { error: "Nice try — you can't vote for your own group's submission." },
      { status: 403 },
    );
  }

  const quest = await getQuest(submission.questId);
  if (!quest || quest.type === "quiz") {
    return NextResponse.json({ error: "Unknown quest." }, { status: 400 });
  }
  if (quest.state !== "voting") {
    return NextResponse.json(
      { error: "Voting isn't open for this quest." },
      { status: 409 },
    );
  }
  const cap = quest.voting.votesPerPlayer;

  // All submission ids of this quest (for budget counting).
  const questSubmissionIds = db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.questId, submission.questId));

  const result = await db.transaction(async (tx) => {
    // Serialize this voter's votes on this quest.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${voterId + ":" + submission.questId}, 0))`,
    );

    if (body.action === "remove") {
      await tx
        .delete(votes)
        .where(
          and(
            eq(votes.voterId, voterId),
            eq(votes.submissionId, submission.id),
          ),
        );
    } else {
      const [{ used }] = await tx
        .select({ used: sql<number>`count(*)` })
        .from(votes)
        .where(
          and(
            eq(votes.voterId, voterId),
            inArray(votes.submissionId, questSubmissionIds),
          ),
        );
      if (Number(used) >= cap) {
        return { error: `You've used all ${cap} votes for this quest.` };
      }
      await tx
        .insert(votes)
        .values({ voterId, submissionId: submission.id })
        .onConflictDoNothing();
    }

    const [{ used }] = await tx
      .select({ used: sql<number>`count(*)` })
      .from(votes)
      .where(
        and(
          eq(votes.voterId, voterId),
          inArray(votes.submissionId, questSubmissionIds),
        ),
      );
    return { votesUsed: Number(used) };
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, votesUsed: cap },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true, votesUsed: result.votesUsed, cap });
}
