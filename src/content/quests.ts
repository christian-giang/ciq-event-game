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

/** Default voting economy — tweak per quest if needed. */
const VOTING: VotingConfig = {
  pointsByRank: [12, 8, 5, 3],
  participationPoints: 2,
  minVotesToRank: 8,
  votesPerPlayer: 3,
};

export const quests: Quest[] = [
  // ——— Quizzes (fixed points, first answer counts) ———
  {
    id: "quiz-great-cook",
    order: 1,
    type: "quiz",
    title: "Who said it?",
    prompt:
      "Who said this — groom or bride? “One of the reasons I'm marrying you is because you're a great cook.”",
    options: [
      { id: "bride", label: "Teodora" },
      { id: "groom", label: "Uroš" },
    ],
    correctOptionId: "groom",
    points: 5,
    revealAfterAnswer: true,
    state: "released",
  },
  {
    id: "quiz-first-date",
    order: 2,
    type: "quiz",
    title: "The first date",
    prompt: "Where did Teodora and Uroš go on their first date?",
    options: [
      { id: "cinema", label: "The cinema" },
      { id: "lake", label: "A walk by the lake" },
      { id: "pizza", label: "A pizza place" },
      { id: "concert", label: "A concert" },
    ],
    correctOptionId: "pizza",
    points: 5,
    revealAfterAnswer: true,
    state: "released",
  },
  {
    id: "quiz-proposal",
    order: 3,
    type: "quiz",
    title: "The proposal",
    prompt: "How long did Uroš carry the ring around before proposing?",
    options: [
      { id: "days", label: "Three days" },
      { id: "weeks", label: "Two weeks" },
      { id: "months", label: "Four months" },
      { id: "year", label: "Over a year" },
    ],
    correctOptionId: "months",
    points: 5,
    revealAfterAnswer: true,
    state: "released",
  },
  {
    id: "quiz-pet-name",
    order: 4,
    type: "quiz",
    title: "Pet names",
    prompt: "What does Teodora call Uroš when nobody else is listening?",
    options: [
      { id: "bear", label: "Bear" },
      { id: "dumpling", label: "Dumpling" },
      { id: "captain", label: "Captain" },
      { id: "grandpa", label: "Grandpa" },
    ],
    correctOptionId: "bear",
    points: 5,
    revealAfterAnswer: true,
    state: "released",
  },
  {
    id: "quiz-honeymoon",
    order: 5,
    type: "quiz",
    title: "The honeymoon",
    prompt: "Where are the newlyweds heading for their honeymoon?",
    options: [
      { id: "japan", label: "Japan" },
      { id: "italy", label: "Italy" },
      { id: "iceland", label: "Iceland" },
      { id: "secret", label: "It's a secret even to one of them" },
    ],
    correctOptionId: "secret",
    points: 5,
    revealAfterAnswer: true,
    state: "released",
  },

  // ——— Text quests (voted) ———
  {
    id: "text-marriage-advice",
    order: 6,
    type: "text",
    title: "Marriage advice",
    prompt: "Give the couple your best marriage advice.",
    maxChars: 280,
    voting: VOTING,
    state: "released",
  },
  {
    id: "text-first-impression",
    order: 7,
    type: "text",
    title: "First impressions",
    prompt:
      "Describe your very first impression of Teodora or Uroš. Be honest — they can take it.",
    maxChars: 280,
    voting: VOTING,
    state: "released",
  },
  {
    id: "text-toast",
    order: 8,
    type: "text",
    title: "The one-line toast",
    prompt: "Write a toast to the couple in exactly one sentence.",
    maxChars: 200,
    voting: VOTING,
    state: "released",
  },
  {
    id: "text-prediction",
    order: 9,
    type: "text",
    title: "Predictions",
    prompt:
      "Predict something about Teodora & Uroš's life five years from now.",
    maxChars: 280,
    voting: VOTING,
    state: "released",
  },
  {
    id: "text-couple-name",
    order: 10,
    type: "text",
    title: "The couple name",
    prompt:
      "Every famous couple needs a combined name. What should we call these two?",
    maxChars: 60,
    voting: VOTING,
    state: "released",
  },

  // ——— Photo quests (voted) ———
  {
    id: "photo-table-selfie",
    order: 11,
    type: "media",
    mediaKind: "photo",
    title: "Table selfie",
    prompt:
      "Take a group selfie with everyone at your table. Everyone. Yes, also them.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "photo-detail",
    order: 12,
    type: "media",
    mediaKind: "photo",
    title: "The detail",
    prompt:
      "Photograph the most beautiful small detail you can find in this room tonight.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "photo-fancy-shoes",
    order: 13,
    type: "media",
    mediaKind: "photo",
    title: "Shoe contest",
    prompt: "Find and photograph the fanciest pair of shoes at the wedding.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "photo-generations",
    order: 14,
    type: "media",
    mediaKind: "photo",
    title: "Generations",
    prompt:
      "Take a photo that includes the youngest and the oldest guest you can find (ask nicely!).",
    voting: VOTING,
    state: "released",
  },
  {
    id: "photo-recreate",
    order: 15,
    type: "media",
    mediaKind: "photo",
    title: "The recreation",
    prompt:
      "Recreate a famous movie poster or album cover with the people at your table.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "photo-couple-moment",
    order: 16,
    type: "media",
    mediaKind: "photo",
    title: "Caught on camera",
    prompt:
      "Catch a candid moment of the newlyweds when they're not looking at any camera.",
    voting: VOTING,
    state: "released",
  },

  // ——— Video quests (voted) — keep these few: they cost real bandwidth ———
  {
    id: "video-birth-year-dance",
    order: 17,
    type: "media",
    mediaKind: "video",
    maxDurationSec: 15,
    title: "Dance like it's your birth year",
    prompt:
      "Show us a dance move from the year you were born. 15 seconds, video.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "video-impression",
    order: 18,
    type: "media",
    mediaKind: "video",
    maxDurationSec: 15,
    title: "The impression",
    prompt:
      "Do your best impression of the bride or the groom. 15 seconds max.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "video-message",
    order: 19,
    type: "media",
    mediaKind: "video",
    maxDurationSec: 15,
    title: "Message to the future",
    prompt:
      "Record a 15-second message for Teodora & Uroš to watch on their 10th anniversary.",
    voting: VOTING,
    state: "released",
  },
  {
    id: "video-talent",
    order: 20,
    type: "media",
    mediaKind: "video",
    maxDurationSec: 15,
    title: "Hidden talent",
    prompt: "Show us a hidden talent in 15 seconds or less.",
    voting: VOTING,
    state: "released",
  },
];
