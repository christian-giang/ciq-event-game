"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { outbox } from "@/lib/outbox/outbox";
import { useOutbox } from "@/components/outbox-provider";

type TextProps = {
  quest: { id: string; maxChars: number };
  serverSubmission: { bodyText: string } | null;
};

type AckResponse = { bodyText?: string };

export function TextView({ quest, serverSubmission }: TextProps) {
  const { items } = useOutbox();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Newest local text item for this quest (items are sorted newest-first).
  const local = items.find(
    (i) => i.kind === "text" && i.questId === quest.id,
  );
  const localAck = (local?.response ?? null) as AckResponse | null;

  const pendingText =
    local && (local.status === "queued" || local.status === "inflight")
      ? (local.payload.bodyText as string)
      : null;

  const currentText =
    pendingText ??
    localAck?.bodyText ??
    (local?.status === "done"
      ? (local.payload.bodyText as string)
      : serverSubmission?.bodyText) ??
    serverSubmission?.bodyText ??
    null;

  const hasSubmission = currentText !== null;
  const pending = pendingText !== null;
  const overLimit = draft.length > quest.maxChars;

  async function submit() {
    const text = draft.trim();
    if (!text || overLimit) return;
    await outbox.enqueue({
      kind: "text",
      questId: quest.id,
      payload: { bodyText: text },
    });
    track("submission_created", { type: "text", questId: quest.id });
    setDraft("");
    setEditing(false);
  }

  if (hasSubmission && !editing) {
    return (
      <div className="space-y-3">
        <div className="card rounded-2xl p-4">
          <p className="label-caps mb-2 text-xs">Your answer</p>
          <p className="whitespace-pre-wrap leading-relaxed">{currentText}</p>
        </div>

        {pending && (
          <p className="rounded-lg bg-sand p-3 text-center text-sm">
            Saved on this phone — syncing…
          </p>
        )}
        {local?.status === "rejected" && (
          <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
            {local.lastError ?? "This couldn't be submitted."} Edit and try
            again.
          </p>
        )}

        <button
          type="button"
          className="field w-full rounded-lg px-4 py-3 font-medium"
          onClick={() => {
            setDraft(currentText ?? "");
            setEditing(true);
          }}
        >
          Replace my answer
        </button>
        <p className="text-center text-sm text-muted">
          Replacing removes any votes you&apos;ve already received on it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        className="field w-full rounded-lg px-4 py-3"
        rows={4}
        maxLength={quest.maxChars + 50}
        placeholder="Write it here…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p
        className={`text-right text-sm ${
          overLimit ? "font-semibold text-danger" : "text-muted"
        }`}
      >
        {draft.length} / {quest.maxChars}
      </p>
      {overLimit && (
        <p className="text-sm text-danger">
          That&apos;s {draft.length} characters — this quest allows{" "}
          {quest.maxChars}.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!draft.trim() || overLimit}
          className="btn-primary flex-1 rounded-lg px-5 py-3 font-semibold"
          onClick={submit}
        >
          {hasSubmission ? "Replace answer" : "Submit"}
        </button>
        {editing && (
          <button
            type="button"
            className="field rounded-lg px-5 py-3 font-medium"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-center text-sm text-muted">
        Saved instantly on your phone — it syncs whenever the wifi allows.
      </p>
    </div>
  );
}
