"use client";

/**
 * Client-side media constraints. Raw iPhone media will never survive venue
 * wifi — photos are downscaled before they ever enter the outbox, and
 * videos are validated (duration + size) with a friendly, specific
 * rejection BEFORE queueing. Nothing over budget is ever queued.
 *
 * A MediaRecorder capture path (in-app recording at 720p, hard 15s stop)
 * can be added behind NEXT_PUBLIC_MEDIA_RECORDER=1 once it has been spiked
 * on a real iPhone.
 */

const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 0.8;
const PHOTO_FALLBACK_QUALITY = 0.6;
const PHOTO_RETRY_BYTES = 600 * 1024;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;

export class MediaRejection extends Error {}

/** Downscale + recompress a picked photo. Returns a JPEG blob. */
export async function processPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new MediaRejection("That doesn't look like a photo.");
  }

  // createImageBitmap honors EXIF orientation in modern browsers, so
  // portrait iPhone photos stay upright through the canvas.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    throw new MediaRejection(
      "Couldn't read that image — try a different photo.",
    );
  }

  const scale = Math.min(
    1,
    PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MediaRejection("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toJpeg = (quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("toBlob returned null")),
        "image/jpeg",
        quality,
      );
    });

  let blob = await toJpeg(PHOTO_QUALITY);
  if (blob.size > PHOTO_RETRY_BYTES) {
    blob = await toJpeg(PHOTO_FALLBACK_QUALITY);
  }
  return blob;
}

/** Center-crop a picked photo to a square avatar (~400px) JPEG. */
export async function processAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new MediaRejection("That doesn't look like a photo.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new MediaRejection("Couldn't read that image — try another.");
  }

  const size = 400;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MediaRejection("Couldn't process that image.");

  // Cover: scale so the shorter edge fills the square, then center.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob null"))),
      "image/jpeg",
      0.85,
    );
  });
}

/**
 * Validate a picked video without uploading it: duration from metadata,
 * byte size from the file. Throws MediaRejection with a message the guest
 * can act on.
 */
export async function validateVideo(
  file: File,
  maxDurationSec: number,
): Promise<File> {
  if (!file.type.startsWith("video/")) {
    throw new MediaRejection("That doesn't look like a video.");
  }

  if (file.size > VIDEO_MAX_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    throw new MediaRejection(
      `That video is ${mb} MB — too big for the venue wifi. ` +
        `Try a shorter clip (${maxDurationSec}s max) or lower quality.`,
    );
  }

  const duration = await new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        finish(video.duration);
        return;
      }
      // MediaRecorder WebM files report Infinity until forced to compute
      // the real duration by seeking far past the end.
      video.ondurationchange = () => {
        if (Number.isFinite(video.duration)) finish(video.duration);
      };
      video.currentTime = 1e7;
      // If the duration never materializes, fall through on a timer —
      // the byte cap already limits the damage.
      setTimeout(() => finish(video.duration), 3000);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MediaRejection("Couldn't read that video — try again."));
    };
    video.src = url;
  });

  // Small tolerance: camera apps often overshoot by a hair.
  if (Number.isFinite(duration) && duration > maxDurationSec + 1.5) {
    throw new MediaRejection(
      `That's ${Math.round(duration)} seconds — we need ${maxDurationSec} or less. Trim it or shoot a shorter one.`,
    );
  }

  return file;
}
