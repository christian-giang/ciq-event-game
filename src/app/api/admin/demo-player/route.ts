import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { generateCodePool } from "@/lib/codes";
import { isAdmin, setPlayerSession } from "@/lib/session";

const DEMO_EMAIL = "demo@admin.local";
const DEMO_USERNAME = "demo-player";

/**
 * Logs the admin's browser into a dedicated demo player (creating it on
 * first use) so they can experience exactly what guests see. The admin
 * cookie stays alongside — /admin keeps working in the same browser.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let demo = await db.query.players.findFirst({
    where: eq(players.email, DEMO_EMAIL),
  });

  if (!demo) {
    // The demo player takes a random code but deliberately NOT from the
    // pool, and a fixed username not in the color-animal format.
    for (let attempt = 0; attempt < 5 && !demo; attempt++) {
      try {
        [demo] = await db
          .insert(players)
          .values({
            email: DEMO_EMAIL,
            username: DEMO_USERNAME,
            accessCode: generateCodePool(1)[0],
          })
          .returning();
      } catch (err) {
        // Retry only on access-code collision with a pool code.
        const pgCode = (err as { code?: string }).code;
        if (pgCode !== "23505") throw err;
        const existing = await db.query.players.findFirst({
          where: eq(players.email, DEMO_EMAIL),
        });
        if (existing) demo = existing;
      }
    }
    if (!demo) {
      return NextResponse.json(
        { error: "Could not create the demo player — try again." },
        { status: 500 },
      );
    }
  }

  if (demo.isBlocked) {
    await db
      .update(players)
      .set({ isBlocked: false })
      .where(eq(players.id, demo.id));
  }

  await setPlayerSession(demo.id);
  return NextResponse.json({ ok: true, username: demo.username });
}
