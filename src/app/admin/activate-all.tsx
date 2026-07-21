"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

export function ActivateAll({
  activated,
  total,
}: {
  activated: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "on" | "off">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(isActivated: boolean) {
    setBusy(isActivated ? "on" : "off");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, isActivated }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          `${isActivated ? "Activated" : "Deactivated"} ${data.count} player${
            data.count === 1 ? "" : "s"
          }.`,
        );
        router.refresh();
      } else {
        setMsg(data.error ?? "That didn't work.");
      }
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
          <p className="font-medium">Activation</p>
          <p className="text-sm text-muted">
            {activated} of {total} activated. Activated players can open the
            quests, vote and see the board.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run(true)}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy === "on" ? "Activating…" : "Activate all"}
          </button>
          <ConfirmButton
            disabled={busy !== null}
            confirmLabel="Deactivate everyone?"
            onConfirm={() => run(false)}
            className="field rounded-lg px-4 py-2 text-sm font-medium text-danger disabled:opacity-50"
          >
            {busy === "off" ? "Deactivating…" : "Deactivate all"}
          </ConfirmButton>
        </div>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-sage p-3 text-sm">{msg}</p>}
    </div>
  );
}
