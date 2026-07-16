"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MediaRejection, processAvatar } from "@/lib/media/process";

async function uploadAvatar(blob: Blob): Promise<string> {
  const clientUuid = crypto.randomUUID();
  const target = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientUuid, contentType: "image/jpeg" }),
  });
  if (!target.ok) throw new Error("Couldn't start the upload.");
  const { url } = (await target.json()) as { url: string };
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!put.ok) throw new Error("Picture upload failed.");
  return ((await put.json()) as { url: string }).url;
}

export function ProfileForm({
  initialName,
  initialAvatarUrl,
  onboarding,
}: {
  initialName: string;
  initialAvatarUrl: string | null;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pickedBlob, setPickedBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const previewUrl = useMemo(
    () => (pickedBlob ? URL.createObjectURL(pickedBlob) : null),
    [pickedBlob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPickedBlob(await processAvatar(file));
    } catch (err) {
      setError(
        err instanceof MediaRejection ? err.message : "Couldn't read that image.",
      );
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let url = avatarUrl;
      if (pickedBlob) url = await uploadAvatar(pickedBlob);

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save — try again.");
        return;
      }
      setAvatarUrl(url);
      setPickedBlob(null);
      setSaved(true);
      if (onboarding) {
        router.push("/quests");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network hiccup.");
    } finally {
      setBusy(false);
    }
  }

  const shownAvatar = previewUrl ?? avatarUrl;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Your picture"
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <Avatar name={name || null} avatarUrl={shownAvatar} size={96} />
        )}
        <div className="flex items-center gap-3">
          <label className="field cursor-pointer rounded-lg px-4 py-2 text-sm font-medium">
            {shownAvatar ? "Change picture" : "Add a picture"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
          {shownAvatar && (
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => {
                setPickedBlob(null);
                setAvatarUrl(null);
              }}
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Picture is optional</p>
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Your name
        </label>
        <input
          id="name"
          type="text"
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ana Marković"
          className="field w-full rounded-lg px-4 py-3"
        />
        <p className="mt-1 text-xs text-muted">
          This is how you appear on the leaderboard and next to your answers.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !onboarding && (
        <p className="text-sm text-ink">Saved ✓</p>
      )}

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
      >
        {busy
          ? "Saving…"
          : onboarding
            ? "Enter the game →"
            : "Save changes"}
      </button>
    </form>
  );
}
