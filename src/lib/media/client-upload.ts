import { upload } from "@vercel/blob/client";
import { EXT_BY_CONTENT_TYPE, SERVER_UPLOAD_MAX_BYTES } from "@/lib/media/server";

/**
 * Above this size, upload in multiple parts. Multipart splits the file into
 * ~5MB chunks that the SDK uploads and retries independently, so a stalled
 * chunk on flaky cellular is re-sent on a fresh connection instead of hanging
 * the whole upload. Below 5MB a file is a single part anyway, so a plain PUT
 * (one round-trip) is leaner — we keep photos on the simple path.
 */
const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

/**
 * Client-visible storage driver. Mirrors the server's STORAGE_DRIVER, but the
 * browser can only read NEXT_PUBLIC_* vars, so this one must be set to match.
 */
export function clientStorageDriver(): "local" | "vercel-blob" {
  return process.env.NEXT_PUBLIC_STORAGE_DRIVER === "vercel-blob"
    ? "vercel-blob"
    : "local";
}

/**
 * Uploads bytes straight from the browser to Vercel Blob via the
 * @vercel/blob/client handshake — the bytes never pass through our serverless
 * function (so they dodge the request-body size limit and don't cost function
 * time). /api/media/blob-upload authorizes the player and issues the token.
 * Returns the public Blob URL to store on the submission/profile.
 */
export async function uploadToBlob(opts: {
  clientUuid: string;
  blob: Blob;
  contentType: string;
  onProgress?: (pct: number) => void;
  abortSignal?: AbortSignal;
}): Promise<{ url: string }> {
  const ext = EXT_BY_CONTENT_TYPE[opts.contentType] ?? "bin";
  // addRandomSuffix is false server-side, so the same clientUuid overwrites
  // itself — retries are idempotent, matching the local driver.
  const result = await upload(`media/${opts.clientUuid}.${ext}`, opts.blob, {
    access: "public",
    handleUploadUrl: "/api/media/blob-upload",
    contentType: opts.contentType,
    multipart: opts.blob.size > MULTIPART_THRESHOLD_BYTES,
    abortSignal: opts.abortSignal,
    onUploadProgress: opts.onProgress
      ? ({ percentage }) => opts.onProgress!(percentage)
      : undefined,
  });
  return { url: result.url };
}

/**
 * Upload a single image blob (avatar or quest picture) and return its URL,
 * transparently using Blob in prod and our local endpoint in dev. Callers
 * pre-process the image (downscale/crop) before handing it here.
 */
export async function uploadPicture(
  blob: Blob,
  contentType = "image/jpeg",
): Promise<string> {
  const clientUuid = crypto.randomUUID();

  // Large pictures go straight to Blob; small ones (avatars, most quest images)
  // route through our origin, which is reliable on cellular.
  if (
    clientStorageDriver() === "vercel-blob" &&
    blob.size > SERVER_UPLOAD_MAX_BYTES
  ) {
    return (await uploadToBlob({ clientUuid, blob, contentType })).url;
  }

  const target = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientUuid, contentType }),
  });
  if (!target.ok) throw new Error("Couldn't start the upload.");
  const { url } = (await target.json()) as { url: string };
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) throw new Error("Picture upload failed.");
  return ((await put.json()) as { url: string }).url;
}
