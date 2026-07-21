import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players } from "@/db/schema";
import { EXT_BY_CONTENT_TYPE, storageDriver } from "@/lib/media/server";
import { getPlayerId, isAdmin } from "@/lib/session";

const bodySchema = z.object({
  clientUuid: z.uuid(),
  contentType: z.string(),
});

/**
 * Step A of a media submission for the LOCAL driver only: tells the client
 * where to PUT the bytes (our own /api/media/upload endpoint).
 *
 * With STORAGE_DRIVER=vercel-blob the client never calls this — it uploads
 * straight to Blob via @vercel/blob/client, authorized by
 * /api/media/blob-upload.
 */
export async function POST(req: Request) {
  // Admins upload quest images; players upload submissions/avatars.
  if (!(await isAdmin())) {
    const playerId = await getPlayerId();
    if (!playerId) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 },
      );
    }
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });
    if (!player || player.isBlocked) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
  }
  // No freeze check here: this only authorizes a byte upload (used by both
  // submissions and profile avatars). The freeze is enforced where it
  // matters — the submission/vote/answer metadata endpoints — and avatar
  // edits stay allowed even after the game is frozen.

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const ext = EXT_BY_CONTENT_TYPE[body.contentType];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported media type: ${body.contentType}` },
      { status: 400 },
    );
  }

  if (storageDriver() === "local") {
    return NextResponse.json({
      driver: "local",
      url: `/api/media/upload?uuid=${body.clientUuid}&ext=${ext}`,
    });
  }

  // vercel-blob uploads bypass this endpoint entirely (see /api/media/blob-upload).
  return NextResponse.json(
    { error: "This driver uploads via /api/media/blob-upload." },
    { status: 400 },
  );
}
