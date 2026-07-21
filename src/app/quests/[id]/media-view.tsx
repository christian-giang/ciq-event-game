"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { outbox } from "@/lib/outbox/outbox";
import { useOutbox } from "@/components/outbox-provider";
import {
  MediaRejection,
  processPhoto,
  validateVideo,
} from "@/lib/media/process";

type MediaProps = {
  quest: {
    id: string;
    mediaKind: "photo" | "video" | "either";
    maxDurationSec?: number;
  };
  serverSubmission: {
    mediaUrl: string;
    mediaKind: "photo" | "video";
  } | null;
};

type Picked = { blob: Blob; contentType: string; mediaKind: "photo" | "video" };

export function MediaView({ quest, serverSubmission }: MediaProps) {
  const { items } = useOutbox();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const maxSec = quest.maxDurationSec ?? 15;

  const local = items.find(
    (i) => i.kind === "media" && i.questId === quest.id,
  );
  const pending =
    local && (local.status === "queued" || local.status === "inflight");

  // Preview URL for whatever is picked or still queued locally.
  const previewBlob = picked?.blob ?? (pending ? local?.blob : undefined);
  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const doneUrl =
    (local?.status === "done" &&
      (local.response as { mediaUrl?: string } | null)?.mediaUrl) ||
    serverSubmission?.mediaUrl ||
    null;
  const doneKind =
    local?.status === "done"
      ? ((local.payload.mediaKind as "photo" | "video") ?? "photo")
      : (serverSubmission?.mediaKind ?? "photo");

  async function onPick(file: File | undefined, want: "photo" | "video") {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      if (want === "photo") {
        const blob = await processPhoto(file);
        setPicked({ blob, contentType: "image/jpeg", mediaKind: "photo" });
      } else {
        const validated = await validateVideo(file, maxSec);
        setPicked({
          blob: validated,
          contentType: validated.type || "video/mp4",
          mediaKind: "video",
        });
      }
    } catch (err) {
      setError(
        err instanceof MediaRejection
          ? err.message
          : "Couldn't read that file — try again.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function submit() {
    if (!picked) return;
    await outbox.enqueue({
      kind: "media",
      questId: quest.id,
      payload: { mediaKind: picked.mediaKind },
      blob: picked.blob,
      blobContentType: picked.contentType,
    });
    track("submission_created", {
      type: "media",
      mediaKind: picked.mediaKind,
      questId: quest.id,
    });
    setPicked(null);
    setReplacing(false);
  }

  const pickers = (
    <div className="space-y-2">
      {(quest.mediaKind === "photo" || quest.mediaKind === "either") && (
        <>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0], "photo")}
          />
          <button
            type="button"
            disabled={processing}
            className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
            onClick={() => photoInput.current?.click()}
          >
            📷 Take a photo
          </button>
        </>
      )}
      {(quest.mediaKind === "video" || quest.mediaKind === "either") && (
        <>
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0], "video")}
          />
          <button
            type="button"
            disabled={processing}
            className={`${
              quest.mediaKind === "video" ? "btn-primary" : "field"
            } w-full rounded-lg px-5 py-3 font-semibold`}
            onClick={() => videoInput.current?.click()}
          >
            🎥 Record a video ({maxSec}s max)
          </button>
        </>
      )}
      {processing && (
        <p className="text-center text-sm text-muted">Preparing…</p>
      )}
      {error && (
        <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );

  // 1. Picked, awaiting confirmation
  if (picked && previewUrl) {
    return (
      <div className="space-y-3">
        {picked.mediaKind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Your photo"
            className="max-h-96 w-full rounded-2xl object-contain"
          />
        ) : (
          <video
            src={previewUrl}
            controls
            playsInline
            className="max-h-96 w-full rounded-2xl"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1 rounded-lg px-5 py-3 font-semibold"
            onClick={submit}
          >
            Use this
          </button>
          <button
            type="button"
            className="field rounded-lg px-5 py-3 font-medium"
            onClick={() => setPicked(null)}
          >
            Retake
          </button>
        </div>
      </div>
    );
  }

  // 2. Queued/uploading
  if (pending && local) {
    return (
      <div className="space-y-3">
        {previewUrl &&
          ((local.payload.mediaKind as string) === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Your submission"
              className="max-h-96 w-full rounded-2xl object-contain opacity-80"
            />
          ) : (
            <video
              src={previewUrl}
              playsInline
              muted
              className="max-h-96 w-full rounded-2xl opacity-80"
            />
          ))}
        <div className="rounded-lg bg-sand p-3 text-center text-sm">
          <p className="font-medium">
            Saved on this phone — uploading
            {typeof local.progress === "number" ? ` ${local.progress}%` : "…"}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${local.progress ?? 3}%` }}
            />
          </div>
          <p className="mt-2 text-muted">
            Keep the app open until it&apos;s done.
          </p>
        </div>
      </div>
    );
  }

  // 3. Rejected by the server
  if (local?.status === "rejected" && !serverSubmission) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
          {local.lastError ?? "This couldn't be submitted."} Try again.
        </p>
        {pickers}
      </div>
    );
  }

  // 4. Done (server or acked local) — show it, offer replace
  if (doneUrl && !replacing) {
    return (
      <div className="space-y-3">
        {doneKind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doneUrl}
            alt="Your submission"
            className="max-h-96 w-full rounded-2xl object-contain"
          />
        ) : (
          <video
            src={doneUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-96 w-full rounded-2xl"
          />
        )}
        <button
          type="button"
          className="field w-full rounded-lg px-4 py-3 font-medium"
          onClick={() => setReplacing(true)}
        >
          Replace it
        </button>
        <p className="text-center text-sm text-muted">
          Replacing removes any votes you&apos;ve already received on it.
        </p>
      </div>
    );
  }

  // 5. Nothing yet — pick
  return (
    <div className="space-y-3">
      {pickers}
      {replacing && (
        <button
          type="button"
          className="field w-full rounded-lg px-4 py-2 text-sm"
          onClick={() => setReplacing(false)}
        >
          Cancel
        </button>
      )}
      <p className="text-center text-sm text-muted">
        Your upload is saved on this phone first — it syncs whenever the wifi
        allows.
      </p>
    </div>
  );
}
