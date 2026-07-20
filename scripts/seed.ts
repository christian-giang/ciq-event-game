/**
 * Seeds the code and username pools. Idempotent-ish: refuses to reseed a
 * pool that already has used entries (players would lose their codes).
 * Run: npm run seed
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { codePool, questsTable, usernamePool } from "../src/db/schema";
import { generateCodePool, cryptoShuffle } from "../src/lib/codes";
import { buildUsernameCombinations } from "../src/content/usernames";
import { quests } from "../src/content/quests";
import { validateQuests } from "../src/content/quests.schema";

const CODE_POOL_SIZE = 1000;

async function main() {
  validateQuests(quests);
  console.log(`Quest config OK (${quests.length} quests).`);

  // Quests: insert missing only — never clobber quests edited via /admin.
  const inserted = quests.length
    ? await db
        .insert(questsTable)
        .values(quests.map((q) => ({ id: q.id, data: q })))
        .onConflictDoNothing()
        .returning({ id: questsTable.id })
    : [];
  console.log(
    `Quests: ${inserted.length} inserted, ${quests.length - inserted.length} already in DB (kept).`,
  );

  // Pools are seeded once and then left alone — reseeding a pool with
  // handed-out codes would strand players.
  const [{ existingCodes }] = await db
    .select({ existingCodes: sql<number>`count(*)` })
    .from(codePool);
  if (Number(existingCodes) > 0) {
    console.log(`Code pool already seeded (${existingCodes} codes) — kept.`);
  } else {
    const codes = generateCodePool(CODE_POOL_SIZE);
    await db
      .insert(codePool)
      .values(codes.map((code, position) => ({ position, code })));
    console.log(`Seeded ${codes.length} access codes.`);
  }

  const [{ existingNames }] = await db
    .select({ existingNames: sql<number>`count(*)` })
    .from(usernamePool);
  if (Number(existingNames) > 0) {
    console.log(`Username pool already seeded (${existingNames}) — kept.`);
  } else {
    const names = cryptoShuffle(buildUsernameCombinations());
    await db
      .insert(usernamePool)
      .values(names.map((username, position) => ({ position, username })));
    console.log(`Seeded ${names.length} usernames.`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
