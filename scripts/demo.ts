/**
 * Loads a curated DEMO scenario for showing the couple:
 *  - a dozen fake guests
 *  - completed quizzes + voted quests → a populated leaderboard (all categories)
 *  - two quests open for voting → a populated /vote feed
 *  - several released quests → "open" quests to do
 * Generates placeholder photos into .uploads/ (local storage driver).
 *
 * Destructive: wipes players/submissions/votes/answers first (keeps pools).
 * Run: npm run demo
 */
import { randomInt, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  players,
  questsTable,
  quizAnswers,
  submissions,
  votes,
} from "../src/db/schema";
import { quests as seedQuests } from "../src/content/quests";
import { formatCode } from "../src/lib/codes";
import type { QuestState } from "../src/content/quests";

const GUESTS = [
  "Ana",
  "Marko",
  "Jelena",
  "Nikola",
  "Milica",
  "Stefan",
  "Ivana",
  "Luka",
  "Sofija",
  "Petar",
  "Maja",
  "Filip",
];

const STATE: Record<string, QuestState> = {
  // Completed → count on the leaderboard.
  "quiz-great-cook": "completed",
  "quiz-first-date": "completed",
  "text-marriage-advice": "completed",
  "text-first-impression": "completed",
  "photo-detail": "completed",
  "photo-fancy-shoes": "completed",
  // Open for voting → show in /vote.
  "text-toast": "voting",
  "photo-table-selfie": "voting",
  // everything else stays "released" (open to play)
};

const ADVICE = [
  "Never go to bed angry — but if you must, steal all the blankets.",
  "Marry your best friend, then keep dating them forever.",
  "Always say yes to dessert, and to each other.",
  "Laugh at the same joke for the 100th time like it's the first.",
  "Separate blankets, shared dreams. Trust me.",
  "Dance in the kitchen, even when there's no music.",
  "Keep no score — except of the good times.",
  "Choose each other, on purpose, every single day.",
];

const IMPRESSIONS = [
  "I thought Uroš was far too calm to keep up with Teodora. Happily wrong.",
  "Teodora walked in and the whole room got brighter. Still does.",
  "My first thought: these two bicker like they've been married 40 years. Adorable.",
  "I assumed they'd just met — turns out it was destiny all along.",
  "Uroš offered me his chair and his fries. Instant friend.",
  "I couldn't tell who was the bigger romantic. Still can't.",
];

const TOASTS = [
  "To a love as bold as Uroš's dance moves and as warm as Teodora's smile!",
  "May your life be full of pizza and short on arguments about the toppings.",
  "Here's to the only fight you'll never win: how much you love each other.",
  "To strong wifi and even stronger love. Cheers!",
  "To forever — and to whoever's brave enough to catch the bouquet.",
  "To the couple who make the rest of us believe in fairy tales.",
];

const PHOTO_CAPTIONS: Record<string, string[]> = {
  "photo-detail": [
    "the rings",
    "candlelight",
    "her bouquet",
    "the vows",
    "table nº4",
    "first light",
  ],
  "photo-fancy-shoes": [
    "golden heels",
    "polished brogues",
    "red soles",
    "dancing shoes",
    "tiny sneakers",
  ],
  "photo-table-selfie": [
    "Table one",
    "Table two",
    "Table three",
    "the cousins",
    "the college crew",
    "the loud table",
  ],
};

