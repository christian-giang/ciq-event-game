/**
 * THE quest config. Adding, editing, reordering or deactivating a quest
 * happens here and nowhere else — the app derives routing, UI and scoring
 * from this array. Validated by src/content/quests.schema.ts (run in tests
 * and at build).
 */

export type QuestId = string;

export type VotingConfig = {
  /** Points by finishing rank. Index 0 = 1st place. */
  pointsByRank: number[];
  /** Awarded to every valid submitter who doesn't place, and to
   *  everyone if the quest fails to reach minVotesToRank. */
  participationPoints: number;
  /** Below this many total votes on the quest, ranking is abandoned
   *  and everyone gets participationPoints. This is the backup system. */
  minVotesToRank: number;
  /** How many submissions one player may upvote in this quest. */
  votesPerPlayer: number;
};

/**
 * Lifecycle: unreleased (invisible) → released (submittable) → voting
 * (submissions locked, in /vote) → completed (locked; NOW counts toward
 * the leaderboard). Quizzes skip 'voting'.
 */
export type QuestState = "unreleased" | "released" | "voting" | "completed";

export type QuestBase = {
  id: QuestId;
  order: number;
  title: string;
  prompt: string;
  state: QuestState;
  /** Optional picture shown with the question/prompt. */
  imageUrl?: string;
  /** Optional picture shown with the result (on the Results board). */
  resultImageUrl?: string;
  /** Optional text revealed with the result (on the Results board). */
  resultText?: string;
  /** Group task: one person submits and tags teammates; all are credited. */
  group?: boolean;
};

export type MediaQuest = QuestBase & {
  type: "media";
  mediaKind: "photo" | "video" | "either";
  maxDurationSec?: number;
  voting: VotingConfig;
};

export type QuizQuest = QuestBase & {
  type: "quiz";
  options: { id: string; label: string }[];
  correctOptionId: string;
  points: number;
  revealAfterAnswer: boolean;
};

export type TextQuest = QuestBase & {
  type: "text";
  maxChars: number;
  voting: VotingConfig;
};

export type Quest = MediaQuest | QuizQuest | TextQuest;

/** Default voting economy — tweak per quest if needed. Exported so quest
 *  definitions below can reuse it. */
export const VOTING: VotingConfig = {
  pointsByRank: [12, 8, 5, 3],
  participationPoints: 2,
  minVotesToRank: 8,
  votesPerPlayer: 3,
};

/**
 * Quests for the Combat IQ team event — TO BE AUTHORED.
 *
 * The previous (wedding) quests were cleared for this dry run. Add the real
 * quests here; routing, UI and scoring derive from this array. Each quest is
 * a "quiz", "text" or "media" entry — see the shapes above. Give every quest
 * a unique `id` and a unique `order`. Reuse the exported `VOTING` config for
 * voted (text/media) quests, e.g.:
 *
 *   {
 *     id: "quiz-example",
 *     order: 1,
 *     type: "quiz",
 *     title: "Sample question",
 *     prompt: "What's the answer?",
 *     options: [
 *       { id: "a", label: "First option" },
 *       { id: "b", label: "Second option" },
 *     ],
 *     correctOptionId: "a",
 *     points: 5,
 *     revealAfterAnswer: true,
 *     state: "released",
 *   },
 *   {
 *     id: "text-example",
 *     order: 2,
 *     type: "text",
 *     title: "Sample prompt",
 *     prompt: "Write something.",
 *     maxChars: 280,
 *     voting: VOTING,
 *     state: "released",
 *   },
 */
export const quests: Quest[] = [];
