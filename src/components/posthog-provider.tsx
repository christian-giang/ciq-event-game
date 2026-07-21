"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

// Module-level guard so React StrictMode's double-effect doesn't double-init.
let started = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || started) return;
    started = true;
    posthog.init(KEY, {
      api_host: HOST,
      // Anonymous analysis: PostHog's per-browser id, no identify() with PII.
      person_profiles: "always",
      capture_pageview: false, // captured manually below (App Router SPA nav)
      capture_pageleave: true,
      autocapture: true,
      // Analytics are disclosed on the landing page and anonymous, so we
      // capture all guests rather than dropping the Do-Not-Track crowd.
      respect_dnt: false,
      // Session replay records real text/inputs so you can see what guests do.
      // The access code (a login credential) and email input are individually
      // redacted via the `ph-no-capture` class on those elements.
      session_recording: {
        maskAllInputs: false,
      },
    });
  }, []);

  // Not configured → render children without the provider; track() no-ops.
  if (!KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

/** Manual $pageview capture — App Router doesn't fire one on SPA navigation. */
function PageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = usePostHog();

  useEffect(() => {
    if (!pathname || !client) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    client.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, client]);

  return null;
}
