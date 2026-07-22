"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Quest, QuestState } from "@/content/quests";
import { ConfirmButton } from "@/components/confirm-button";
import { uploadPicture } from "@/lib/media/client-upload";
import { MediaRejection, processPhoto } from "@/lib/media/process";

const DEFAULT_VOTING = {
  pointsByRank: "12, 8, 5, 3",
  participationPoints: 2,
  minVotesToRank: 8,
  votesPerPlayer: 3,
};

const STATE_META: Record<
  QuestState,
  { label: string; badge: string; description: string }
> = {
  unreleased: {
    label: "Unreleased",
    badge: "bg-paper text-muted border border-line",
    description: "Invisible to players.",
  },
  released: {
    label: "Released",
    badge: "bg-sand",
    description: "Players can see it and submit.",
  },
  voting: {
    label: "Voting",
    badge: "bg-accent text-white",
    description: "Submissions locked; it's in the vote feed.",
  },
  completed: {
    label: "Completed",
    badge: "bg-sage",
    description: "Locked everywhere; counts toward the leaderboard.",
  },
};

/** The one-tap next step for the evening's flow. Quizzes skip voting. */
function nextState(quest: Quest): { state: QuestState; label: string } | null {
  switch (quest.state) {
    case "unreleased":
      return { state: "released", label: "Release" };
    case "released":
      return quest.type === "quiz"
        ? { state: "completed", label: "Complete" }
        : { state: "voting", label: "Open voting" };
    case "voting":
      return { state: "completed", label: "Complete" };
    case "completed":
      return null;
  }
}

type Draft = {
  id: string;
  type: Quest["type"];
  title: string;
  prompt: string;
  order: number;
  state: QuestState;
  imageUrl: string;
  resultImageUrl: string;
  resultText: string;
  // quiz
  options: { id: string; label: string }[];
  correctOptionId: string;
  points: number;
  revealAfterAnswer: boolean;
  // text
  maxChars: number;
  // media
  mediaKind: "photo" | "video" | "either";
  maxDurationSec: number;
  // voting (text + media)
  pointsByRank: string;
  participationPoints: number;
  minVotesToRank: number;
  votesPerPlayer: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function toDraft(quest: Quest | null, nextOrder: number): Draft {
  const base: Draft = {
    id: "",
    type: "text",
    title: "",
    prompt: "",
    order: nextOrder,
    state: "unreleased",
    imageUrl: "",
    resultImageUrl: "",
    resultText: "",
    options: [
      { id: "opt-1", label: "" },
      { id: "opt-2", label: "" },
    ],
    correctOptionId: "opt-1",
    points: 5,
    revealAfterAnswer: true,
    maxChars: 280,
    mediaKind: "photo",
    maxDurationSec: 15,
    ...DEFAULT_VOTING,
  };
  if (!quest) return base;

  const draft: Draft = {
    ...base,
    id: quest.id,
    type: quest.type,
    title: quest.title,
    prompt: quest.prompt,
    order: quest.order,
    state: quest.state,
    imageUrl: quest.imageUrl ?? "",
    resultImageUrl: quest.resultImageUrl ?? "",
    resultText: quest.resultText ?? "",
  };
  if (quest.type === "quiz") {
    draft.options = quest.options.map((o) => ({ ...o }));
    draft.correctOptionId = quest.correctOptionId;
    draft.points = quest.points;
    draft.revealAfterAnswer = quest.revealAfterAnswer;
  } else {
    draft.pointsByRank = quest.voting.pointsByRank.join(", ");
    draft.participationPoints = quest.voting.participationPoints;
    draft.minVotesToRank = quest.voting.minVotesToRank;
    draft.votesPerPlayer = quest.voting.votesPerPlayer;
    if (quest.type === "text") {
      draft.maxChars = quest.maxChars;
    } else {
      draft.mediaKind = quest.mediaKind;
      draft.maxDurationSec = quest.maxDurationSec ?? 15;
    }
  }
  return draft;
}

function draftToQuest(d: Draft): unknown {
  const base = {
    id: d.id || slugify(d.title),
    order: Number(d.order),
    title: d.title.trim(),
    prompt: d.prompt.trim(),
    state: d.state,
    ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
    ...(d.resultImageUrl ? { resultImageUrl: d.resultImageUrl } : {}),
    ...(d.resultText.trim() ? { resultText: d.resultText.trim() } : {}),
  };
  const voting = {
    pointsByRank: d.pointsByRank
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n)),
    participationPoints: Number(d.participationPoints),
    minVotesToRank: Number(d.minVotesToRank),
    votesPerPlayer: Number(d.votesPerPlayer),
  };
  switch (d.type) {
    case "quiz":
      return {
        ...base,
        type: "quiz",
        options: d.options
          .filter((o) => o.label.trim())
          .map((o) => ({ id: o.id, label: o.label.trim() })),
        correctOptionId: d.correctOptionId,
        points: Number(d.points),
        revealAfterAnswer: d.revealAfterAnswer,
      };
    case "text":
      return { ...base, type: "text", maxChars: Number(d.maxChars), voting };
    case "media":
      return {
        ...base,
        type: "media",
        mediaKind: d.mediaKind,
        ...(d.mediaKind !== "photo"
          ? { maxDurationSec: Number(d.maxDurationSec) }
          : {}),
        voting,
      };
  }
}

