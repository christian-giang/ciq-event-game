import { z } from "zod";
import type { Quest } from "./quests";

const votingSchema = z.object({
  pointsByRank: z
    .array(z.number().int().positive())
    .nonempty()
    .refine(
      (ranks) => ranks.every((p, i) => i === 0 || p < ranks[i - 1]),
      "pointsByRank must be strictly descending",
    ),
  participationPoints: z.number().int().nonnegative(),
  minVotesToRank: z.number().int().positive(),
  votesPerPlayer: z.number().int().positive(),
});

const baseShape = {
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  state: z.enum(["unreleased", "released", "voting", "completed"]),
  // Optional media URLs (local /api/media/file/… in dev, Blob URL in prod) —
  // a loose string, not .url(), so relative local URLs validate too.
  imageUrl: z.string().min(1).optional(),
  resultImageUrl: z.string().min(1).optional(),
  resultText: z.string().min(1).max(2000).optional(),
};

const mediaQuestSchema = z.object({
  ...baseShape,
  type: z.literal("media"),
  mediaKind: z.enum(["photo", "video", "either"]),
  maxDurationSec: z.number().int().positive().max(60).optional(),
  voting: votingSchema,
});

const quizQuestSchema = z
  .object({
    ...baseShape,
    type: z.literal("quiz"),
    options: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
      .min(2)
      .refine(
        (opts) => new Set(opts.map((o) => o.id)).size === opts.length,
        "option ids must be unique",
      ),
    correctOptionId: z.string().min(1),
    points: z.number().int().positive(),
    revealAfterAnswer: z.boolean(),
  })
  .refine(
    (q) => q.options.some((o) => o.id === q.correctOptionId),
    "correctOptionId must exist in options",
  );

const textQuestSchema = z.object({
  ...baseShape,
  type: z.literal("text"),
  maxChars: z.number().int().positive().max(2000),
  voting: votingSchema,
});

export const questSchema = z.discriminatedUnion("type", [
  mediaQuestSchema,
  quizQuestSchema,
  textQuestSchema,
]);

export const questsSchema = z
  .array(questSchema)
  .refine(
    (qs) => new Set(qs.map((q) => q.id)).size === qs.length,
    "quest ids must be unique",
  )
  .refine(
    (qs) => new Set(qs.map((q) => q.order)).size === qs.length,
    "quest orders must be unique",
  );

/** Throws (with a readable message) if the config is invalid. */
export function validateQuests(qs: Quest[]): void {
  const result = questsSchema.safeParse(qs);
  if (!result.success) {
    throw new Error(`Invalid quest config:\n${result.error.message}`);
  }
}
