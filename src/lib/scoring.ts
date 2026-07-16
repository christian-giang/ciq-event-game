import type { Quest } from "@/content/quests";

/**
 * Pure scoring engine — no DB access, unit-tested. Everything the evening's
 * fairness depends on lives here.
 */

export type PlayerId = string;

export type ScorableSubmission = {
  id: string;
  playerId: PlayerId;
  isHidden: boolean;
};

export type ScorableVote = {
  voterId: PlayerId;
  submissionId: string;
};

export type ScorableAnswer = {
  playerId: PlayerId;
  isCorrect: boolean;
};

export function scoreQuest(
  quest: Quest,
  submissions: ScorableSubmission[],
  votes: ScorableVote[],
  answers: ScorableAnswer[],
): Map<PlayerId, number> {
  switch (quest.type) {
    case "quiz": {
      const scores = new Map<PlayerId, number>();
      for (const a of answers) {
        scores.set(a.playerId, a.isCorrect ? quest.points : 0);
      }
      return scores;
    }

    case "media":
    case "text": {
      const { pointsByRank, participationPoints, minVotesToRank } =
        quest.voting;
      const scores = new Map<PlayerId, number>();

      // Hidden submissions vanish entirely: they earn nothing and their
      // votes stop counting.
      const visible = submissions.filter((s) => !s.isHidden);
      const visibleIds = new Set(visible.map((s) => s.id));
      const countedVotes = votes.filter((v) => visibleIds.has(v.submissionId));

      // Backup system: not enough votes on the quest → no ranking,
      // everyone who submitted gets participation points.
      if (countedVotes.length < minVotesToRank) {
        for (const s of visible) {
          scores.set(s.playerId, participationPoints);
        }
        return scores;
      }

      const voteCount = new Map<string, number>();
      for (const s of visible) voteCount.set(s.id, 0);
      for (const v of countedVotes) {
        voteCount.set(v.submissionId, (voteCount.get(v.submissionId) ?? 0) + 1);
      }

      // Standard competition ranking: ties share the higher rank (its
      // points), and the next rank is skipped. Rank index = number of
      // submissions with strictly more votes.
      const counts = [...voteCount.values()];
      for (const s of visible) {
        const own = voteCount.get(s.id) ?? 0;
        const rankIndex = counts.filter((c) => c > own).length;
        const ranked = pointsByRank[rankIndex] ?? participationPoints;
        // A submitter never scores below participation.
        scores.set(s.playerId, Math.max(ranked, participationPoints));
      }
      return scores;
    }

    default: {
      // Adding a 4th quest type must fail the build loudly.
      const exhausted: never = quest;
      throw new Error(`Unhandled quest type: ${JSON.stringify(exhausted)}`);
    }
  }
}
