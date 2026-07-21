"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";

type SignupResult =
  | { status: "new"; code: string }
  | { status: "existing" };

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      if (data.status === "new") {
        // Convenience copy so /me can show the code later; the HTTP-only
        // cookie is what actually keeps you signed in.
        localStorage.setItem("wg_code", data.code);
      }
      track("signup_completed", { status: data.status });
      setResult(data);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result?.status === "existing") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-sage p-4 text-sm leading-relaxed">
          You&apos;re already signed up! We&apos;ve emailed your access code to{" "}
          <strong>{email}</strong>.
        </p>
        <Link
          href="/login"
          className="btn-primary block w-full rounded-lg px-5 py-3 text-center font-semibold"
        >
          Log in with my code
        </Link>
      </div>
    );
  }

  if (result?.status === "new") {
    return (
      <div className="space-y-4 text-center">
        <p className="label-caps">Your secret access code</p>
        <p className="ph-no-capture font-mono text-5xl font-bold tracking-[0.15em]">
          {result.code}
        </p>
        <button
          type="button"
          className="field w-full rounded-lg px-4 py-3 font-medium"
          onClick={async () => {
            await navigator.clipboard.writeText(result.code);
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <p className="text-sm text-muted">
          📸 Screenshot this! The code is how you get back in if you close the
          app. We&apos;ve also emailed it to you as a backup.
        </p>
        <button
          type="button"
          className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
          onClick={() => router.push("/me")}
        >
          Set up my profile →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex items-start gap-3 text-sm leading-snug">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
          required
        />
        <span>I&apos;ve read the notice above and I&apos;m in.</span>
      </label>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Your email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="ph-no-capture field w-full rounded-lg px-4 py-3"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy || !consent}
        className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
      >
        {busy ? "One moment…" : "Join the game"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have a code?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
