import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getCurrentPlayer } from "@/lib/auth";
import { isOurMediaUrl } from "@/lib/media/server";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(40),
  // Present = set/keep it; null = remove the picture; omitted = leave as-is.
  avatarUrl: z.string().min(1).nullable().optional(),
});

/** Save the guest's display name + optional avatar. Names are unique. */
export async function POST(req: Request) {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Please enter a name (up to 40 characters)." },
      { status: 400 },
    );
  }

  // Case-insensitive uniqueness against everyone else.
  const clash = await db.query.players.findFirst({
    where: and(
      ne(players.id, player.id),
      sql`lower(${players.username}) = ${body.name.toLowerCase()}`,
    ),
  });
  if (clash) {
    return NextResponse.json(
      { error: "That name is already taken — try another." },
      { status: 409 },
    );
  }

  const update: Partial<typeof players.$inferInsert> = { username: body.name };
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl !== null && !isOurMediaUrl(body.avatarUrl)) {
      return NextResponse.json({ error: "Bad picture URL." }, { status: 400 });
    }
    update.avatarUrl = body.avatarUrl;
  }

  try {
    await db.update(players).set(update).where(eq(players.id, player.id));
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "That name is already taken — try another." },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, name: body.name });
}
