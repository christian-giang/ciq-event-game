import posthog from "posthog-js";

/**
 * Fire a product-analytics event. No-ops when PostHog isn't configured (no
 * NEXT_PUBLIC_POSTHOG_KEY), so local dev and unconfigured builds are
 * unaffected. Keep it anonymous — never pass PII (email, real names); quest
 * ids and kinds are fine.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, props);
}
