import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { isAdmin } from "@/lib/session";

const bodySchema = z.object({
  submissionId: z.uuid(),
  isHidden: z.boolean(),
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

  // Hidden submissions vanish from the vote feed and their votes stop
  // counting — scoring filters on is_hidden.
  const [updated] = await db
    .update(submissions)
    .set({ isHidden: body.isHidden })
    .where(eq(submissions.id, body.submissionId))
    .returning({ id: submissions.id });

  if (!updated) {
    return NextResponse.json({ error: "No such submission." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
