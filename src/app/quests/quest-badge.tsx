"use client";

import { useOutbox } from "@/components/outbox-provider";

/**
 * Personal completion indicator for a quest card — a small circular badge
 * in the card corner. Server state (DB) is the base; the outbox overlays
 * locally-saved-but-unsynced answers so an offline player still sees their
 * own progress honestly.
 */
export function QuestBadge({
  questId,
  serverDone,
}: {
  questId: string;
  serverDone: boolean;
}) {
  const { items } = useOutbox();
  const local = items.find((i) => i.questId === questId);

  const done = serverDone || local?.status === "done";
  const syncing =
    !done && (local?.status === "queued" || local?.status === "inflight");
  const problem = !done && local?.status === "rejected";

  if (done) {
    return (
      <span
        aria-label="Completed"
        title="You've done this one"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage text-ink shadow-sm"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }

  if (syncing) {
    return (
      <span
        aria-label="Saved, syncing"
        title="Saved on this phone — syncing"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </span>
    );
  }

  if (problem) {
    return (
      <span
        aria-label="Problem"
        title="This couldn't be submitted — open to see why"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger font-bold text-white shadow-sm"
      >
        !
      </span>
    );
  }

  return null;
}
