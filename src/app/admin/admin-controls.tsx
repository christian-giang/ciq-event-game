"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";

async function post(url: string, body: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function FreezeToggle({ frozen }: { frozen: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">
          Game {frozen ? "is FROZEN ❄️" : "is live"}
        </p>
        <p className="text-sm text-muted">
          Freezing stops all submissions and votes and locks the final
          leaderboard.
        </p>
      </div>
      <ConfirmButton
        disabled={busy}
        needsConfirm={!frozen}
        confirmLabel="Freeze — sure?"
        className="btn-primary shrink-0 rounded-lg px-4 py-2 font-semibold"
        onConfirm={async () => {
          setBusy(true);
          await post("/api/admin/freeze", { frozen: !frozen });
          setBusy(false);
          router.refresh();
        }}
      >
        {frozen ? "Unfreeze" : "Freeze"}
      </ConfirmButton>
    </div>
  );
}

export function LeaderboardModeToggle({
  mode,
}: {
  mode: "relative" | "absolute";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: "relative" | "absolute") {
    if (next === mode || busy) return;
    setBusy(true);
    await post("/api/admin/leaderboard-mode", { mode: next });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <p className="font-medium">Leaderboard view</p>
      <p className="mb-3 text-sm text-muted">
        <strong>Relative</strong> shows each player only their nearest rivals
        (you, and one above &amp; below). <strong>Absolute</strong> shows the
        full top of the board.
      </p>
      <div className="flex gap-1 rounded-xl border border-line bg-paper p-1">
        {(["relative", "absolute"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            onClick={() => set(m)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
              mode === m ? "bg-accent text-white shadow" : "text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlayerRow(props: {
  id: string;
  username: string | null;
  email: string;
  accessCode: string;
  isBlocked: boolean;
  isActivated: boolean;
  createdAt: string;
}) {
  const router = useRouter();
  const displayName = props.username ?? "(no name yet)";
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <li className="card flex items-center justify-between gap-3 rounded-2xl p-3">
      <div className="min-w-0">
        <p className="font-medium">
          <span className={props.username ? "" : "text-muted italic"}>
            {displayName}
          </span>
          {props.isBlocked && (
            <span className="ml-2 text-sm text-danger">blocked</span>
          )}
          {!props.isActivated && (
            <span className="ml-2 text-sm text-muted">not activated</span>
          )}
        </p>
        <p className="truncate text-sm text-muted">{props.email}</p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? (
            <span className="font-mono">{props.accessCode}</span>
          ) : (
            "show code"
          )}
        </button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          className={
            props.isActivated
              ? "field rounded-lg px-3 py-2 text-sm font-medium"
              : "btn-primary rounded-lg px-3 py-2 text-sm font-semibold"
          }
          onClick={async () => {
            setBusy(true);
            await post("/api/admin/activate", {
              playerId: props.id,
              isActivated: !props.isActivated,
            });
            setBusy(false);
            router.refresh();
          }}
        >
          {props.isActivated ? "Deactivate" : "Activate"}
        </button>
        <ConfirmButton
          disabled={busy}
          needsConfirm={!props.isBlocked}
          confirmLabel="Block — sure?"
          className="field rounded-lg px-3 py-2 text-sm font-medium"
          onConfirm={async () => {
            setBusy(true);
            await post("/api/admin/player", {
              playerId: props.id,
              isBlocked: !props.isBlocked,
            });
            setBusy(false);
            router.refresh();
          }}
        >
          {props.isBlocked ? "Unblock" : "Block"}
        </ConfirmButton>
        <ConfirmButton
          disabled={busy}
          confirmLabel="Delete for good?"
          className="rounded-lg px-3 py-2 text-sm font-medium text-danger underline disabled:opacity-50"
          onConfirm={async () => {
            setBusy(true);
            await fetch(`/api/admin/player?id=${encodeURIComponent(props.id)}`, {
              method: "DELETE",
            });
            setBusy(false);
            router.refresh();
          }}
        >
          Delete
        </ConfirmButton>
      </div>
    </li>
  );
}

export function SubmissionRow(props: {
  id: string;
  player: string;
  questId: string;
  kind: string;
  bodyText: string | null;
  mediaUrl: string | null;
  isHidden: boolean;
  contributors: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <li
      className={`card flex items-center justify-between gap-3 rounded-2xl p-3 ${
        props.isHidden ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{props.player}</span>{" "}
          <span className="text-muted">
            · {props.questId} · {props.kind}
          </span>
          {props.isHidden && (
            <span className="ml-2 text-danger">hidden</span>
          )}
        </p>
        {props.contributors.length > 0 && (
          <p className="text-sm text-muted">
            with {props.contributors.join(", ")}
          </p>
        )}
        {props.bodyText && (
          <p className="truncate text-sm text-muted">“{props.bodyText}”</p>
        )}
        {props.mediaUrl && (
          <a
            href={props.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            view media
          </a>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        className="field shrink-0 rounded-lg px-3 py-2 text-sm font-medium"
        onClick={async () => {
          setBusy(true);
          await post("/api/admin/submission", {
            submissionId: props.id,
            isHidden: !props.isHidden,
          });
          setBusy(false);
          router.refresh();
        }}
      >
        {props.isHidden ? "Unhide" : "Hide"}
      </button>
    </li>
  );
}
