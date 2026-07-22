"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

export function QuestTemplate({
  loaded,
  total,
}: {
  loaded: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "load" | "remove">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(kind: "load" | "remove") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/quest-template", {
        method: kind === "load" ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "That didn't work.");
        return;
      }
      setMsg(
        kind === "load"
          ? `Loaded ${data.inserted} new quest${data.inserted === 1 ? "" : "s"} (${data.total - data.inserted} already there).`
          : `Removed ${data.removed} template quest${data.removed === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch {
      setMsg("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card mb-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Quest template</p>
          <p className="text-sm text-muted">
            {loaded} of {total} template quests loaded. Loading adds only the
            missing ones (your edits &amp; images are kept). Add images per quest
            in the editor below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("load")}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "load" ? "Loading…" : "Load template"}
          </button>
          <ConfirmButton
            disabled={busy !== null}
            confirmLabel="Remove all?"
            onConfirm={() => run("remove")}
            className="field rounded-lg px-4 py-2 text-sm font-medium text-danger disabled:opacity-50"
          >
            {busy === "remove" ? "Removing…" : "Remove template"}
          </ConfirmButton>
        </div>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-sage p-3 text-sm">{msg}</p>}
    </div>
  );
}
