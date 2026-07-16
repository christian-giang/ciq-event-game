import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { upsertQuest } from "@/lib/quests";
import { isAdmin } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let candidate: unknown;
  try {
    candidate = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const quest = await upsertQuest(candidate);
    return NextResponse.json({ ok: true, quest });
  } catch (err) {
    const message =
      err instanceof ZodError
        ? err.issues
            .map((i) => `${i.path.join(".") || "quest"}: ${i.message}`)
            .join("; ")
        : err instanceof Error
          ? err.message
          : "Invalid quest.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
