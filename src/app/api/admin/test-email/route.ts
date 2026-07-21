import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTestEmail } from "@/lib/email";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  to: z.string().trim().pipe(z.email()),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let to: string;
  try {
    to = bodySchema.parse(await req.json()).to;
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  // Always 200 — the result object carries success/failure detail for display.
  const result = await sendTestEmail(to);
  return NextResponse.json(result);
}
