"use client";

import { useState } from "react";
import { outbox } from "@/lib/outbox/outbox";
import { useOutbox } from "@/components/outbox-provider";

type QuizProps = {
  quest: {
    id: string;
    options: { id: string; label: string }[];
    points: number;
  };
  // The server only includes correctOptionId / isCorrect once the quest is
  // COMPLETED. Before that, answering just records the choice — no reveal.
  serverAnswer: {
    chosenOptionId: string;
    isCorrect?: boolean;
    correctOptionId?: string;
  } | null;
};

export function QuizView({ quest, serverAnswer }: QuizProps) {
  const { items } = useOutbox();
  const [selected, setSelected] = useState<string | null>(null);

  // Answer given on this device but maybe not yet synced (survives reloads).
  const local = items.find(
    (i) => i.kind === "quiz" && i.questId === quest.id,
  );
  const localChosen = local ? (local.payload.chosenOptionId as string) : null;

  const chosenOptionId = serverAnswer?.chosenOptionId ?? localChosen ?? null;
  const answered = chosenOptionId !== null;
  const pending =
    !serverAnswer &&
    (local?.status === "queued" || local?.status === "inflight");
  const rejected = !serverAnswer && local?.status === "rejected";

  // Reveal is ONLY available when the server sent the correct answer, which
  // it does exclusively for completed quests.
  const correctOptionId = serverAnswer?.correctOptionId ?? null;
  const revealed = correctOptionId !== null;

  async function lockIn() {
    if (!selected || answered) return;
    await outbox.enqueue({
      kind: "quiz",
      questId: quest.id,
      payload: { chosenOptionId: selected },
    });
  }

  return (
    <div className="space-y-3">
      {quest.options.map((opt) => {
        const isChosen = answered
          ? chosenOptionId === opt.id
          : selected === opt.id;
        const isRevealCorrect = revealed && correctOptionId === opt.id;

        let cls =
          "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-lg transition-colors";
        let dot = "border-line";
        if (isRevealCorrect) {
          cls += " border-sage bg-sage";
          dot = "border-sage bg-white";
        } else if (isChosen) {
          // Your selection (before or after locking in) — coral highlight.
          cls += " border-accent bg-accent text-white";
          dot = "border-white bg-white";
        } else {
          cls += " border-line bg-card";
        }

        return (
          <button
            key={opt.id}
            type="button"
            disabled={answered}
            className={cls}
            onClick={() => setSelected(opt.id)}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}
            >
              {isChosen && <span className="h-2 w-2 rounded-full bg-accent" />}
            </span>
            <span className="flex-1">{opt.label}</span>
            {isRevealCorrect && <span className="shrink-0">✓</span>}
          </button>
        );
      })}

      {!answered && (
        <>
          <button
            type="button"
            disabled={!selected}
            className="btn-primary w-full rounded-lg px-5 py-3 font-semibold"
            onClick={lockIn}
          >
            Lock in my answer
          </button>
          <p className="text-center text-sm text-muted">
            First answer counts — no changing your mind after this!
          </p>
        </>
      )}

      {pending && (
        <p className="rounded-lg bg-sand p-3 text-center text-sm">
          Answer saved on this phone — syncing…
        </p>
      )}

      {rejected && (
        <p className="rounded-lg bg-blush p-3 text-center text-sm text-danger">
          {local?.lastError ?? "This answer couldn't be submitted."}
        </p>
      )}

      {/* Locked in, not yet revealed — the game master reveals at the end. */}
      {answered && !pending && !revealed && (
        <p className="rounded-lg bg-sand p-3 text-center text-sm">
          Answer locked in 🔒 — the result is revealed when the hosts close
          this quiz.
        </p>
      )}

      {/* Revealed (quest completed). */}
      {revealed && (
        <p
          className={`rounded-lg p-3 text-center font-medium ${
            serverAnswer?.isCorrect ? "bg-sage" : "bg-blush"
          }`}
        >
          {serverAnswer?.isCorrect
            ? `Correct! +${quest.points} points`
            : "Not this time — no points."}
        </p>
      )}
    </div>
  );
}
