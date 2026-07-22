import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // The guest's chosen display name. NULL until they finish onboarding
  // (set it on the profile page). Still UNIQUE — two guests can't share a
  // name — but Postgres allows many NULLs, so pre-onboarding rows coexist.
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  // Zero-padded string, never an int: "042107" must stay 6 chars.
  accessCode: char("access_code", { length: 6 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isBlocked: boolean("is_blocked").notNull().default(false),
  // Players start inactive: they can sign up, set a profile and see the
  // schedule, but the quests/vote/board stay locked until a host activates
  // them. Lets you take signups before opening the game.
  isActivated: boolean("is_activated").notNull().default(false),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    kind: text("kind", { enum: ["photo", "video", "text"] }).notNull(),
    bodyText: text("body_text"),
    mediaUrl: text("media_url"),
    mediaKind: text("media_kind", { enum: ["photo", "video"] }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isHidden: boolean("is_hidden").notNull().default(false),
    // Other players credited on a group photo/video (uploader excluded). They
    // earn the same points as the uploader when the quest completes.
    contributorIds: jsonb("contributor_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    // Generated on the device; retries of the same submission upsert on it.
    clientUuid: uuid("client_uuid").notNull().unique(),
  },
  (t) => [
    uniqueIndex("submissions_player_quest_unique").on(t.playerId, t.questId),
    index("submissions_quest_idx").on(t.questId),
  ],
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    chosenOptionId: text("chosen_option_id").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clientUuid: uuid("client_uuid").notNull().unique(),
  },
  (t) => [
    // First answer counts: inserts do ON CONFLICT DO NOTHING on this.
    uniqueIndex("quiz_answers_player_quest_unique").on(t.playerId, t.questId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("votes_voter_submission_unique").on(t.voterId, t.submissionId),
    index("votes_submission_idx").on(t.submissionId),
  ],
);

/** Pre-generated shuffled pools; signup pops the next unused row. */
export const codePool = pgTable("code_pool", {
  position: integer("position").primaryKey(),
  code: char("code", { length: 6 }).notNull().unique(),
  used: boolean("used").notNull().default(false),
});

export const usernamePool = pgTable("username_pool", {
  position: integer("position").primaryKey(),
  username: text("username").notNull().unique(),
  used: boolean("used").notNull().default(false),
});

/**
 * Rate limiting lives in Postgres because Vercel functions share no memory.
 * ip is stored hashed — we don't need the raw address.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_attempts_ip_time_idx").on(t.ipHash, t.createdAt)],
);

/**
 * Runtime quest store. Each row's `data` holds a full Quest object
 * (validated by src/content/quests.schema.ts on every write and read).
 * src/content/quests.ts is the seed; the DB is the source of truth so
 * admins can create and edit quests from /admin.
 */
export const questsTable = pgTable("quests", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Single-row-ish key/value store; holds the freeze flag. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/**
 * Host-awarded bonus (or penalty) points, outside the quest system. One row
 * per player per award; rows from a single admin action share a batchId so an
 * award can be undone as a unit. Counts toward the OVERALL leaderboard only.
 */
export const bonusPoints = pgTable(
  "bonus_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bonus_points_batch_idx").on(t.batchId)],
);
