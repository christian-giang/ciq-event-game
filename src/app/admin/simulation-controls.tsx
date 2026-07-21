"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SimulationControls() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "seed" | "clear">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(kind: "seed" | "clear") {
    if (
      kind === "clear" &&
      !confirm(
        "Delete ALL simulation data? Your real players, quests and submissions are kept.",
      )
    ) {
      return;
    }
    setBusy(kind);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/simulate", {
        method: kind === "seed" ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "That didn't work — try again.");
        return;
      }
      const s = data.summary;
      setMsg(
        kind === "seed"
          ? `Added ${s.players} players, ${s.quests} quests, ${s.submissions} submissions, ${s.votes} votes and ${s.answers} quiz answers.`
          : `Removed ${s.players} sim players and ${s.quests} sim quests (and everything attached to them).`,
      );
      router.refresh();
    } catch {
      setErr("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="font-medium">Simulation</p>
      <p className="mb-3 text-sm text-muted">
        Fill the game with fake players, quests, submissions and votes to test
        the leaderboard, results and big screen. Everything it creates is
        tagged — “Clear” removes only that, leaving your real data untouched.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("seed")}
          className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "seed" ? "Adding…" : "Run simulation"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("clear")}
          className="field rounded-lg px-4 py-2 text-sm font-medium text-danger disabled:opacity-50"
        >
          {busy === "clear" ? "Clearing…" : "Clear simulation data"}
        </button>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-sage p-3 text-sm">{msg}</p>}
      {err && (
        <p className="mt-3 rounded-lg bg-blush p-3 text-sm text-danger">{err}</p>
      )}
    </div>
  );
}
