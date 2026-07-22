"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";

type Person = { id: string; username: string | null; avatarUrl: string | null };

/**
 * "Who else worked on this?" — a searchable multi-select of other players,
 * for crediting teammates on a group photo/video. They earn the same points.
 */
export function ContributorPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [roster, setRoster] = useState<Person[] | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || roster) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/players");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (live) setRoster(data.players as Person[]);
      } catch {
        if (live) setError("Couldn't load the player list — check your connection.");
      }
    })();
    return () => {
      live = false;
    };
  }, [open, roster]);

  const byId = new Map((roster ?? []).map((p) => [p.id, p]));
  const q = search.trim().toLowerCase();
  const filtered = (roster ?? []).filter(
    (p) => p.username && p.username.toLowerCase().includes(q),
  );

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="rounded-lg border border-line p-3 text-left">
      <p className="text-sm font-medium">Who else worked on this?</p>
      <p className="mb-2 text-xs text-muted">
        Everyone you add gets the points too — optional.
      </p>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {value.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="flex items-center gap-1 rounded-full bg-sage px-2 py-1 text-xs font-medium"
            >
              {byId.get(id)?.username ?? "teammate"} ✕
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="field rounded-lg px-3 py-2 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Done" : value.length ? "Edit teammates" : "+ Add teammates"}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names…"
            className="field w-full rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {!roster && !error && <p className="text-sm text-muted">Loading…</p>}
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((p) => {
              const on = value.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      on ? "bg-sage" : "field"
                    }`}
                  >
                    <Avatar name={p.username} avatarUrl={p.avatarUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate">{p.username}</span>
                    {on && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
            {roster && filtered.length === 0 && (
              <li className="px-2 py-1 text-sm text-muted">No matches.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
