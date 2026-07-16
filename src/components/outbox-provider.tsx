"use client";

import { useEffect, useSyncExternalStore } from "react";
import { outbox, type OutboxSnapshot } from "@/lib/outbox/outbox";

/** Live view of the offline queue for any client component. */
export function useOutbox(): OutboxSnapshot {
  return useSyncExternalStore(
    outbox.subscribe,
    outbox.getSnapshot,
    outbox.getServerSnapshot,
  );
}

/**
 * Mounts the outbox singleton and wires every flush trigger:
 * app launch, 'online', visibility→visible, and a 15s foreground timer.
 * (iOS has no Background Sync — foreground triggers ARE the sync story.)
 */
export function OutboxProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void outbox.init();

    // Ask the browser not to evict our queue under storage pressure.
    // Safari often says no in a plain tab — the queue indicator is the
    // real safety net.
    navigator.storage?.persist?.().catch(() => {});

    const onOnline = () => outbox.retryNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void outbox.flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void outbox.flush();
    }, 15_000);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  return <>{children}</>;
}
