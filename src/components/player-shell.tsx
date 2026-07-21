"use client";

import Link from "next/link";
import { useState } from "react";
import { schedule } from "@/content/schedule";
import { Avatar } from "./avatar";
import { QueueIndicator } from "./queue-indicator";

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1.5a3 3 0 0 0 3 3M17 6h3v1.5a3 3 0 0 0-3 3" />
    </svg>
  );
}

/**
 * Shared chrome for every player-facing screen: a header (home + profile),
 * the offline queue banner, the page content, and a fixed footer (Schedule
 * modal + Board). Client component so it can own the schedule modal — the
 * server-rendered page content is passed straight through as children.
 */
export function PlayerShell({
  username,
  avatarUrl,
  children,
  activated = true,
}: {
  username: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
  /** When false, the Board button is disabled (player not activated yet). */
  activated?: boolean;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-40">
        <QueueIndicator />
        <header className="border-b border-line bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2.5">
            <Link
              href="/quests"
              aria-label="Home"
              className="field flex h-10 w-10 items-center justify-center rounded-full"
            >
              <HomeIcon />
            </Link>
            <Link
              href="/quests"
              className="min-w-0 truncate text-center font-heading text-xl"
            >
              Combat IQ
            </Link>
            <Link
              href="/me"
              aria-label="My profile"
              className="flex h-10 max-w-[45%] items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3"
            >
              <Avatar name={username} avatarUrl={avatarUrl} size={32} />
              <span className="hidden truncate text-sm font-medium sm:inline">
                {username}
              </span>
            </Link>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-6">
        {children}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="field flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium"
          >
            <CalendarIcon />
            Schedule
          </button>
          {activated ? (
            <Link
              href="/leaderboard"
              className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold"
            >
              <TrophyIcon />
              Board
            </Link>
          ) : (
            <div
              aria-disabled="true"
              title="Unlocks once a host activates you"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 font-semibold text-muted opacity-60"
            >
              <TrophyIcon />
              Board
            </div>
          )}
        </div>
      </footer>

      {scheduleOpen && (
        <ScheduleModal onClose={() => setScheduleOpen(false)} />
      )}
    </div>
  );
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-caps text-xs">The event</p>
            <h2 className="text-2xl">Schedule</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="text-2xl text-muted"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <ol className="space-y-1">
          {schedule.map((item) => (
            <li
              key={`${item.time}-${item.title}`}
              className="flex gap-4 border-b border-line py-3 last:border-0"
            >
              <span className="w-24 shrink-0 font-heading text-base leading-snug text-accent">
                {item.time}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.title}</p>
                {item.detail && (
                  <p className="text-sm text-muted">{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-center text-xs text-muted">
          Times are approximate — go with the flow ♥
        </p>
      </div>
    </div>
  );
}
