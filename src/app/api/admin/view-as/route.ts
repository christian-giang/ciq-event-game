import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { isAdmin, setPlayerSession } from "@/lib/session";

const bodySchema = z.object({ playerId: z.uuid() });

/**
 * Logs the admin's browser into an existing player (real or simulated) so
 * they can see exactly what that player sees. The admin cookie stays set, so
 * /admin keeps working alongside it.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let playerId: string;
  try {
    playerId = bodySchema.parse(await req.json()).playerId;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) {
    return NextResponse.json({ error: "No such player." }, { status: 404 });
  }

  await setPlayerSession(player.id);
  return NextResponse.json({ ok: true, username: player.username });
}
