import { describe, expect, it } from "vitest";
import { scoreQuest } from "./scoring";
import type { Quest, TextQuest, QuizQuest } from "@/content/quests";

const quiz: QuizQuest = {
  id: "q1",
  order: 1,
  type: "quiz",
  title: "t",
  prompt: "p",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  correctOptionId: "a",
  points: 5,
  revealAfterAnswer: true,
  state: "completed",
};

const text: TextQuest = {
  id: "t1",
  order: 2,
  type: "text",
  title: "t",
  prompt: "p",
  maxChars: 280,
  voting: {
    pointsByRank: [12, 8, 5, 3],
    participationPoints: 2,
    minVotesToRank: 8,
    votesPerPlayer: 3,
  },
  state: "completed",
};

function sub(
  id: string,
  playerId: string,
  isHidden = false,
  contributorIds: string[] = [],
) {
  return { id, playerId, isHidden, contributorIds };
}

/** n votes for a submission from distinct synthetic voters. */
function votesFor(submissionId: string, n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    voterId: `voter-${submissionId}-${i + offset}`,
    submissionId,
  }));
}

describe("scoreQuest — quiz", () => {
  it("awards fixed points for correct, zero for wrong", () => {
    const scores = scoreQuest(quiz, [], [], [
      { playerId: "p1", isCorrect: true },
      { playerId: "p2", isCorrect: false },
    ]);
    expect(scores.get("p1")).toBe(5);
    expect(scores.get("p2")).toBe(0);
  });
});

describe("scoreQuest — voted quests", () => {
  it("backup path: below minVotesToRank everyone gets participation points", () => {
    const subs = [sub("s1", "p1"), sub("s2", "p2"), sub("s3", "p3")];
    // 3 total votes < minVotesToRank 8
    const votes = [...votesFor("s1", 2), ...votesFor("s2", 1)];
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p1")).toBe(2);
    expect(scores.get("p2")).toBe(2);
    expect(scores.get("p3")).toBe(2);
  });

  it("ranks by votes with pointsByRank once threshold is met", () => {
    const subs = [sub("s1", "p1"), sub("s2", "p2"), sub("s3", "p3")];
    const votes = [
      ...votesFor("s1", 5),
      ...votesFor("s2", 3),
      ...votesFor("s3", 1),
    ]; // 9 total ≥ 8
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p2")).toBe(8);
    expect(scores.get("p3")).toBe(5);
  });

  it("tied first place: both get pointsByRank[0], next gets pointsByRank[2]", () => {
    const subs = [sub("s1", "p1"), sub("s2", "p2"), sub("s3", "p3")];
    const votes = [
      ...votesFor("s1", 4),
      ...votesFor("s2", 4),
      ...votesFor("s3", 1),
    ]; // 9 total ≥ 8
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p2")).toBe(12);
    expect(scores.get("p3")).toBe(5); // rank index 2 → pointsByRank[2]
  });

  it("past the end of pointsByRank falls back to participation points", () => {
    const subs = [
      sub("s1", "p1"),
      sub("s2", "p2"),
      sub("s3", "p3"),
      sub("s4", "p4"),
      sub("s5", "p5"),
    ];
    const votes = [
      ...votesFor("s1", 5),
      ...votesFor("s2", 4),
      ...votesFor("s3", 3),
      ...votesFor("s4", 2),
      ...votesFor("s5", 1),
    ]; // 15 total
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p4")).toBe(3); // pointsByRank[3]
    expect(scores.get("p5")).toBe(2); // past the array → participation
  });

  it("zero-vote submissions still take their positional rank (spec: rank i gets pointsByRank[i])", () => {
    const subs = [sub("s1", "p1"), sub("s2", "p2")];
    const votes = votesFor("s1", 9); // s2 has zero votes, threshold met
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p2")).toBe(8); // second position → pointsByRank[1]
  });

  it("a rank award below participation points is floored to participation", () => {
    const stingy: TextQuest = {
      ...text,
      voting: { ...text.voting, pointsByRank: [12, 1] },
    };
    const subs = [sub("s1", "p1"), sub("s2", "p2")];
    const votes = [...votesFor("s1", 6), ...votesFor("s2", 3)];
    const scores = scoreQuest(stingy, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p2")).toBe(2); // pointsByRank[1]=1 floored to 2
  });

  it("hidden submissions earn nothing and their votes stop counting", () => {
    const subs = [sub("s1", "p1", true), sub("s2", "p2"), sub("s3", "p3")];
    // 6 votes on hidden s1 don't count → 3 counted < 8 → backup path
    const votes = [
      ...votesFor("s1", 6),
      ...votesFor("s2", 2),
      ...votesFor("s3", 1),
    ];
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.has("p1")).toBe(false);
    expect(scores.get("p2")).toBe(2);
    expect(scores.get("p3")).toBe(2);
  });

  it("credits co-contributors with the submission's points", () => {
    const subs = [
      sub("s1", "p1", false, ["p1b", "p1c"]),
      sub("s2", "p2"),
      sub("s3", "p3"),
    ];
    const votes = [
      ...votesFor("s1", 5),
      ...votesFor("s2", 3),
      ...votesFor("s3", 1),
    ];
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p1b")).toBe(12);
    expect(scores.get("p1c")).toBe(12);
    expect(scores.get("p2")).toBe(8);
  });

  it("a player credited on two submissions keeps the best", () => {
    const subs = [
      sub("s1", "p1", false, ["shared"]),
      sub("s2", "p2", false, ["shared"]),
      sub("s3", "p3"),
    ];
    const votes = [
      ...votesFor("s1", 5),
      ...votesFor("s2", 3),
      ...votesFor("s3", 1),
    ];
    const scores = scoreQuest(text, subs, votes, []);
    expect(scores.get("shared")).toBe(12); // max(12 from s1, 8 from s2)
  });

  it("media quests score identically to text quests", () => {
    const media: Quest = {
      id: "m1",
      order: 3,
      type: "media",
      mediaKind: "photo",
      title: "t",
      prompt: "p",
      voting: text.voting,
      state: "completed",
    };
    const subs = [sub("s1", "p1"), sub("s2", "p2")];
    const votes = [...votesFor("s1", 6), ...votesFor("s2", 3)];
    const scores = scoreQuest(media, subs, votes, []);
    expect(scores.get("p1")).toBe(12);
    expect(scores.get("p2")).toBe(8);
  });
});
