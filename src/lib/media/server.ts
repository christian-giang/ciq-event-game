/** Shared server-side media constants (storage driver, allowlists). */

export const MEDIA_MAX_BYTES = 30 * 1024 * 1024;

export const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const CONTENT_TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_CONTENT_TYPE).map(([ct, ext]) => [ext, ct]),
);

export function storageDriver(): "local" | "vercel-blob" {
  return process.env.STORAGE_DRIVER === "vercel-blob"
    ? "vercel-blob"
    : "local";
}

/** URL prefix our own submissions API accepts as "our storage". */
export function isOurMediaUrl(url: string): boolean {
  if (storageDriver() === "local") {
    return /^\/api\/media\/file\/[a-f0-9-]+\.[a-z0-9]+$/i.test(url);
  }
  // Vercel Blob public URLs live on *.blob.vercel-storage.com.
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
