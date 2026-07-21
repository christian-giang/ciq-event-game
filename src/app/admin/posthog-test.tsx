"use client";

import posthog from "posthog-js";
import { useState } from "react";

export function PostHogTest() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  function send() {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      setResult({
        ok: false,
        text: "Not configured — NEXT_PUBLIC_POSTHOG_KEY isn't set. Add it in Vercel (Production) and redeploy.",
      });
      return;
    }

    const loaded = (posthog as unknown as { __loaded?: boolean }).__loaded;
    const dnt =
      typeof navigator !== "undefined" &&
      (navigator.doNotTrack === "1" || navigator.doNotTrack === "yes");

    // capture() returns undefined when the event is suppressed (opted out,
    // Do Not Track, ad-blocker) or the SDK never initialised.
    const res = posthog.capture("admin_test_event", {
      source: "admin",
      at: new Date().toISOString(),
    }) as { uuid?: string } | undefined;

    if (!res) {
      setResult({
        ok: false,
        text: `Capture was suppressed — likely Do Not Track${
          dnt ? " (your browser has DNT on)" : ""
        }, an ad-blocker/privacy extension, or PostHog didn't initialise (loaded: ${
          loaded ? "yes" : "no"
        }). Try again in a normal browser tab without blockers.`,
      });
      return;
    }

    const distinctId =
      typeof posthog.get_distinct_id === "function"
        ? posthog.get_distinct_id()
        : "unknown";

    setResult({
      ok: true,
      text: `Sent "admin_test_event" (id ${
        res.uuid ?? "—"
      }) as distinct id ${distinctId}. Open PostHog → Activity and look for it within ~1 minute.${
        dnt
          ? " Note: your browser has Do Not Track on, so it may not arrive — that's expected."
          : ""
      }`,
    });
  }

  return (
    <div>
      <p className="font-medium">Test analytics (PostHog)</p>
      <p className="mb-3 text-sm text-muted">
        Fires a test event from this browser and checks the SDK accepted it.
        Then confirm it lands in PostHog → Activity.
      </p>
      <button
        type="button"
        onClick={send}
        className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
      >
        Send test event
      </button>
      {result && (
        <p
          className={`mt-3 rounded-lg p-3 text-sm ${
            result.ok ? "bg-sage" : "bg-blush text-danger"
          }`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
