import type { Quest } from "./quests";

/**
 * A ready-made set of quests, loadable/removable from /admin. Images are added
 * per-quest in the editor after loading (they can't live in this file). Loading
 * only inserts quests that aren't already in the DB, so it never clobbers edits.
 */

const VOTING_PHOTO = {
  pointsByRank: [6, 4, 2],
  participationPoints: 1,
  minVotesToRank: 5,
  votesPerPlayer: 3,
};
const VOTING_VIDEO = {
  pointsByRank: [12, 8, 4],
  participationPoints: 2,
  minVotesToRank: 5,
  votesPerPlayer: 3,
};
const VOTING_WRITE = {
  pointsByRank: [3, 2, 1],
  participationPoints: 0,
  minVotesToRank: 5,
  votesPerPlayer: 3,
};

const opts = (labels: string[]) =>
  labels.map((label, i) => ({ id: "abcd"[i], label }));

export const questTemplate: Quest[] = [
  // ——— Quizzes (1 pt each) ———
  {
    id: "quiz-founding", order: 1, type: "quiz", state: "unreleased",
    title: "The beginning", prompt: "When was the start of Combat IQ?",
    options: opts(["2020", "2021", "2022", "2023"]), correctOptionId: "b",
    points: 1, revealAfterAnswer: true,
    resultText:
      "Tim and Chris started during the Covid pandemic in 2021. Here is one of their first meetings.",
  },
  {
    id: "quiz-headcount", order: 2, type: "quiz", state: "unreleased",
    title: "The team", prompt: "How many people are working with Combat IQ today?",
    options: opts(["17", "19", "21", "23"]), correctOptionId: "d",
    points: 1, revealAfterAnswer: true,
    resultText:
      "Tim, Chris, Max, Lucas, Cedric, Ole, Leticia, Donvicton, Gustavo, Henrique, Hugo, Jorge, Lucca, Luciano, Marco, Nicholas, Otavio, Pedro, Rafael, Ygor, Yuck, Christian (UCLA), Andrew (CMU).",
  },
  {
    id: "quiz-who-mclaren", order: 3, type: "quiz", state: "unreleased",
    title: "Who is this?", prompt: "Who is this?",
    options: opts([
      "The creator of the UFC",
      "Cedric's idol",
      "The CEO of Combate Global",
      "All of the above",
    ]),
    correctOptionId: "d", points: 1, revealAfterAnswer: true,
    resultText: "His name is Campbell McLaren.",
  },
  {
    id: "quiz-who-schmidhuber", order: 4, type: "quiz", state: "unreleased",
    title: "Who is this?", prompt: "Who is this?",
    options: opts([
      "The inventor of AI",
      "Cedric's idol",
      "A social media star",
      "All of the above",
    ]),
    correctOptionId: "d", points: 1, revealAfterAnswer: true,
    resultText:
      "His name is Jürgen Schmidhuber. While Jürgen was in Switzerland, Chris got introduced to him without knowing who he was — probably the worst person for this to happen.",
  },
  {
    id: "quiz-ufc-events", order: 5, type: "quiz", state: "unreleased",
    title: "On the big stage", prompt: "How many UFC events have we done so far?",
    options: opts(["18", "23", "29", "34"]), correctOptionId: "c",
    points: 1, revealAfterAnswer: true,
  },
  {
    id: "quiz-zbxg-rounds", order: 6, type: "quiz", state: "unreleased",
    title: "Rounds", prompt: "How many rounds are ZBXG fights?",
    options: opts(["6", "8", "12", "Too many"]), correctOptionId: "d",
    points: 1, revealAfterAnswer: true,
  },
  {
    id: "quiz-no-rep", order: 7, type: "quiz", state: "unreleased",
    title: "Around the world", prompt: "Where do we NOT have a representative?",
    options: opts(["United Kingdom", "Norway", "Switzerland", "Canada"]),
    correctOptionId: "a", points: 1, revealAfterAnswer: true,
    resultText:
      "Despite being a UK company, Combat IQ currently has no employees in the UK.",
  },
  {
    id: "quiz-maceio", order: 8, type: "quiz", state: "unreleased",
    title: "Maceió", prompt: "When did the first person from Maceió join us?",
    options: opts(["2021", "2022", "2023", "2025"]), correctOptionId: "a",
    points: 1, revealAfterAnswer: true,
    resultText: "Lucas was already there from the very early days!",
  },
  {
    id: "quiz-first-test", order: 9, type: "quiz", state: "unreleased",
    title: "First live test", prompt: "Who did we do our first live test with?",
    options: opts([
      "PFL",
      "Cage Warriors Academy",
      "Combate Global",
      "UFC",
    ]),
    correctOptionId: "b", points: 1, revealAfterAnswer: true,
    resultText:
      "Our first live test was with Cage Warriors Academy in Colchester in 2022.",
  },

  // ——— Write quests (voted) ———
  {
    id: "write-squad-name", order: 10, type: "text", state: "unreleased",
    group: true, title: "Squad name",
    prompt: "Choose a killer name for your CIQ Challenge squad.",
    maxChars: 60, voting: VOTING_WRITE,
  },
  {
    id: "write-three-words", order: 11, type: "text", state: "unreleased",
    title: "In three words", prompt: "Describe Combat IQ in three words.",
    maxChars: 60, voting: VOTING_WRITE,
  },
  {
    id: "write-newbie-advice", order: 12, type: "text", state: "unreleased",
    title: "New joiner advice",
    prompt: "Best advice for someone new joining the company.",
    maxChars: 280, voting: VOTING_WRITE,
  },
  {
    id: "write-2027-headline", order: 13, type: "text", state: "unreleased",
    title: "2027 headline",
    prompt: "Write a news headline for Combat IQ in 2027.",
    maxChars: 200, voting: VOTING_WRITE,
  },
  {
    id: "write-fav-moment", order: 14, type: "text", state: "unreleased",
    title: "Favourite moment", prompt: "Your favourite Combat IQ moment.",
    maxChars: 280, voting: VOTING_WRITE,
  },

  // ——— Photo quests (voted) ———
  {
    id: "photo-squad", order: 15, type: "media", mediaKind: "photo",
    state: "unreleased", group: true, title: "CIQ Squad",
    prompt:
      "Get your CIQ Challenge Squad together and make the most CIQ type of photo possible!",
    voting: VOTING_PHOTO,
  },
  {
    id: "photo-solution", order: 16, type: "media", mediaKind: "photo",
    state: "unreleased", group: true, title: "Final solution",
    prompt: "Take a picture of your final solution of the CIQ Challenge!",
    voting: VOTING_PHOTO,
  },
  {
    id: "photo-coolest", order: 17, type: "media", mediaKind: "photo",
    state: "unreleased", title: "Coolest thing",
    prompt: "Take a picture of the coolest thing you see today.",
    voting: VOTING_PHOTO,
  },

  // ——— Video quests (voted, 15s) ———
  {
    id: "video-sports-moment", order: 18, type: "media", mediaKind: "video",
    maxDurationSec: 15, state: "unreleased", group: true,
    title: "Sports moment", prompt: "Recreate a famous (combat) sports moment.",
    voting: VOTING_VIDEO,
  },
  {
    id: "video-trick-shot", order: 19, type: "media", mediaKind: "video",
    maxDurationSec: 15, state: "unreleased", group: true,
    title: "Trick shot", prompt: "Record an impressive trick shot.",
    voting: VOTING_VIDEO,
  },
];

export const questTemplateIds = questTemplate.map((q) => q.id);
