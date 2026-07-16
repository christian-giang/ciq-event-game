import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { quizAnswers, submissions } from "@/db/schema";
import { getVisibleQuests, getVotingQuests } from "@/lib/quests";
import { getCurrentPlayer } from "@/lib/auth";
import { PlayerShell } from "@/components/player-shell";
import { QuestBrowser } from "./quest-browser";
import { TypeProgress } from "./type-progress";

const TYPES = [
  { key: "quiz", label: "Quiz", icon: "🧠" },
  { key: "text", label: "Write", icon: "✍️" },
  { key: "media", label: "Camera", icon: "📷" },
] as const;

type TypeKey = (typeof TYPES)[number]["key"];

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  if (!player.username) redirect("/me"); // finish onboarding first

  const [activeQuests, votingQuests, answers, subs] = await Promise.all([
    getVisibleQuests(),
    getVotingQuests(),
    db.query.quizAnswers.findMany({
      where: eq(quizAnswers.playerId, player.id),
      columns: { questId: true },
    }),
    db.query.submissions.findMany({
      where: eq(submissions.playerId, player.id),
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

  // --- Main menu: 2×2 matrix ---
  if (!selected) {
    return (
      <PlayerShell username={player.username}>
        <p className="label-caps mb-1">Welcome</p>
        <h1 className="mb-6 text-3xl">{player.username}</h1>

        <div className="grid grid-cols-2 gap-3">
          {TYPES.map((type) => {
            const questsOfType = activeQuests.filter(
              (q) => q.type === type.key,
            );
            return (
              <Link
                key={type.key}
                href={`/quests?t=${type.key}`}
                className="card flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-transform active:scale-[0.98]"
              >
                <span className="text-5xl">{type.icon}</span>
                <span className="text-xl font-medium">{type.label}</span>
                <TypeProgress
                  questIds={questsOfType.map((q) => q.id)}
                  serverDoneIds={questsOfType
                    .filter((q) => doneQuestIds.has(q.id))
                    .map((q) => q.id)}
                />
              </Link>
            );
          })}

          <Link
            href="/vote"
            className="card flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-transform active:scale-[0.98]"
          >
            <span className="text-5xl">🗳️</span>
            <span className="text-xl font-medium">Vote</span>
            {votingQuests.length > 0 ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-sm font-semibold text-white">
                {votingQuests.length} open now
              </span>
            ) : (
              <span className="text-sm text-muted">nothing yet</span>
            )}
          </Link>
        </div>
      </PlayerShell>
    );
  }

  // --- Quest list for the selected type ---
  const type = TYPES.find((x) => x.key === selected)!;
  const questsOfType = activeQuests.filter((q) => q.type === selected);

  return (
    <PlayerShell username={player.username}>
      <h1 className="mb-6 text-3xl">
        {type.icon} {type.label}
      </h1>

      {questsOfType.length === 0 ? (
        <p className="card rounded-2xl p-6 text-center text-muted">
          No {type.label.toLowerCase()} quests are open yet — check back soon!
        </p>
      ) : (
        <QuestBrowser
          quests={questsOfType.map((quest) => ({
            id: quest.id,
            title: quest.title,
            prompt: quest.prompt,
            state: quest.state,
            done: doneQuestIds.has(quest.id),
          }))}
        />
      )}
    </PlayerShell>
  );
}
