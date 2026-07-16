import { NextResponse } from "next/server";
import { z } from "zod";
import { setFrozen } from "@/lib/settings";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({ frozen: z.boolean() });

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let frozen: boolean;
  try {
    frozen = bodySchema.parse(await req.json()).frozen;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  await setFrozen(frozen);
  return NextResponse.json({ ok: true, frozen });
}
