"use client";

import { useState } from "react";

export function DemoPlayerButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">Player view</p>
        <p className="text-sm text-muted">
          Opens the game as <span className="font-mono">demo-player</span> in
          this browser — see exactly what guests see. Your admin login stays
          active.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        className="btn-primary shrink-0 rounded-lg px-4 py-2 font-semibold"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/admin/demo-player", {
              method: "POST",
            });
            if (!res.ok) {
              const data = await res.json();
              setError(data.error ?? "Could not open player view.");
              return;
            }
            window.open("/quests", "_blank");
          } catch {
            setError("Network hiccup — try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Open as player
      </button>
    </div>
  );
}
