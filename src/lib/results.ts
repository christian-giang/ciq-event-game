import { db } from "@/db";
import { quizAnswers, submissions, votes } from "@/db/schema";
import { DEMO_EMAIL } from "@/lib/leaderboard";
import { getCompletedQuests } from "@/lib/quests";

/**
 * Per-quest results for COMPLETED quests only — the payoff view. Quizzes show
 * the correct answer + how the room voted; text/media quests show the ranked
 * winners with vote counts. Vote counts are safe to reveal here (unlike the
 * live vote feed) because the quest is already locked.
 */

export type ResultEntry = {
  submissionId: string;
  username: string;
  avatarUrl: string | null;
  bodyText: string | null;
  mediaUrl: string | null;
  kind: string;
  votes: number;
  rank: number;
  /** Usernames of co-contributors credited on the submission. */
  contributors: string[];
};

export type QuizOptionResult = {
  id: string;
  label: string;
  count: number;
  isCorrect: boolean;
};

type Common = {
  questId: string;
  order: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  resultImageUrl?: string;
};

export type QuestResult =
  | (Common & {
      kind: "quiz";
      options: QuizOptionResult[];
      totalAnswers: number;
      correctCount: number;
    })
  | (Common & {
      kind: "voted";
      type: "text" | "media";
      ranked: boolean;
      entries: ResultEntry[];
    });

/** How many top submissions to surface per voted quest. */
const TOP_N = 3;

export async function getQuestResults(): Promise<QuestResult[]> {
  const quests = await getCompletedQuests();
  if (quests.length === 0) return [];

  const [allPlayers, allSubs, allVotes, allAnswers] = await Promise.all([
    db.query.players.findMany(),
    db
      .select({
        id: submissions.id,
        playerId: submissions.playerId,
        questId: submissions.questId,
        isHidden: submissions.isHidden,
        bodyText: submissions.bodyText,
        mediaUrl: submissions.mediaUrl,
        kind: submissions.kind,
        contributorIds: submissions.contributorIds,
      })
      .from(submissions),
    db.select({ submissionId: votes.submissionId }).from(votes),
    db
      .select({
        questId: quizAnswers.questId,
        playerId: quizAnswers.playerId,
        chosenOptionId: quizAnswers.chosenOptionId,
        isCorrect: quizAnswers.isCorrect,
      })
      .from(quizAnswers),
  ]);

  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  // Blocked players and the admin's demo player never appear in results.
  const excluded = new Set(
    allPlayers
      .filter((p) => p.isBlocked || p.email === DEMO_EMAIL)
      .map((p) => p.id),
  );

  const voteCount = new Map<string, number>();
  for (const v of allVotes) {
    voteCount.set(v.submissionId, (voteCount.get(v.submissionId) ?? 0) + 1);
  }

  const results: QuestResult[] = [];

  for (const quest of quests) {
    const common: Common = {
      questId: quest.id,
      order: quest.order,
      title: quest.title,
      prompt: quest.prompt,
      imageUrl: quest.imageUrl,
      resultImageUrl: quest.resultImageUrl,
    };

    if (quest.type === "quiz") {
      const answers = allAnswers.filter(
        (a) => a.questId === quest.id && !excluded.has(a.playerId),
      );
      const byOption = new Map<string, number>();
      for (const a of answers) {
        byOption.set(
          a.chosenOptionId,
          (byOption.get(a.chosenOptionId) ?? 0) + 1,
        );
      }
      results.push({
        ...common,
        kind: "quiz",
        totalAnswers: answers.length,
        correctCount: answers.filter((a) => a.isCorrect).length,
        options: quest.options.map((o) => ({
          id: o.id,
          label: o.label,
          count: byOption.get(o.id) ?? 0,
          isCorrect: o.id === quest.correctOptionId,
        })),
      });
      continue;
    }

    // text | media — rank visible submissions by vote count.
    const visible = allSubs.filter(
      (s) => s.questId === quest.id && !s.isHidden && !excluded.has(s.playerId),
    );
    const totalVotes = visible.reduce(
      (n, s) => n + (voteCount.get(s.id) ?? 0),
      0,
    );
    const ranked = totalVotes >= quest.voting.minVotesToRank;

    const byVotes = visible
      .map((s) => ({ s, v: voteCount.get(s.id) ?? 0 }))
      .sort(
        (a, b) =>
          b.v - a.v ||
          (playerById.get(a.s.playerId)?.username ?? "").localeCompare(
            playerById.get(b.s.playerId)?.username ?? "",
          ),
      );

    const entries: ResultEntry[] = byVotes.slice(0, TOP_N).map(({ s, v }) => {
      // Standard competition rank: 1 + how many submissions have more votes.
      const rank = byVotes.filter((x) => x.v > v).length + 1;
      const p = playerById.get(s.playerId);
      const contributors = (s.contributorIds ?? [])
        .map((id) => playerById.get(id)?.username)
        .filter((n): n is string => !!n);
      return {
        submissionId: s.id,
        username: p?.username ?? "?",
        avatarUrl: p?.avatarUrl ?? null,
        bodyText: s.bodyText,
        mediaUrl: s.mediaUrl,
        kind: s.kind,
        votes: v,
        rank,
        contributors,
      };
    });

    results.push({ ...common, kind: "voted", type: quest.type, ranked, entries });
  }

  return results.sort((a, b) => a.order - b.order);
}