const inputCls = "field w-full rounded-lg px-3 py-2";
const labelCls = "mb-1 block text-sm font-medium";

async function saveQuest(quest: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quest),
    });
    if (!res.ok) {
      const data = await res.json();
      return data.error ?? "Could not save.";
    }
    return null;
  } catch {
    return "Network hiccup — try again.";
  }
}

export function QuestsSection({ quests }: { quests: Quest[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const nextOrder = quests.reduce((m, q) => Math.max(m, q.order), 0) + 1;

  async function save(draft: Draft) {
    setBusy(true);
    setError(null);
    const err = await saveQuest(draftToQuest(draft));
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function advance(quest: Quest) {
    const next = nextState(quest);
    if (!next) return;
    setAdvancing(quest.id);
    await saveQuest({ ...quest, state: next.state });
    setAdvancing(null);
    router.refresh();
  }

  async function remove(quest: Quest) {
    setDeleting(quest.id);
    try {
      const res = await fetch(
        `/api/admin/quest?id=${encodeURIComponent(quest.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not delete.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">
          Unreleased → Released → Voting → Completed. Only completed quests
          count on the leaderboard.
        </p>
        <button
          type="button"
          className="btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-semibold"
          onClick={() => {
            setIsNew(true);
            setEditing(toDraft(null, nextOrder));
            setError(null);
          }}
        >
          New quest
        </button>
      </div>

      {editing && (
        <QuestModal
          draft={editing}
          setDraft={setEditing}
          isNew={isNew}
          busy={busy}
          error={error}
          onCancel={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      )}

      {error && !editing && (
        <p className="mb-3 rounded-lg bg-blush p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {quests.map((q) => {
          const next = nextState(q);
          return (
            <li
              key={q.id}
              className={`card flex items-center justify-between gap-3 rounded-2xl p-3 ${
                q.state === "unreleased" ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {q.order}. {q.title}{" "}
                  <span className="text-sm text-muted">· {q.type}</span>
                </p>
                <p className="truncate text-sm text-muted">{q.prompt}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_META[q.state].badge}`}
                  title={STATE_META[q.state].description}
                >
                  {STATE_META[q.state].label}
                </span>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                {next && (
                  <ConfirmButton
                    disabled={advancing === q.id}
                    needsConfirm={next.state === "completed"}
                    confirmLabel="Complete — sure?"
                    className="btn-primary rounded-lg px-3 py-2 text-sm font-semibold"
                    onConfirm={() => advance(q)}
                  >
                    {advancing === q.id ? "…" : next.label}
                  </ConfirmButton>
                )}
                <button
                  type="button"
                  className="field rounded-lg px-3 py-2 text-sm font-medium"
                  onClick={() => {
                    setIsNew(false);
                    setEditing(toDraft(q, nextOrder));
                    setError(null);
                  }}
                >
                  Edit
                </button>
                <ConfirmButton
                  disabled={deleting === q.id}
                  confirmLabel="Delete for good?"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-danger underline disabled:opacity-50"
                  onConfirm={() => remove(q)}
                >
                  {deleting === q.id ? "…" : "Delete"}
                </ConfirmButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QuestModal(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  isNew: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      <div className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl">
        <QuestForm {...props} />
      </div>
    </div>
  );
}

function QuestForm(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  isNew: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { draft, setDraft, isNew } = props;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const states: QuestState[] =
    draft.type === "quiz"
      ? ["unreleased", "released", "completed"]
      : ["unreleased", "released", "voting", "completed"];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{isNew ? "New quest" : `Edit: ${draft.id}`}</h3>
        <button
          type="button"
          aria-label="Close"
          className="text-2xl text-muted"
          onClick={props.onCancel}
        >
          ×
        </button>
      </div>

      <div>
        <label className={labelCls}>State</label>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1">
          {states.map((s) => (
            <button
              key={s}
              type="button"
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                draft.state === s ? STATE_META[s].badge : "text-muted"
              }`}
              onClick={() => set({ state: s })}
            >
              {STATE_META[s].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {STATE_META[draft.state].description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select
            className={inputCls}
            value={draft.type}
            disabled={!isNew}
            onChange={(e) => set({ type: e.target.value as Quest["type"] })}
          >
            <option value="quiz">Quiz</option>
            <option value="text">Text</option>
            <option value="media">Photo / video</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Order</label>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={draft.order}
            onChange={(e) => set({ order: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Title</label>
        <input
          className={inputCls}
          required
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Dance like it's 1994"
        />
      </div>

      <div>
        <label className={labelCls}>Prompt (what players read)</label>
        <textarea
          className={inputCls}
          rows={3}
          required
          value={draft.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePicker
          label="Question image (optional)"
          url={draft.imageUrl}
          onChange={(url) => set({ imageUrl: url })}
        />
        <ImagePicker
          label="Result image (optional)"
          url={draft.resultImageUrl}
          onChange={(url) => set({ resultImageUrl: url })}
        />
      </div>

      <div>
        <label className={labelCls}>Result text (optional)</label>
        <textarea
          className={inputCls}
          rows={2}
          value={draft.resultText}
          onChange={(e) => set({ resultText: e.target.value })}
          placeholder="Revealed on the Results board when this quest completes"
        />
      </div>

      {draft.type === "quiz" && (
        <>
          <div>
            <label className={labelCls}>
              Options (pick the correct answer)
            </label>
            <div className="space-y-2">
              {draft.options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={draft.correctOptionId === opt.id}
                    onChange={() => set({ correctOptionId: opt.id })}
                    className="h-5 w-5 shrink-0 accent-accent"
                    title="Correct answer"
                  />
                  <input
                    className={inputCls}
                    value={opt.label}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) => {
                      const options = draft.options.map((o) =>
                        o.id === opt.id ? { ...o, label: e.target.value } : o,
                      );
                      set({ options });
                    }}
                  />
                  <button
                    type="button"
                    className="text-sm text-muted underline"
                    onClick={() => {
                      const options = draft.options.filter(
                        (o) => o.id !== opt.id,
                      );
                      set({
                        options,
                        correctOptionId:
                          draft.correctOptionId === opt.id
                            ? (options[0]?.id ?? "")
                            : draft.correctOptionId,
                      });
                    }}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm underline"
              onClick={() =>
                set({
                  options: [
                    ...draft.options,
                    { id: `opt-${Date.now()}`, label: "" },
                  ],
                })
              }
            >
              + add option
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Points for correct answer</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={draft.points}
                onChange={(e) => set({ points: Number(e.target.value) })}
              />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.revealAfterAnswer}
                onChange={(e) => set({ revealAfterAnswer: e.target.checked })}
                className="h-5 w-5 accent-accent"
              />
              Reveal answer after guessing
            </label>
          </div>
        </>
      )}

      {draft.type === "text" && (
        <div>
          <label className={labelCls}>Max characters</label>
          <input
            type="number"
            min={10}
            max={2000}
            className={inputCls}
            value={draft.maxChars}
            onChange={(e) => set({ maxChars: Number(e.target.value) })}
          />
        </div>
      )}

      {draft.type === "media" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Media kind</label>
            <select
              className={inputCls}
              value={draft.mediaKind}
              onChange={(e) =>
                set({ mediaKind: e.target.value as Draft["mediaKind"] })
              }
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
              <option value="either">Photo or video</option>
            </select>
          </div>
          {draft.mediaKind !== "photo" && (
            <div>
              <label className={labelCls}>Max video seconds</label>
              <input
                type="number"
                min={5}
                max={15}
                className={inputCls}
                value={draft.maxDurationSec}
                onChange={(e) =>
                  set({ maxDurationSec: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>
      )}

      {draft.type !== "quiz" && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Voting & points (defaults are fine)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Points by rank (1st, 2nd, …)</label>
              <input
                className={inputCls}
                value={draft.pointsByRank}
                onChange={(e) => set({ pointsByRank: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Participation points</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={draft.participationPoints}
                onChange={(e) =>
                  set({ participationPoints: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Min votes to rank</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={draft.minVotesToRank}
                onChange={(e) =>
                  set({ minVotesToRank: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Votes per player</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={draft.votesPerPlayer}
                onChange={(e) =>
                  set({ votesPerPlayer: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </details>
      )}

      {props.error && <p className="text-sm text-danger">{props.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.busy}
          className="btn-primary rounded-lg px-5 py-2 font-semibold"
        >
          {props.busy ? "Saving…" : "Save quest"}
        </button>
        <button
          type="button"
          className="field rounded-lg px-5 py-2 font-medium"
          onClick={props.onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Upload a single optional picture (downscaled) and hand back its URL. */
function ImagePicker({
  label,
  url,
  onChange,
}: {
  label: string;
  url: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await processPhoto(file);
      onChange(await uploadPicture(blob));
    } catch (e) {
      setErr(
        e instanceof MediaRejection ? e.message : "Couldn't upload that image.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="mb-2 max-h-40 w-full rounded-lg object-contain"
        />
      )}
      <div className="flex items-center gap-3">
        <label className="field cursor-pointer rounded-lg px-3 py-2 text-sm font-medium">
          {busy ? "Uploading…" : url ? "Change" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {url && (
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
    </div>
  );
}
