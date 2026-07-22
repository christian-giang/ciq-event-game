"use client";

import { useState } from "react";

type Section = "quiz" | "text" | "media" | "vote";

const CONTENT: Record<Section, { title: string; lines: string[] }> = {
  quiz: {
    title: "🧠 Quiz — how points work",
    lines: [
      "Your first answer is locked in — choose carefully, you can't change it.",
      "A correct answer earns the quiz's points (usually 1).",
      "The correct answer is revealed only when the hosts close the quiz.",
    ],
  },
  text: {
    title: "✍️ Write — how points work",
    lines: [
      "Write your entry, then everyone votes on all the entries.",
      "The most-voted entries win: 1st, 2nd and 3rd earn the most points; taking part still earns a participation point.",
      "Group task? One person submits and tags the team — everyone tagged gets the same points.",
    ],
  },
  media: {
    title: "📷 Camera — how points work",
    lines: [
      "Take a photo or video, then everyone votes on the entries.",
      "Ranked by votes: 1st, 2nd and 3rd earn the most points; taking part still earns a participation point.",
      "Group task? Tag your teammates when you submit so everyone gets the points.",
    ],
  },
  vote: {
    title: "🗳️ Vote — how points work",
    lines: [
      "When a quest is open for voting, spend your votes on the entries you like best.",
      "You earn 1 point for every quest you vote on.",
      "You can't vote for your own entry — or ones you're tagged on.",
    ],
  },
};

export function SectionInfo({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const c = CONTENT[section];

  return (
    <>
      <button
        type="button"
        aria-label="How points work"
        onClick={() => setOpen(true)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 11v5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="8" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-2xl">{c.title}</h2>
              <button
                type="button"
                aria-label="Close"
                className="text-2xl text-muted"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <ul className="space-y-2">
              {c.lines.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="text-accent">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
