"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { QuestState } from "@/content/quests";
import { QuestBadge } from "./quest-badge";

export type QuestSummary = {
  id: string;
  title: string;
  prompt: string;
  state: QuestState;
  done: boolean;
};

const VIEW_KEY = "wg_quest_view";
type View = "list" | "carousel";

/** Quest state (host-controlled) as a soft pill — distinct from the
 *  player's own completion circle. */
function StateChip({ state }: { state: QuestState }) {
  if (state === "voting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-xs font-semibold text-accent ring-1 ring-inset ring-accent/25">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Voting open
      </span>
    );
  }
  if (state === "completed") {
    return (
      <span className="inline-flex items-center rounded-full bg-sage px-3 py-1 text-xs font-semibold text-ink">
        Finished
      </span>
    );
  }
  return null;
}

function ListCard({ quest }: { quest: QuestSummary }) {
  return (
    <Link
      href={`/quests/${quest.id}`}
      className="card block rounded-2xl p-4 transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">{quest.title}</h2>
          <p className="mt-1 text-sm text-muted">{quest.prompt}</p>
        </div>
        <QuestBadge questId={quest.id} serverDone={quest.done} />
      </div>
      {quest.state !== "released" && (
        <div className="mt-3">
          <StateChip state={quest.state} />
        </div>
      )}
    </Link>
  );
}

function CarouselCard({ quest }: { quest: QuestSummary }) {
  return (
    <Link
      href={`/quests/${quest.id}`}
      className="card flex h-full flex-col rounded-3xl p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps text-xs">Quest</span>
        <QuestBadge questId={quest.id} serverDone={quest.done} />
      </div>
      <h2 className="mt-3 font-heading text-3xl leading-tight">
        {quest.title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted">{quest.prompt}</p>
      <div className="flex-1" />
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="font-medium text-accent">Open this quest →</span>
        <StateChip state={quest.state} />
      </div>
    </Link>
  );
}

export function QuestBrowser({ quests }: { quests: QuestSummary[] }) {
  const [view, setView] = useState<View>("list");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "carousel" || saved === "list") setView(saved);
  }, []);

  function pick(next: View) {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div
          role="tablist"
          aria-label="View"
          className="inline-flex gap-1 rounded-full border border-line bg-paper p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            onClick={() => pick("list")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
              view === "list" ? "bg-accent text-white shadow" : "text-muted"
            }`}
          >
            <ListIcon />
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "carousel"}
            onClick={() => pick("carousel")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
              view === "carousel" ? "bg-accent text-white shadow" : "text-muted"
            }`}
          >
            <CarouselIcon />
            Cards
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ul className="space-y-3">
          {quests.map((quest) => (
            <li key={quest.id}>
              <ListCard quest={quest} />
            </li>
          ))}
        </ul>
      ) : (
        <Carousel quests={quests} />
      )}
    </>
  );
}

function Carousel({ quests }: { quests: QuestSummary[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Track which card is nearest the centre so it can pop forward while the
  // neighbours shrink and tuck behind it (coverflow-style overlap).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = scroller.scrollLeft + scroller.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          const c = el.offsetLeft + el.offsetWidth / 2;
          const d = Math.abs(c - center);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setActive(best);
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [quests.length]);

  return (
    <div
      ref={scrollerRef}
      aria-label="Quest cards — swipe sideways"
      className="-mx-4 flex h-[60vh] snap-x snap-mandatory items-stretch overflow-x-auto px-[13%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {quests.map((quest, i) => (
        <div
          key={quest.id}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          // z-index on the wrapper (a flex item, so it always honours
          // z-index): active card on top, neighbours layered progressively
          // behind on both sides.
          style={{ zIndex: 20 - Math.abs(i - active) }}
          className="relative -ml-[9%] w-[74%] shrink-0 snap-center py-2 first:ml-0"
        >
          <div
            className={`h-full transition-all duration-300 ease-out ${
              i === active
                ? "scale-100 opacity-100"
                : "scale-[0.86] opacity-70"
            }`}
          >
            <CarouselCard quest={quest} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function CarouselIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <rect x="8" y="6" width="8" height="12" rx="1.5" />
      <path d="M4 8v8M20 8v8" />
    </svg>
  );
}
