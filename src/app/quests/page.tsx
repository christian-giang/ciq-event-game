import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { players, quizAnswers, submissions } from "@/db/schema";
import { getVisibleQuests } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { PlayerNav } from "@/components/player-nav";
import { QueueIndicator } from "@/components/queue-indicator";
import { QuestBadge } from "./quest-badge";

const TYPES = [
  {
    key: "quiz",
    label: "Quiz",
    icon: "🧠",
    blurb: "How well do you know the couple?",
  },
  {
    key: "text",
    label: "Write",
    icon: "✍️",
    blurb: "Advice, toasts and predictions.",
  },
  {
    key: "media",
    label: "Camera",
    icon: "📷",
    blurb: "Photo and video missions.",
  },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const playerId = await getPlayerId();
  if (!playerId) redirect("/");

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) redirect("/");

  const [activeQuests, answers, subs] = await Promise.all([
    getVisibleQuests(),
    db.query.quizAnswers.findMany({
      where: eq(quizAnswers.playerId, playerId),
      columns: { questId: true },
    }),
    db.query.submissions.findMany({
      where: eq(submissions.playerId, playerId),
      columns: { questId: true },
    }),
  ]);

  const doneQuestIds = new Set([
    ...answers.map((a) => a.questId),
    ...subs.map((s) => s.questId),
  ]);

  const { t } = await searchParams;
  const selected: TypeKey | null = TYPES.some((x) => x.key === t)
    ? (t as TypeKey)
    : null;

  // --- Type picker ---
  if (!selected) {
    return (
      <>
        <QueueIndicator />
        <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">
          <p className="label-caps mb-1">Playing as</p>
          <h1 className="mb-6 text-3xl">{player.username}</h1>

          <ul className="space-y-3">
            {TYPES.map((type) => {
              const questsOfType = activeQuests.filter(
                (q) => q.type === type.key,
              );
              if (questsOfType.length === 0) return null;
              const done = questsOfType.filter((q) =>
                doneQuestIds.has(q.id),
              ).length;
              const allDone = done === questsOfType.length;
              return (
                <li key={type.key}>
                  <Link
                    href={`/quests?t=${type.key}`}
                    className="card block rounded-2xl p-5 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{type.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-2xl">{type.label}</h2>
                        <p className="text-sm text-muted">{type.blurb}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`font-semibold ${allDone ? "" : "text-muted"}`}
                        >
                          {done}/{questsOfType.length}
                          {allDone && " ✓"}
                        </p>
                        <p className="text-xs text-muted">done</p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <PlayerNav active="quests" />
        </main>
      </>
    );
  }

  // --- Quest list for the selected type ---
  const type = TYPES.find((x) => x.key === selected)!;
  const questsOfType = activeQuests.filter((q) => q.type === selected);

  return (
    <>
      <QueueIndicator />
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">
        <Link href="/quests" className="mb-4 inline-block text-sm underline">
          ← All quest types
        </Link>
        <h1 className="mb-6 text-3xl">
          {type.icon} {type.label}
        </h1>

        <ul className="space-y-3">
          {questsOfType.map((quest) => (
            <li key={quest.id}>
              <Link
                href={`/quests/${quest.id}`}
                className="card block rounded-2xl p-4 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl">{quest.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {quest.prompt}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {quest.state === "voting" && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                        Voting open
                      </span>
                    )}
                    {quest.state === "completed" && (
                      <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold">
                        Finished
                      </span>
                    )}
                    <QuestBadge
                      questId={quest.id}
                      serverDone={doneQuestIds.has(quest.id)}
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <PlayerNav active="quests" />
      </main>
    </>
  );
}