const GRADIENTS: [string, string][] = [
  ["#e98f84", "#f1aaa1"],
  ["#d5e0db", "#b8c9c0"],
  ["#efe4d9", "#dfd6cc"],
  ["#f1aaa1", "#e7c4b8"],
  ["#c9b7a3", "#efe4d9"],
  ["#b8c9c0", "#d5e0db"],
];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function demoPhoto(caption: string, i: number): Promise<Buffer> {
  const [c1, c2] = GRADIENTS[i % GRADIENTS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="1200" height="900" fill="url(#g)"/>
    <circle cx="600" cy="380" r="150" fill="#ffffff" fill-opacity="0.18"/>
    <text x="600" y="470" font-family="Georgia, serif" font-size="72" fill="#ffffff" text-anchor="middle">${caption}</text>
    <text x="600" y="545" font-family="Georgia, serif" font-size="30" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">demo photo</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

type Player = { id: string };
type Sub = { id: string; authorId: string };

async function demoAvatar(name: string, i: number): Promise<Buffer> {
  const [c1, c2] = GRADIENTS[i % GRADIENTS.length];
  const initial = name.trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <text x="200" y="255" font-family="Georgia, serif" font-size="200" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  console.log("Resetting game data (players, submissions, votes, answers)…");
  await db.execute(
    sql`TRUNCATE players, submissions, quiz_answers, votes CASCADE`,
  );

  // Ensure all quests exist, reset every state to released, then apply demo states.
  await db
    .insert(questsTable)
    .values(seedQuests.map((q) => ({ id: q.id, data: q })))
    .onConflictDoNothing();
  await db.execute(
    sql`UPDATE quests SET data = jsonb_set(data, '{state}', '"released"'::jsonb)`,
  );
  for (const [id, state] of Object.entries(STATE)) {
    await db.execute(
      sql`UPDATE quests SET data = jsonb_set(data, '{state}', to_jsonb(${state}::text), true) WHERE id = ${id}`,
    );
  }

  // Fake guests — real first names, and a generated avatar for every
  // other one (so the leaderboard shows a mix of pictures and initials).
  const uploadDirEarly = ".uploads";
  mkdirSync(uploadDirEarly, { recursive: true });
  const guestValues = [];
  for (let i = 0; i < GUESTS.length; i++) {
    const name = GUESTS[i];
    let avatarUrl: string | null = null;
    if (i % 2 === 0) {
      const uuid = randomUUID();
      writeFileSync(
        path.join(uploadDirEarly, `${uuid}.jpg`),
        await demoAvatar(name, i),
      );
      avatarUrl = `/api/media/file/${uuid}.jpg`;
    }
    guestValues.push({
      email: `${name.toLowerCase()}@demo.local`,
      username: name,
      avatarUrl,
      accessCode: formatCode(randomInt(0, 1_000_000)),
    });
  }
  const guestRows = await db.insert(players).values(guestValues).returning();
  const P: Player[] = guestRows;
  console.log(`Created ${P.length} fake guests.`);

  // --- quiz answers on the two completed quizzes ---
  const quizzes = [
    { id: "quiz-great-cook", correct: "groom", wrong: "bride" },
    { id: "quiz-first-date", correct: "pizza", wrong: "cinema" },
  ];
  const answerRows: (typeof quizAnswers.$inferInsert)[] = [];
  P.forEach((player, idx) => {
    for (const quiz of quizzes) {
      // Top guests answer correctly more often — gives the board a spread.
      const correct = randomInt(0, 100) < 80 - idx * 5;
      const chosen = correct ? quiz.correct : quiz.wrong;
      answerRows.push({
        playerId: player.id,
        questId: quiz.id,
        chosenOptionId: chosen,
        isCorrect: correct,
        clientUuid: randomUUID(),
      });
    }
  });
  await db.insert(quizAnswers).values(answerRows);
  console.log(`Added ${answerRows.length} quiz answers.`);

  // --- text submissions ---
  async function insertText(
    questId: string,
    authors: Player[],
    texts: string[],
  ): Promise<Sub[]> {
    const specs = authors.map((a, i) => ({
      authorId: a.id,
      clientUuid: randomUUID(),
      bodyText: texts[i],
    }));
    const rows = await db
      .insert(submissions)
      .values(
        specs.map((s) => ({
          playerId: s.authorId,
          questId,
          kind: "text" as const,
          bodyText: s.bodyText,
          clientUuid: s.clientUuid,
        })),
      )
      .returning();
    const byUuid = new Map(rows.map((r) => [r.clientUuid, r.id]));
    return specs.map((s) => ({ id: byUuid.get(s.clientUuid)!, authorId: s.authorId }));
  }

  // --- photo submissions (write placeholder files, reference by URL) ---
  const uploadDir = ".uploads";
  mkdirSync(uploadDir, { recursive: true });
  let photoCounter = 0;
  async function insertPhotos(
    questId: string,
    authors: Player[],
  ): Promise<Sub[]> {
    const captions = PHOTO_CAPTIONS[questId];
    const specs: {
      authorId: string;
      clientUuid: string;
      mediaUrl: string;
    }[] = [];
    for (let i = 0; i < authors.length; i++) {
      const uuid = randomUUID();
      const buf = await demoPhoto(captions[i] ?? "photo", photoCounter++);
      writeFileSync(path.join(uploadDir, `${uuid}.jpg`), buf);
      specs.push({
        authorId: authors[i].id,
        clientUuid: uuid,
        mediaUrl: `/api/media/file/${uuid}.jpg`,
      });
    }
    const rows = await db
      .insert(submissions)
      .values(
        specs.map((s) => ({
          playerId: s.authorId,
          questId,
          kind: "photo" as const,
          mediaUrl: s.mediaUrl,
          mediaKind: "photo" as const,
          clientUuid: s.clientUuid,
        })),
      )
      .returning();
    const byUuid = new Map(rows.map((r) => [r.clientUuid, r.id]));
    return specs.map((s) => ({ id: byUuid.get(s.clientUuid)!, authorId: s.authorId }));
  }

  const adviceSubs = await insertText(
    "text-marriage-advice",
    P.slice(0, 8),
    ADVICE,
  );
  const impressionSubs = await insertText(
    "text-first-impression",
    P.slice(4, 10),
    IMPRESSIONS,
  );
  const toastSubs = await insertText("text-toast", P.slice(0, 6), TOASTS);
  const detailSubs = await insertPhotos("photo-detail", P.slice(0, 6));
  const shoeSubs = await insertPhotos("photo-fancy-shoes", P.slice(6, 11));
  const selfieSubs = await insertPhotos("photo-table-selfie", P.slice(3, 9));

  const subCount =
    adviceSubs.length +
    impressionSubs.length +
    toastSubs.length +
    detailSubs.length +
    shoeSubs.length +
    selfieSubs.length;
  console.log(`Added ${subCount} submissions (text + photo).`);

  // --- votes (respect no-self-vote, ≤3 per voter per quest, unique) ---
  function buildVotes(
    subs: Sub[],
    targets: number[],
  ): (typeof votes.$inferInsert)[] {
    const used = new Map<string, number>();
    const rows: (typeof votes.$inferInsert)[] = [];
    subs.forEach((sub, i) => {
      const target = targets[i] ?? 0;
      const eligible = shuffle(P.filter((p) => p.id !== sub.authorId));
      let given = 0;
      for (const voter of eligible) {
        if (given >= target) break;
        if ((used.get(voter.id) ?? 0) >= 3) continue;
        rows.push({ voterId: voter.id, submissionId: sub.id });
        used.set(voter.id, (used.get(voter.id) ?? 0) + 1);
        given++;
      }
    });
    return rows;
  }

  const voteRows = [
    ...buildVotes(adviceSubs, [5, 4, 3, 3, 2, 1, 1, 0]),
    ...buildVotes(impressionSubs, [5, 4, 3, 2, 1, 0]),
    ...buildVotes(detailSubs, [5, 4, 3, 2, 1, 0]),
    ...buildVotes(shoeSubs, [5, 4, 3, 2, 1]),
    // Voting-open quests: seed some activity so completing them mid-demo
    // immediately shows a ranked result.
    ...buildVotes(toastSubs, [4, 3, 2, 2, 1, 0]),
    ...buildVotes(selfieSubs, [4, 3, 3, 2, 1, 0]),
  ];
  await db.insert(votes).values(voteRows);
  console.log(`Added ${voteRows.length} votes.`);

  console.log("\n--- Quest states ---");
  const stateRows = await db.execute<{ id: string; state: string; type: string }>(
    sql`SELECT id, data->>'state' AS state, data->>'type' AS type FROM quests ORDER BY (data->>'order')::int`,
  );
  const byState: Record<string, string[]> = {};
  for (const r of stateRows.rows) {
    (byState[r.state] ??= []).push(`${r.id} (${r.type})`);
  }
  for (const [state, ids] of Object.entries(byState)) {
    console.log(`  ${state}: ${ids.length}`);
    ids.forEach((i) => console.log(`      - ${i}`));
  }

  console.log("\n--- Fake guest access codes (hand one to the couple) ---");
  guestRows.forEach((g) => console.log(`  ${g.username}: ${g.accessCode}`));

  console.log(
    "\nDemo ready. Log in with a code above, or use /admin → Open as player.",
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
