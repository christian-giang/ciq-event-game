"use client";

import { useOutbox } from "@/components/outbox-provider";

/**
 * Completion badge for a quest card. Server state (DB) is the base; the
 * outbox overlays locally-saved-but-unsynced answers so an offline player
 * still sees their progress honestly.
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

  if (serverDone || local?.status === "done") {
    return <span className="label-caps shrink-0 text-xs">Done ✓</span>;
  }
  if (local?.status === "queued" || local?.status === "inflight") {
    return (
      <span className="label-caps shrink-0 text-xs">Saved, syncing…</span>
    );
  }
  if (local?.status === "rejected") {
    return (
      <span className="label-caps shrink-0 text-xs text-danger">Problem</span>
    );
  }
  return null;
}
