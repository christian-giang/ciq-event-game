"use client";

import { useMemo, useState } from "react";

type P = { id: string; username: string; sim: boolean; activated: boolean };

export function ViewAsPlayer({ players }: { players: P[] }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players
      .filter((p) => p.username.toLowerCase().includes(q))
      .slice(0, 60);
  }, [players, search]);

  async function viewAs(id: string) {
    // Open the tab synchronously (inside the click) so popup blockers allow
    // it, then point it at /quests once the player session is set.
    const win = window.open("about:blank", "_blank");
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id }),
      });
      if (!res.ok) {
        win?.close();
        const d = await res.json().catch(() => null);
        setErr(d?.error ?? "Couldn't switch.");
        return;
      }
      if (win) win.location.href = "/quests";
      else window.open("/quests", "_blank"); // fallback if blocked
    } catch {
      win?.close();
      setErr("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="font-medium">View as a player</p>
      <p className="mb-3 text-sm text-muted">
        Opens the game as any player (real or simulated) in a new tab, so you
        can see exactly what they see with /admin still open here. Heads-up:
        anything you submit or vote happens as that player.
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${players.length} players…`}
        className="field mb-2 w-full rounded-lg px-3 py-2 text-sm"
      />
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.username}
              {p.sim && (
                <span className="ml-2 rounded-full bg-paper px-1.5 py-0.5 text-xs text-muted">
                  sim
                </span>
              )}
              {!p.activated && (
                <span className="ml-2 text-xs text-muted">waiting</span>
              )}
            </span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => viewAs(p.id)}
              className="btn-primary shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy === p.id ? "…" : "View as"}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-1 py-1 text-sm text-muted">No matches.</li>
        )}
      </ul>
    </div>
  );
}
