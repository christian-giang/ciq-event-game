import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPE_BY_EXT } from "@/lib/media/server";

const UPLOAD_DIR = ".uploads";

/** Serves local-driver media. Filenames are uuid.ext only — no traversal. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const match = /^([a-f0-9-]{36})\.([a-z0-9]+)$/i.exec(name);
  const contentType = match && CONTENT_TYPE_BY_EXT[match[2]];
  if (!match || !contentType) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
