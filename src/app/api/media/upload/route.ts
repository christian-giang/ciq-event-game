import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { players } from "@/db/schema";
import {
  CONTENT_TYPE_BY_EXT,
  MEDIA_MAX_BYTES,
  SERVER_UPLOAD_MAX_BYTES,
  storageDriver,
} from "@/lib/media/server";
import { getPlayerId, isAdmin } from "@/lib/session";

const UPLOAD_DIR = ".uploads";

/**
 * Receives raw media bytes at OUR origin and stores them — writing to Vercel
 * Blob in production (STORAGE_DRIVER=vercel-blob) or to .uploads/ in local dev.
 *
 * This is the reliable path for small media (photos, avatars): the phone only
 * ever talks to our domain — which works even on flaky cellular where a direct
 * browser → blob.vercel-storage.com upload gets rejected — and the server, on
 * Vercel's network, does the Blob write. Large videos can't fit through a
 * serverless request body (~4.5MB limit), so they still go browser → Blob
 * directly (see client-upload.ts / blob-upload route).
 */
export async function PUT(req: Request) {
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

  const url = new URL(req.url);
  const uuid = url.searchParams.get("uuid") ?? "";
  const ext = url.searchParams.get("ext") ?? "";
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!/^[a-f0-9-]{36}$/i.test(uuid) || !contentType) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  }
  if (bytes.byteLength > MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "File too large." }, { status: 413 });
  }

  const filename = `${uuid.toLowerCase()}.${ext}`;

  if (storageDriver() === "vercel-blob") {
    // Guard against Vercel's serverless request-body limit — the client only
    // routes small media here, but reject clearly if something larger slips in.
    if (bytes.byteLength > SERVER_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { error: "Too large to upload this way — connect to wifi." },
        { status: 413 },
      );
    }
    // Same pathname + allowOverwrite makes retries idempotent, matching the
    // direct-to-Blob path. Token comes from BLOB_READ_WRITE_TOKEN in the env.
    const blob = await put(`media/${filename}`, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ url: blob.url });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));
  return NextResponse.json({ url: `/api/media/file/${filename}` });
}
