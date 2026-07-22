"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

type Person = { id: string; username: string };
type Award = {
  batchId: string;
  points: number;
  reason: string;
  names: string[];
};

export function BonusPoints({
  players,
  recent,
}: {
  players: Person[];
  recent: Award[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => p.username.toLowerCase().includes(q));
  }, [players, search]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function award() {
    const pts = Number(points);
    if (!selected.length || !Number.isInteger(pts) || pts === 0 || !reason.trim()) {
      setMsg({
        ok: false,
        text: "Pick at least one player, and enter non-zero points and a reason.",
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: selected,
          points: pts,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "That didn't work." });
        return;
      }
      setMsg({
        ok: true,
        text: `${pts > 0 ? "+" : ""}${pts} to ${data.count} player${data.count === 1 ? "" : "s"}.`,
      });
      setSelected([]);
      setPoints("");
      setReason("");
      setSearch("");
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  }

  async function undo(batchId: string) {
    await fetch(`/api/admin/bonus?batchId=${batchId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <p className="font-medium">Bonus points</p>
      <p className="mb-3 text-sm text-muted">
        Award (or deduct, with a negative number) points to one or more players
        with a note. Counts on the overall board.
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="Points (e.g. 10 or -5)"
          className="field w-44 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          maxLength={100}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (e.g. Best team spirit)"
          className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-2 rounded-lg border border-line p-2">
        <div className="mb-2 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${players.length} players…`}
            className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setSelected(filtered.map((p) => p.id))}
          >
            All
          </button>
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => setSelected([])}
          >
            None
          </button>
        </div>
        <p className="mb-1 text-xs text-muted">{selected.length} selected</p>
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {filtered.map((p) => {
            const on = selected.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                    on ? "bg-sage" : "field"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{p.username}</span>
                  {on && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-1 text-sm text-muted">No matches.</li>
          )}
        </ul>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={award}
        className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Awarding…" : "Award points"}
      </button>
      {msg && (
        <p
          className={`mt-3 rounded-lg p-3 text-sm ${
            msg.ok ? "bg-sage" : "bg-blush text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="label-caps mb-2 text-xs">Recent awards</p>
          <ul className="space-y-2">
            {recent.map((a) => (
              <li
                key={a.batchId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">
                    {a.points > 0 ? `+${a.points}` : a.points}
                  </span>{" "}
                  · {a.reason}
                  <span className="block truncate text-xs text-muted">
                    {a.names.join(", ")}
                  </span>
                </div>
                <ConfirmButton
                  confirmLabel="Undo?"
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger underline"
                  onConfirm={() => undo(a.batchId)}
                >
                  Undo
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
