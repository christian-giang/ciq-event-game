/**
 * Exports everything for the couple: all DB tables as JSON plus every media
 * file, zipped. Run this BEFORE teardown.
 * Run: npm run export  →  exports/wedding-game-export-<date>.zip
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { db } from "../src/db";
import {
  players,
  quizAnswers,
  submissions,
  votes,
} from "../src/db/schema";
import { quests } from "../src/content/quests";

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join("exports", `wedding-game-export-${stamp}`);
  mkdirSync(path.join(outDir, "data"), { recursive: true });

  const dump = {
    players: await db.select().from(players),
    submissions: await db.select().from(submissions),
    quizAnswers: await db.select().from(quizAnswers),
    votes: await db.select().from(votes),
    quests,
  };
  for (const [name, rows] of Object.entries(dump)) {
    writeFileSync(
      path.join(outDir, "data", `${name}.json`),
      JSON.stringify(rows, null, 2),
    );
    console.log(`data/${name}.json (${(rows as unknown[]).length} rows)`);
  }

  if ((process.env.STORAGE_DRIVER ?? "local") === "local") {
    if (existsSync(".uploads")) {
      cpSync(".uploads", path.join(outDir, "media"), { recursive: true });
      console.log("media/ copied from .uploads/");
    }
  } else {
    // Vercel Blob: download every media_url referenced in submissions.
    mkdirSync(path.join(outDir, "media"), { recursive: true });
    let n = 0;
    for (const s of dump.submissions) {
      if (!s.mediaUrl) continue;
      const res = await fetch(s.mediaUrl);
      if (!res.ok) {
        console.warn(`SKIP ${s.mediaUrl} (${res.status})`);
        continue;
      }
      const ext = path.extname(new URL(s.mediaUrl).pathname) || ".bin";
      writeFileSync(
        path.join(outDir, "media", `${s.clientUuid}${ext}`),
        Buffer.from(await res.arrayBuffer()),
      );
      n++;
    }
    console.log(`media/ downloaded ${n} blobs`);
  }

  execFileSync("zip", ["-rq", `${outDir}.zip`, outDir]);
  console.log(`\nExport complete: ${outDir}.zip`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
