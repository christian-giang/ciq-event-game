"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "That didn't work.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="secret" className="block text-sm font-medium">
        Admin code
      </label>
      <input
        id="secret"
        type="password"
        autoComplete="off"
        required
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="field w-full rounded-lg px-4 py-3"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
      >
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
