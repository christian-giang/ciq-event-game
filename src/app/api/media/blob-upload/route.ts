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
import { getPlayerId, isAdmin } from "@/lib/session";

/**
 * Vercel Blob client-upload handshake (STORAGE_DRIVER=vercel-blob only).
 * The browser's upload() calls this route once, to get a scoped, short-lived
 * client token (onBeforeGenerateToken — where we authorize the player). The
 * media bytes go browser → Blob directly and never touch this function.
 *
 * We deliberately do NOT pass onUploadCompleted: defining it makes the SDK
 * register a server→server completion webhook, and upload() then can't finish
 * until Blob calls that webhook back on this deployment. Behind Vercel
 * Deployment Protection (or on a protected preview URL) that callback is
 * blocked, so uploads hang near 100%. We don't need it — the submission and
 * avatar metadata endpoints record the returned URL once the client posts it.
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
        // Admins upload quest images; players upload submissions/avatars.
        let uploader = "admin";
        if (!(await isAdmin())) {
          const playerId = await getPlayerId();
          if (!playerId) throw new Error("Please log in again.");
          const player = await db.query.players.findFirst({
            where: eq(players.id, playerId),
          });
          if (!player || player.isBlocked) throw new Error("Not allowed.");
          uploader = playerId;
        }

        return {
          allowedContentTypes: Object.keys(EXT_BY_CONTENT_TYPE),
          maximumSizeInBytes: MEDIA_MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ uploader }),
        };
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
