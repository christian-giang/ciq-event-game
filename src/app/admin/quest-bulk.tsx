"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

type Action = "release-all" | "open-voting-all" | "complete-all";

export function QuestBulk({
  counts,
}: {
  counts: {
    unreleased: number;
    released: number;
    voting: number;
    completed: number;
    releasedVoted: number;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/quest-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "That didn't work.");
        return;
      }
      setMsg(`Updated ${data.count} quest${data.count === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  const inPlay = counts.released + counts.voting;

  return (
    <div className="card mb-4 rounded-2xl p-4">
      <p className="font-medium">Run the game — bulk controls</p>
      <p className="mb-3 text-sm text-muted">
        {counts.unreleased} unreleased · {counts.released} released ·{" "}
        {counts.voting} voting · {counts.completed} completed
      </p>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          disabled={busy !== null || counts.unreleased === 0}
          confirmLabel={`Release ${counts.unreleased}?`}
          onConfirm={() => run("release-all")}
          className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "release-all"
            ? "Releasing…"
            : `Release all (${counts.unreleased})`}
        </ConfirmButton>
        <ConfirmButton
          disabled={busy !== null || counts.releasedVoted === 0}
          confirmLabel={`Open voting on ${counts.releasedVoted}?`}
          onConfirm={() => run("open-voting-all")}
          className="field rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "open-voting-all"
            ? "Opening…"
            : `Open voting (${counts.releasedVoted})`}
        </ConfirmButton>
        <ConfirmButton
          disabled={busy !== null || inPlay === 0}
          confirmLabel={`Complete ${inPlay}? (scores them)`}
          onConfirm={() => run("complete-all")}
          className="field rounded-lg px-4 py-2 text-sm font-medium text-danger disabled:opacity-50"
        >
          {busy === "complete-all" ? "Completing…" : `Complete all (${inPlay})`}
        </ConfirmButton>
      </div>
      <p className="mt-2 text-xs text-muted">
        Release all → let people play → Open voting → (at the end) Complete all
        to score &amp; reveal. Quizzes skip voting; Complete all finishes them.
      </p>
      {msg && <p className="mt-3 rounded-lg bg-sage p-3 text-sm">{msg}</p>}
    </div>
  );
}
