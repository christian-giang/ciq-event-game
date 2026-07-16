import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, quizAnswers } from "@/db/schema";
import { getQuest } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { isFrozen } from "@/lib/settings";

const bodySchema = z.object({
  clientUuid: z.uuid(),
  questId: z.string().min(1),
  chosenOptionId: z.string().min(1),
});

/**
 * Records a quiz answer. First answer counts; retries (same clientUuid)
 * and second thoughts (same player+quest) both resolve to the stored
 * first answer, so the outbox can retry safely forever.
 */
export async function POST(req: Request) {
  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  if (await isFrozen()) {
    return NextResponse.json(
      { error: "The game is over — the leaderboard is final!" },
      { status: 409 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const quest = await getQuest(body.questId);
  if (!quest || quest.type !== "quiz" || quest.state === "unreleased") {
    return NextResponse.json({ error: "Unknown quest." }, { status: 400 });
  }
  if (quest.state !== "released") {
    return NextResponse.json(
      { error: "Answers are closed for this quest." },
      { status: 409 },
    );
  }
  if (!quest.options.some((o) => o.id === body.chosenOptionId)) {
    return NextResponse.json({ error: "Unknown option." }, { status: 400 });
  }

  const isCorrect = body.chosenOptionId === quest.correctOptionId;

  try {
    await db
      .insert(quizAnswers)
      .values({
        playerId,
        questId: quest.id,
        chosenOptionId: body.chosenOptionId,
        isCorrect,
        clientUuid: body.clientUuid,
      })
      .onConflictDoNothing({
        target: [quizAnswers.playerId, quizAnswers.questId],
      });
  } catch (err) {
    // Same clientUuid retried: unique(client_uuid) fires before the
    // player+quest conflict target — fall through to the stored answer.
    if ((err as { code?: string }).code !== "23505") throw err;
  }

  const stored = await db.query.quizAnswers.findFirst({
    where: and(
      eq(quizAnswers.playerId, playerId),
      eq(quizAnswers.questId, quest.id),
    ),
  });
  if (!stored) {
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }

  // Never reveal correctness at answer time — the reveal happens only when
  // the game master completes the quest (see the quest page).
  return NextResponse.json({ ok: true, chosenOptionId: stored.chosenOptionId });
}
