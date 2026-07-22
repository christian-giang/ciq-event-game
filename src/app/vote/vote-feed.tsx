"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { Avatar } from "@/components/avatar";

type FeedSubmission = {
  id: string;
  bodyText: string | null;
  mediaUrl: string | null;
  kind: string;
  username: string | null;
  avatarUrl: string | null;
  contributors: string[];
};

/**
 * Vote toggles with a shared budget. Vote COUNTS are deliberately never
 * shown (no bandwagoning) — only your own usage: "2 of 3 votes used".
 * Optimistic UI, rolled back if the server says no.
 */
export function VoteFeed({
  submissions,
  initialVoted,
  cap,
}: {
  submissions: FeedSubmission[];
  initialVoted: string[];
  cap: number;
}) {
  const [voted, setVoted] = useState(new Set(initialVoted));
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const used = voted.size;
  const budgetLeft = used < cap;

  async function toggle(submissionId: string) {
    const isVoted = voted.has(submissionId);
    if (!isVoted && !budgetLeft) return;
    if (!isVoted) track("vote_cast", { submissionId });

    // Optimistic flip.
    const before = new Set(voted);
    const after = new Set(voted);
    if (isVoted) after.delete(submissionId);
    else after.add(submissionId);
    setVoted(after);
    setBusyId(submissionId);
    setError(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action: isVoted ? "remove" : "add",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoted(before);
        setError(data.error ?? "That didn't work — try again.");
      }
    } catch {
      setVoted(before);
      setError("No connection — votes need the network. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (submissions.length === 0) {
    return (
      <p className="card rounded-2xl p-6 text-center text-muted">
        Nothing to vote on here yet — check back soon!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="sticky top-0 z-10 rounded-lg bg-sand px-4 py-2 text-center text-sm font-medium">
        {used} of {cap} votes used
      </p>
      {error && (
        <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      {submissions.map((s) => {
        const isVoted = voted.has(s.id);
        return (
          <div key={s.id} className="card rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Avatar name={s.username} avatarUrl={s.avatarUrl} size={28} />
              <span className="min-w-0">
                <span className="font-medium">{s.username}</span>
                {s.contributors.length > 0 && (
                  <span className="block text-xs text-muted">
                    with {s.contributors.join(", ")}
                  </span>
                )}
              </span>
            </div>
            {s.bodyText && (
              <p className="mb-3 whitespace-pre-wrap leading-relaxed">
                {s.bodyText}
              </p>
            )}
            {s.mediaUrl &&
              (s.kind === "video" ? (
                <video
                  src={s.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="mb-3 max-h-96 w-full rounded-lg"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.mediaUrl}
                  alt={`Submission by ${s.username}`}
                  loading="lazy"
                  className="mb-3 max-h-96 w-full rounded-lg object-contain"
                />
              ))}
            <button
              type="button"
              disabled={busyId === s.id || (!isVoted && !budgetLeft)}
              onClick={() => toggle(s.id)}
              className={
                isVoted
                  ? "btn-primary w-full rounded-lg px-4 py-3 font-semibold"
                  : "field w-full rounded-lg px-4 py-3 font-medium disabled:opacity-50"
              }
            >
              {isVoted ? "Voted ♥ (tap to undo)" : "Vote for this"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
