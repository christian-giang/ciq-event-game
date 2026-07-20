import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/db";
import { players } from "@/db/schema";
import {
  EXT_BY_CONTENT_TYPE,
  MEDIA_MAX_BYTES,
  storageDriver,
} from "@/lib/media/server";
import { getPlayerId } from "@/lib/session";

/**
 * Vercel Blob client-upload handshake (STORAGE_DRIVER=vercel-blob only).
 * The browser's upload() calls this route twice: once to get a scoped,
 * short-lived client token (onBeforeGenerateToken — where we authorize the
 * player), and once as the upload-completed callback. The media bytes go
 * browser → Blob directly and never touch this function.
 *
 * No freeze check here: this only authorizes a byte upload (used by both
 * submissions and profile avatars). The freeze is enforced on the metadata
 * endpoints (submissions/votes/answers), and avatar edits stay allowed even
 * after the game is frozen.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (storageDriver() !== "vercel-blob") {
    return NextResponse.json({ error: "Wrong driver." }, { status: 400 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => {
        const playerId = await getPlayerId();
        if (!playerId) throw new Error("Please log in again.");
        const player = await db.query.players.findFirst({
          where: eq(players.id, playerId),
        });
        if (!player || player.isBlocked) throw new Error("Not allowed.");

        return {
          allowedContentTypes: Object.keys(EXT_BY_CONTENT_TYPE),
          maximumSizeInBytes: MEDIA_MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ playerId }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do: the submission/profile metadata endpoints record the
        // returned URL once the client finishes and posts it.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    // Thrown from onBeforeGenerateToken (auth) or a malformed handshake.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload not authorized." },
      { status: 400 },
    );
  }
}
