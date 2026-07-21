import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { clearSimulation, seedSimulation } from "@/lib/simulation";

/** POST = populate simulated game data. DELETE = remove only simulated data. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const summary = await seedSimulation();
  return NextResponse.json({ ok: true, summary });
}

export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const summary = await clearSimulation();
  return NextResponse.json({ ok: true, summary });
}
