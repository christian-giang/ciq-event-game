import { db } from "@/db";
import { bonusPoints, quizAnswers, submissions, votes } from "@/db/schema";
import { getCompletedQuests } from "@/lib/quests";
import { scoreQuest } from "@/lib/scoring";
import type { Quest } from "@/content/quests";

export type LeaderboardEntry = {
  playerId: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  /** Competition ranking: ties share a rank, the next rank is skipped. */
  rank: number;
};

/** Overall plus one board per quest category. */
export type LeaderboardCategory = "overall" | Quest["type"];

export type Leaderboards = Record<LeaderboardCategory, LeaderboardEntry[]>;

const DEMO_EMAIL = "demo@admin.local";
const CACHE_TTL_MS = 10_000;

let cache: { at: number; boards: Leaderboards } | null = null;

/**
 * Recompute-on-read with a 10s in-process cache — 200 guests
 * pull-to-refreshing must not hammer the DB. Only COMPLETED quests count:
 * points appear on the board when the hosts complete a quest.
 */
export async function getLeaderboards(): Promise<Leaderboards> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.boards;
  }

  const [quests, allPlayers, allSubmissions, allVotes, allAnswers, allBonus] =
    await Promise.all([
      getCompletedQuests(),
      db.query.players.findMany(),
      db
        .select({
          id: submissions.id,
          playerId: submissions.playerId,
          questId: submissions.questId,
          isHidden: submissions.isHidden,
          contributorIds: submissions.contributorIds,
        })
        .from(submissions),
      db
        .select({ voterId: votes.voterId, submissionId: votes.submissionId })
        .from(votes),
      db
        .select({
          playerId: quizAnswers.playerId,
          questId: quizAnswers.questId,
          isCorrect: quizAnswers.isCorrect,
        })
        .from(quizAnswers),
      db
        .select({ playerId: bonusPoints.playerId, points: bonusPoints.points })
        .from(bonusPoints),
    ]);

  // Host-awarded bonus points count toward the overall board only.
  const bonusByPlayer = new Map<string, number>();
  for (const b of allBonus) {
    bonusByPlayer.set(b.playerId, (bonusByPlayer.get(b.playerId) ?? 0) + b.points);
  }

  // Blocked players, the admin's demo player, and anyone who hasn't
  // finished onboarding (no name yet) never appear.
  const eligible = allPlayers.filter(
    (p) => !p.isBlocked && p.email !== DEMO_EMAIL && p.username,
  );

  const totalsFor = (selected: Quest[]): Map<string, number> => {
    const totals = new Map<string, number>();
    for (const quest of selected) {
      const scores = scoreQuest(
        quest,
        allSubmissions.filter((s) => s.questId === quest.id),
        allVotes,
        allAnswers.filter((a) => a.questId === quest.id),
      );
      for (const [playerId, pts] of scores) {
        totals.set(playerId, (totals.get(playerId) ?? 0) + pts);
      }
    }
    return totals;
  };

  const rank = (totals: Map<string, number>): LeaderboardEntry[] => {
    const sorted = eligible
      .map((p) => ({
        playerId: p.id,
        username: p.username ?? "",
        avatarUrl: p.avatarUrl,
        points: totals.get(p.id) ?? 0,
      }))
      .sort(
        (a, b) => b.points - a.points || a.username.localeCompare(b.username),
      );
    const entries: LeaderboardEntry[] = sorted.map((entry, i) => ({
      ...entry,
      rank: i > 0 && sorted[i - 1].points === entry.points ? 0 : i + 1,
    }));
    // Ties share the higher rank.
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].rank === 0) entries[i].rank = entries[i - 1].rank;
    }
    return entries;
  };

  const overallTotals = totalsFor(quests);

  // Voting participation: +1 per completed voted quest a player cast a vote on.
  const votedQuestIds = new Set(
    quests.filter((q) => q.type !== "quiz").map((q) => q.id),
  );
  const questIdBySubmission = new Map(
    allSubmissions.map((s) => [s.id, s.questId]),
  );
  const votedQuestsByVoter = new Map<string, Set<string>>();
  for (const v of allVotes) {
    const questId = questIdBySubmission.get(v.submissionId);
    if (!questId || !votedQuestIds.has(questId)) continue;
    let set = votedQuestsByVoter.get(v.voterId);
    if (!set) {
      set = new Set();
      votedQuestsByVoter.set(v.voterId, set);
    }
    set.add(questId);
  }
  for (const [playerId, questSet] of votedQuestsByVoter) {
    overallTotals.set(
      playerId,
      (overallTotals.get(playerId) ?? 0) + questSet.size,
    );
  }

  for (const [playerId, pts] of bonusByPlayer) {
    overallTotals.set(playerId, (overallTotals.get(playerId) ?? 0) + pts);
  }

  const boards: Leaderboards = {
    overall: rank(overallTotals),
    quiz: rank(totalsFor(quests.filter((q) => q.type === "quiz"))),
    text: rank(totalsFor(quests.filter((q) => q.type === "text"))),
    media: rank(totalsFor(quests.filter((q) => q.type === "media"))),
  };

  cache = { at: Date.now(), boards };
  return boards;
}

/** For tests / after admin actions that must reflect instantly. */
export function invalidateLeaderboardCache(): void {
  cache = null;
}

export async function getPlayerRank(
  playerId: string,
): Promise<LeaderboardEntry | null> {
  const boards = await getLeaderboards();
  return boards.overall.find((e) => e.playerId === playerId) ?? null;
}

export { DEMO_EMAIL };
