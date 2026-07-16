import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  playerId: z.uuid(),
  isBlocked: z.boolean(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const [updated] = await db
    .update(players)
    .set({ isBlocked: body.isBlocked })
    .where(eq(players.id, body.playerId))
    .returning({ id: players.id });

  if (!updated) {
    return NextResponse.json({ error: "No such player." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
