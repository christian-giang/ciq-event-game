import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { isRateLimited, recordLoginAttempt, requestIp } from "@/lib/rate-limit";
import { setPlayerSession } from "@/lib/session";

// One uniform failure response for wrong code, blocked player and rate
// limit alike — never reveal which it was. Must be a fresh Response per
// request: a Response body can only be sent once.
function failure() {
  return NextResponse.json(
    { error: "That code didn't work. Check the six digits and try again." },
    { status: 401 },
  );
}

const bodySchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/)),
});

export async function POST(req: Request) {
  const ip = requestIp(req);

  if (await isRateLimited(ip)) {
    return failure();
  }

  let code: string;
  try {
    code = bodySchema.parse(await req.json()).code;
  } catch {
    await recordLoginAttempt(ip, false);
    return failure();
  }

  const player = await db.query.players.findFirst({
    where: and(eq(players.accessCode, code), eq(players.isBlocked, false)),
  });

  await recordLoginAttempt(ip, !!player);

  if (!player) {
    return failure();
  }

  await setPlayerSession(player.id);
  return NextResponse.json({ ok: true, username: player.username });
}
