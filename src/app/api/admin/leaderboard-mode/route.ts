import { NextResponse } from "next/server";
import { z } from "zod";
import { setLeaderboardMode } from "@/lib/settings";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({ mode: z.enum(["relative", "absolute"]) });

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  let mode: "relative" | "absolute";
  try {
    mode = bodySchema.parse(await req.json()).mode;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  await setLeaderboardMode(mode);
  return NextResponse.json({ ok: true, mode });
}
