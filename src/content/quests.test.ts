import { describe, expect, it } from "vitest";
import { quests, VOTING } from "./quests";
import { validateQuests } from "./quests.schema";
import type { Quest } from "./quests";

// Inline fixtures so these tests keep exercising the validator even while the
// live `quests` array is empty (quests for this event are authored later).
const quizFixture: Quest = {
  id: "quiz-fixture",
  order: 1,
  type: "quiz",
  title: "Sample quiz",
  prompt: "Pick the right one.",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  correctOptionId: "a",
  points: 5,
  revealAfterAnswer: true,
  state: "released",
};

const textFixture: Quest = {
  id: "text-fixture",
  order: 2,
  type: "text",
  title: "Sample text",
  prompt: "Write something.",
  maxChars: 280,
  voting: VOTING,
  state: "released",
};

describe("quest config", () => {
  it("the live config is valid", () => {
    expect(() => validateQuests(quests)).not.toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() => validateQuests([quizFixture, quizFixture])).toThrow(
      /Invalid quest config/,
    );
  });

  it("rejects a quiz whose correctOptionId is not among its options", () => {
    const broken: Quest = { ...quizFixture, correctOptionId: "nope" };
    expect(() => validateQuests([broken])).toThrow(/Invalid quest config/);
  });

  it("rejects non-descending pointsByRank", () => {
    const broken: Quest = {
      ...textFixture,
      voting: { ...textFixture.voting, pointsByRank: [5, 8, 3] },
    };
    expect(() => validateQuests([broken])).toThrow(/descending/);
  });

  it("keeps video quests scarce (bandwidth budget: max 5)", () => {
    const videoQuests = quests.filter(
      (q) =>
        q.state !== "unreleased" &&
        q.type === "media" &&
        (q.mediaKind === "video" || q.mediaKind === "either"),
    );
    expect(videoQuests.length).toBeLessThanOrEqual(5);
  });

  it("every video-capable quest has a duration cap ≤ 15s", () => {
    for (const q of quests) {
      if (q.type === "media" && q.mediaKind !== "photo") {
        expect(q.maxDurationSec, `${q.id} needs maxDurationSec`).toBeDefined();
        expect(q.maxDurationSec!).toBeLessThanOrEqual(15);
      }
    }
  });
});
