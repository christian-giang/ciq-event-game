"use client";

import { useState } from "react";
import { outbox } from "@/lib/outbox/outbox";
import { useOutbox } from "@/components/outbox-provider";

type QuizProps = {
  quest: {
    id: string;
    title: string;
    prompt: string;
    options: { id: string; label: string }[];
    revealAfterAnswer: boolean;
    points: number;
  };
  serverAnswer: {
    chosenOptionId: string;
    isCorrect?: boolean;
    correctOptionId?: string;
  } | null;
};

type AckResponse = {
  chosenOptionId: string;
  isCorrect?: boolean;
  correctOptionId?: string;
};

export function QuizView({ quest, serverAnswer }: QuizProps) {
  const { items } = useOutbox();
  const [selected, setSelected] = useState<string | null>(null);

  // Local outbox state for this quest (answer given on this device but not
  // necessarily synced yet). Survives reloads — the outbox is IndexedDB.
  const local = items.find((i) => i.questId === quest.id);
  const localAck = (local?.response ?? null) as AckResponse | null;

  const answer =
    serverAnswer ??
    (localAck
      ? {
          chosenOptionId: localAck.chosenOptionId,
          isCorrect: localAck.isCorrect,
          correctOptionId: localAck.correctOptionId,
        }
      : local
        ? { chosenOptionId: local.payload.chosenOptionId as string }
        : null);

  const pending =
    !serverAnswer &&
    (local?.status === "queued" || local?.status === "inflight");
  const answered = answer !== null;

  async function lockIn() {
    if (!selected || answered) return;
    await outbox.enqueue({
      kind: "quiz",
      questId: quest.id,
      payload: { chosenOptionId: selected },
    });
    // No further state needed: useOutbox re-renders us with the new item.
  }

  return (
    <div className="space-y-3">
      {quest.options.map((opt) => {
        const isChosen = answered
          ? answer.chosenOptionId === opt.id
          : selected === opt.id;
        const isRevealCorrect =
          answered && answer.correctOptionId === opt.id;

        let cls =
          "card w-full rounded-2xl p-4 text-left text-lg transition-colors";
        if (isRevealCorrect) {
          cls += " border-2 border-sage bg-sage";
        } else if (isChosen) {
          cls += answered
            ? answer.correctOptionId
              ? " border-2 border-accent bg-blush opacity-70"
              : " border-2 border-accent bg-blush"
            : " border-2 border-accent bg-blush";
        }

        return (
          <button
            key={opt.id}
            type="button"
            disabled={answered}
            className={cls}
            onClick={() => setSelected(opt.id)}
          >
            {opt.label}
            {isChosen && <span className="float-right">←&nbsp;you</span>}
            {isRevealCorrect && <span className="float-right">✓</span>}
          </button>
        );
      })}

      {!answered && (
        <button
          type="button"
          disabled={!selected}
          className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
          onClick={lockIn}
        >
          Lock in my answer
        </button>
      )}
      {!answered && (
        <p className="text-center text-sm text-muted">
          First answer counts — no changing your mind after this!
        </p>
      )}

      {pending && (
        <p className="rounded-lg bg-sand p-3 text-center text-sm">
          Answer saved on this phone — syncing…{" "}
          {quest.revealAfterAnswer && "The result appears once it's through."}
        </p>
      )}

      {local?.status === "rejected" && !serverAnswer && (
        <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
          {local.lastError ?? "This answer couldn't be submitted."}
        </p>
      )}

      {answered && !pending && quest.revealAfterAnswer && (
        <p
          className={`rounded-lg p-3 text-center font-medium ${
            answer.isCorrect ? "bg-sage" : "bg-blush"
          }`}
        >
          {answer.isCorrect
            ? `Correct! +${quest.points} points`
            : "Not this time — no points."}
        </p>
      )}
      {answered && !pending && !quest.revealAfterAnswer && (
        <p className="rounded-lg bg-sand p-3 text-center text-sm">
          Answer locked in. All will be revealed later this evening…
        </p>
      )}
    </div>
  );
}
