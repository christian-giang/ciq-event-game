import { randomUUID } from "node:crypto";
import { inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  players,
  questsTable,
  quizAnswers,
  submissions,
  votes,
} from "@/db/schema";
import { invalidateLeaderboardCache } from "@/lib/leaderboard";
import { questTemplate } from "@/content/quest-template";
import type { Quest } from "@/content/quests";

/**
 * A load of fake game data for testing the leaderboard, results and big
 * screen — and a matching teardown. EVERYTHING here is tagged so cleanup only
 * removes simulated data and never touches real players/quests/submissions:
 *   - sim players use @sim.local emails (real signups can't produce these)
 *   - sim quests use ids prefixed "sim-"
 * Deleting a sim player cascades their submissions, answers and votes.
 */

const SIM_EMAIL_LIKE = "%@sim.local";
const SIM_QUEST_LIKE = "sim-%";

const simEmail = (i: number) => `sim-${i}@sim.local`;
const simCode = (i: number) => `SIM${String(i).padStart(3, "0")}`; // letter → never collides with 6-digit real codes
const img = (seed: string, w = 640, h = 420) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const NAMES = [
  "Ada", "Grace", "Alan", "Linus", "Katherine", "Dennis",
  "Margaret", "Tim", "Radia", "Hedy", "Guido", "Barbara",
];

// Sim quests are sim-prefixed copies of the real template, mostly "completed"
// so the leaderboard/results fill up. One text quest is left "voting" so the
// vote feed has something to test live. Images aren't copied (the template
// doesn't carry them), but result texts and group flags are.
const LIVE_VOTE_ID = "write-three-words";
const SIM_QUESTS: Quest[] = questTemplate.map((q): Quest => ({
  ...q,
  id: `sim-${q.id}`,
  order: 9000 + q.order,
  state: q.id === LIVE_VOTE_ID ? "voting" : "completed",
}));

const TEXTS = [
  "Relentless", "Fast, sharp, focused", "The Knockout Kings",
  "Trust the process", "Legendary and caffeinated", "Ship it, then ship more",
  "Always adapting",
];

export type SeedSummary = {
  players: number; quests: number;
  submissions: number; votes: number; answers: number;
};
export type ClearSummary = { players: number; quests: number };

export async function seedSimulation(): Promise<SeedSummary> {
  // Always start from a clean slate so re-running gives a fresh, consistent set.
  await clearSimulation();

  return db.transaction(async (tx) => {
    const playerRows = await tx
      .insert(players)
      .values(
        NAMES.map((name, i) => ({
          email: simEmail(i + 1),
          username: name,
          accessCode: simCode(i + 1),
          avatarUrl: i % 3 === 0 ? img(`simavatar${i}`, 200, 200) : null,
          isActivated: true,
        })),
      )
      .returning({ id: players.id });
    const ids = playerRows.map((r) => r.id);

    await tx
      .insert(questsTable)
      .values(SIM_QUESTS.map((q) => ({ id: q.id, data: q })));

    // --- Quiz answers: everyone answers, ~70% get it right ---
    const answerValues: (typeof quizAnswers.$inferInsert)[] = [];
    for (const q of SIM_QUESTS) {
      if (q.type !== "quiz") continue;
      const wrong = q.options
        .map((o) => o.id)
        .filter((id) => id !== q.correctOptionId);
      ids.forEach((pid, i) => {
        const correct = i % 10 < 7;
        const chosen = correct ? q.correctOptionId : wrong[i % wrong.length];
        answerValues.push({
          playerId: pid,
          questId: q.id,
          chosenOptionId: chosen,
          isCorrect: chosen === q.correctOptionId,
          clientUuid: randomUUID(),
        });
      });
    }
    if (answerValues.length) await tx.insert(quizAnswers).values(answerValues);

    // --- Voted quests (text/media): submissions + votes ---
    let subCount = 0;
    let voteCount = 0;
    const submitterCount = Math.min(6, ids.length);

    for (const quest of SIM_QUESTS) {
      if (quest.type !== "text" && quest.type !== "media") continue;
      const isText = quest.type === "text";
      const submitterIds = ids.slice(0, submitterCount);

      const subRows = await tx
        .insert(submissions)
        .values(
          submitterIds.map((pid, i) => ({
            playerId: pid,
            questId: quest.id,
            // Media sim submissions are all images (picsum) for simplicity,
            // even on video quests — enough to populate the board.
            kind: isText ? ("text" as const) : ("photo" as const),
            bodyText: isText ? TEXTS[i % TEXTS.length] : null,
            mediaUrl: isText ? null : img(`simsub-${quest.id}-${i}`),
            mediaKind: isText ? null : ("photo" as const),
            // Group quests credit a couple of teammates, to exercise crediting.
            contributorIds: quest.group
              ? [ids[(i + 1) % ids.length], ids[(i + 2) % ids.length]].filter(
                  (id) => id !== pid,
                )
              : [],
            clientUuid: randomUUID(),
          })),
        )
        .returning({ id: submissions.id });
      subCount += subRows.length;

      // Only completed quests get votes; the "voting" one is left open to test.
      if (quest.state !== "completed") continue;

      const voteValues: { voterId: string; submissionId: string }[] = [];
      const seen = new Set<string>();
      subRows.forEach((sub, i) => {
        // Earlier submissions get more votes → a clear 🥇🥈🥉 podium.
        const n = Math.max(1, subRows.length - i + 2);
        for (let j = 0; j < n; j++) {
          const voterId = ids[(i + j) % ids.length];
          const key = `${voterId}:${sub.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          voteValues.push({ voterId, submissionId: sub.id });
        }
      });
      if (voteValues.length) {
        await tx.insert(votes).values(voteValues);
        voteCount += voteValues.length;
      }
    }

    invalidateLeaderboardCache();
    return {
      players: ids.length,
      quests: SIM_QUESTS.length,
      submissions: subCount,
      votes: voteCount,
      answers: answerValues.length,
    };
  });
}

export async function clearSimulation(): Promise<ClearSummary> {
  return db.transaction(async (tx) => {
    const simPlayers = await tx
      .select({ id: players.id })
      .from(players)
      .where(like(players.email, SIM_EMAIL_LIKE));
    const simPlayerIds = simPlayers.map((p) => p.id);

    // Deleting sim players cascades their submissions, answers and votes
    // (including sim votes cast on real submissions).
    if (simPlayerIds.length) {
      await tx.delete(players).where(inArray(players.id, simPlayerIds));
    }
    // Sweep anything still attached to sim quests (e.g. a real player who
    // tested one), then the sim quests themselves.
    await tx.delete(submissions).where(like(submissions.questId, SIM_QUEST_LIKE));
    await tx.delete(quizAnswers).where(like(quizAnswers.questId, SIM_QUEST_LIKE));
    const delQuests = await tx
      .delete(questsTable)
      .where(like(questsTable.id, SIM_QUEST_LIKE))
      .returning({ id: questsTable.id });

    invalidateLeaderboardCache();
    return { players: simPlayerIds.length, quests: delQuests.length };
  });
}
