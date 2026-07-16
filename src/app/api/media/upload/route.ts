import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import {
  CONTENT_TYPE_BY_EXT,
  MEDIA_MAX_BYTES,
  storageDriver,
} from "@/lib/media/server";
import { getPlayerId } from "@/lib/session";

const UPLOAD_DIR = ".uploads";

/**
 * Local storage driver only: accepts the raw media bytes and writes them
 * to .uploads/. Same clientUuid overwrites itself — idempotent retries.
 * (In production this endpoint is unused: bytes go browser → Vercel Blob.)
 */
export async function PUT(req: Request) {
  if (storageDriver() !== "local") {
    return NextResponse.json({ error: "Wrong driver." }, { status: 400 });
  }

  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const url = new URL(req.url);
  const uuid = url.searchParams.get("uuid") ?? "";
  const ext = url.searchParams.get("ext") ?? "";
  if (!/^[a-f0-9-]{36}$/i.test(uuid) || !CONTENT_TYPE_BY_EXT[ext]) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  }
  if (bytes.byteLength > MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "File too large." }, { status: 413 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${uuid.toLowerCase()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));

  return NextResponse.json({ url: `/api/media/file/${filename}` });
}
