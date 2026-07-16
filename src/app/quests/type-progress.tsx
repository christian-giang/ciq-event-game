"use client";

import { useOutbox } from "@/components/outbox-provider";

/**
 * The progress line on a main-menu cell. Server state can lag (a
 * just-answered quiz may still be syncing, or the page may be a cached
 * client navigation), so we overlay the local outbox — anything answered
 * or submitted on this device counts immediately, matching the per-quest
 * badges.
 */
export function TypeProgress({
  questIds,
  serverDoneIds,
}: {
  questIds: string[];
  serverDoneIds: string[];
}) {
  const { items } = useOutbox();

  const done = new Set(serverDoneIds);
  const ids = new Set(questIds);
  for (const item of items) {
    if (
      ids.has(item.questId) &&
      (item.status === "done" ||
        item.status === "queued" ||
        item.status === "inflight")
    ) {
      done.add(item.questId);
    }
  }

  const total = questIds.length;
  if (total === 0) {
    return <span className="text-sm text-muted">coming soon</span>;
  }
  const count = questIds.filter((id) => done.has(id)).length;

  if (count === total) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-3 py-1 text-xs font-semibold text-ink">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
        All done
      </span>
    );
  }

  // Tiny progress bar + count.
  return (
    <span className="flex w-20 flex-col items-center gap-1">
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${(count / total) * 100}%` }}
        />
      </span>
      <span className="text-xs text-muted">
        {count} of {total}
      </span>
    </span>
  );
}
