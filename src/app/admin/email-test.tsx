"use client";

import { useState } from "react";

export function EmailTest() {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, text: data.error ?? "That didn't work." });
        return;
      }
      setResult({
        ok: data.ok,
        text: `[driver: ${data.driver}] ${data.message}`,
      });
    } catch {
      setResult({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="font-medium">Test email (Resend)</p>
      <p className="mb-3 text-sm text-muted">
        Send a test email to check Resend is configured. The result below shows
        exactly what happened — including the exact error if it fails.
      </p>
      <form onSubmit={send} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send test"}
        </button>
      </form>
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
