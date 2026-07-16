import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import { validateQuests } from "./quests.schema";
import type { Quest } from "./quests";

describe("quest config", () => {
  it("is valid", () => {
    expect(() => validateQuests(quests)).not.toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() => validateQuests([quests[0], quests[0]])).toThrow(
      /Invalid quest config/,
    );
  });

  it("rejects a quiz whose correctOptionId is not among its options", () => {
    const quiz = quests.find((q) => q.type === "quiz");
    if (!quiz || quiz.type !== "quiz") throw new Error("no quiz in config");
    const broken: Quest = { ...quiz, correctOptionId: "nope" };
    expect(() => validateQuests([broken])).toThrow(/Invalid quest config/);
  });

  it("rejects non-descending pointsByRank", () => {
    const text = quests.find((q) => q.type === "text");
    if (!text || text.type !== "text") throw new Error("no text in config");
    const broken: Quest = {
      ...text,
      voting: { ...text.voting, pointsByRank: [5, 8, 3] },
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
