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

const VOTING = {
  pointsByRank: [12, 8, 5, 3],
  participationPoints: 2,
  minVotesToRank: 3,
  votesPerPlayer: 5,
};

const NAMES = [
  "Ada", "Grace", "Alan", "Linus", "Katherine", "Dennis",
  "Margaret", "Tim", "Radia", "Hedy", "Guido", "Barbara",
];

const SIM_QUESTS: Quest[] = [
  {
    id: "sim-quiz-1", order: 9001, type: "quiz",
    title: "Sim · Quick maths", prompt: "What is 7 × 6?",
    imageUrl: img("simquiz1"),
    options: [
      { id: "a", label: "40" }, { id: "b", label: "42" },
      { id: "c", label: "44" }, { id: "d", label: "48" },
    ],
    correctOptionId: "b", points: 5, revealAfterAnswer: true, state: "completed",
  },
  {
    id: "sim-quiz-2", order: 9002, type: "quiz",
    title: "Sim · Geography", prompt: "What's the capital of Australia?",
    options: [
      { id: "syd", label: "Sydney" }, { id: "mel", label: "Melbourne" },
      { id: "can", label: "Canberra" }, { id: "per", label: "Perth" },
    ],
    correctOptionId: "can", points: 5, revealAfterAnswer: true, state: "completed",
  },
  {
    id: "sim-text-1", order: 9003, type: "text",
    title: "Sim · Team motto", prompt: "Best team motto in five words.",
    maxChars: 120, voting: VOTING, state: "completed",
    resultImageUrl: img("simtext1result"),
  },
  {
    id: "sim-text-2", order: 9004, type: "text",
    title: "Sim · One word", prompt: "Describe the team in one word.",
    maxChars: 40, voting: VOTING, state: "voting",
  },
  {
    id: "sim-photo-1", order: 9005, type: "media", mediaKind: "photo",
    title: "Sim · Best desk", prompt: "Show us your desk setup.",
    imageUrl: img("simphoto1q"), resultImageUrl: img("simphoto1r"),
    voting: VOTING, state: "completed",
  },
];

const MOTTOS = [
  "Ship it and iterate fast", "Fail small, learn big",
  "Trust the process always", "Move fast, stay kind",
  "Done beats perfect today", "Strong opinions, loosely held",
];
const ONE_WORDS = [
  "Relentless", "Caffeinated", "Unstoppable", "Curious", "Chaotic",
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

    // --- Voted quests: submissions + votes ---
    const voted: {
      quest: string;
      kind: "text" | "photo";
      bodies: string[] | null;
      submitters: number;
    }[] = [
      { quest: "sim-text-1", kind: "text", bodies: MOTTOS, submitters: 6 },
      { quest: "sim-text-2", kind: "text", bodies: ONE_WORDS, submitters: 5 },
      { quest: "sim-photo-1", kind: "photo", bodies: null, submitters: 6 },
    ];

    let subCount = 0;
    let voteCount = 0;

    for (const cfg of voted) {
      const submitterIds = ids.slice(0, cfg.submitters);
      const subRows = await tx
        .insert(submissions)
        .values(
          submitterIds.map((pid, i) => ({
            playerId: pid,
            questId: cfg.quest,
            kind: cfg.kind,
            bodyText: cfg.bodies ? cfg.bodies[i % cfg.bodies.length] : null,
            mediaUrl: cfg.kind === "photo" ? img(`simsub-${cfg.quest}-${i}`) : null,
            mediaKind: cfg.kind === "photo" ? ("photo" as const) : null,
            clientUuid: randomUUID(),
          })),
        )
        .returning({ id: submissions.id });
      subCount += subRows.length;

      // Only completed quests get votes; leave the "voting" one open for the
      // tester to vote on live.
      const quest = SIM_QUESTS.find((q) => q.id === cfg.quest)!;
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
