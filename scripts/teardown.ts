/**
 * Wipes everything: all DB rows (players, submissions, votes, answers,
 * pools, attempts) and all stored media. The privacy promise is that this
 * runs no later than 30 days after the wedding. EXPORT FIRST.
 *
 * Run: npm run teardown -- --yes-delete-everything
 */
import { rmSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  if (!process.argv.includes("--yes-delete-everything")) {
    console.error(
      "Refusing to run without --yes-delete-everything.\n" +
        "This wipes the database and all media. Run the export first:\n" +
        "  npm run export\n" +
        "  npm run teardown -- --yes-delete-everything",
    );
    process.exit(1);
  }

  await db.execute(sql`
    TRUNCATE players, submissions, quiz_answers, votes, bonus_points,
             quests, code_pool, username_pool, login_attempts, settings
    CASCADE
  `);
  console.log("Database wiped.");

  if ((process.env.STORAGE_DRIVER ?? "local") === "local") {
    rmSync(".uploads", { recursive: true, force: true });
    console.log(".uploads/ removed.");
  } else {
    const { list, del } = await import("@vercel/blob");
    let cursor: string | undefined;
    let n = 0;
    do {
      const page = await list({ cursor, limit: 1000 });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((b) => b.url));
        n += page.blobs.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    console.log(`Deleted ${n} blobs from Vercel Blob.`);
  }

  console.log("\nTeardown complete. Thank the guests, delete the deploys.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
