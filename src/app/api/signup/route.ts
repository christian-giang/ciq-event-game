import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { codePool, players, usernamePool } from "@/db/schema";
import { sendAccessCodeEmail } from "@/lib/email";
import { setPlayerSession } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  consent: z.literal(true),
});

/** Pops the next unused row from a pool table; safe under concurrency. */
async function popFromPool(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  table: "code_pool" | "username_pool",
  column: "code" | "username",
): Promise<string> {
  const result = await tx.execute(sql`
    UPDATE ${sql.identifier(table)} SET used = true
    WHERE position = (
      SELECT position FROM ${sql.identifier(table)}
      WHERE NOT used ORDER BY position
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING ${sql.identifier(column)}
  `);
  const value = result.rows[0]?.[column];
  if (typeof value !== "string") {
    throw new Error(`${table} exhausted — reseed with a larger pool`);
  }
  return value;
}

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid email address and accept the notice." },
      { status: 400 },
    );
  }

  const existing = await db.query.players.findFirst({
    where: eq(players.email, body.email),
  });

  if (existing) {
    // Never show the code on screen for a known email — anyone could type
    // someone else's address. The code goes to the inbox only.
    try {
      await sendAccessCodeEmail({
        to: existing.email,
        code: existing.accessCode,
        username: existing.username,
      });
    } catch (err) {
      console.error("resend-code email failed", err);
    }
    return NextResponse.json({ status: "existing" as const });
  }

  try {
    const player = await db.transaction(async (tx) => {
      const [code, username] = [
        await popFromPool(tx, "code_pool", "code"),
        await popFromPool(tx, "username_pool", "username"),
      ];
      const [row] = await tx
        .insert(players)
        .values({ email: body.email, username, accessCode: code })
        .returning();
      return row;
    });

    await setPlayerSession(player.id);

    // Backup channel; the response already carries the code.
    sendAccessCodeEmail({
      to: player.email,
      code: player.accessCode,
      username: player.username,
    }).catch((err) => console.error("signup email failed", err));

    return NextResponse.json({
      status: "new" as const,
      username: player.username,
      code: player.accessCode,
    });
  } catch (err) {
    // Unique-violation on email: two signups raced; behave like "existing".
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json({ status: "existing" as const });
    }
    throw err;
  }
}
