"use client";

import { useOutbox } from "./outbox-provider";

/**
 * The honest queue indicator. Never shows success for something still in
 * the outbox; tells iPhone users to keep the app open (no Background Sync
 * on iOS — closing the app pauses uploads).
 */
export function QueueIndicator() {
  const { pending, rejected } = useOutbox();

  if (pending === 0 && rejected === 0) return null;

  return (
    <div className="border-b border-line bg-sand px-4 py-2 text-center text-sm">
      {pending > 0 && (
        <p>
          <span className="font-semibold">
            {pending} {pending === 1 ? "item" : "items"} waiting to sync
          </span>{" "}
          — saved on this phone. Keep the app open until it&apos;s done.
        </p>
      )}
      {rejected > 0 && (
        <p className="text-danger">
          {rejected} {rejected === 1 ? "item" : "items"} couldn&apos;t be
          submitted — open the quest to see why.
        </p>
      )}
    </div>
  );
}
