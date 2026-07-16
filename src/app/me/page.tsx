import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { players, submissions } from "@/db/schema";
import { getPlayerRank } from "@/lib/leaderboard";
import { getQuests } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { PlayerNav } from "@/components/player-nav";
import { QueueIndicator } from "@/components/queue-indicator";
import { CodeReveal, LogoutButton, MySubmission } from "./me-controls";

export default async function MePage() {
  const playerId = await getPlayerId();
  if (!playerId) redirect("/");

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) redirect("/");

  const [mySubmissions, quests, rank] = await Promise.all([
    db.query.submissions.findMany({
      where: eq(submissions.playerId, playerId),
      orderBy: desc(submissions.createdAt),
    }),
    getQuests(),
    getPlayerRank(playerId),
  ]);
  const questTitle = new Map(quests.map((q) => [q.id, q.title]));

  return (
    <>
      <QueueIndicator />
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">
        <p className="label-caps mb-1">You are</p>
        <h1 className="mb-1 text-3xl">{player.username}</h1>
        {rank && (
          <p className="mb-6 text-muted">
            Rank {rank.rank} · {rank.points} points
          </p>
        )}

        <section className="card mb-6 rounded-2xl p-4">
          <p className="label-caps mb-2 text-xs">Your access code</p>
          <CodeReveal code={player.accessCode} />
          <p className="mt-2 text-sm text-muted">
            This code is how you log in on another device (or after clearing
            your browser). Keep it to yourself.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl">Your submissions</h2>
          {mySubmissions.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing yet — go do some quests!
            </p>
          ) : (
            <ul className="space-y-2">
              {mySubmissions.map((s) => (
                <MySubmission
                  key={s.id}
                  id={s.id}
                  questTitle={questTitle.get(s.questId) ?? s.questId}
                  kind={s.kind}
                  bodyText={s.bodyText}
                  mediaUrl={s.mediaUrl}
                  isHidden={s.isHidden}
                />
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">
            Deleting a submission removes it for everyone, immediately and
            for good.
          </p>
        </section>

        <div className="mt-8">
          <LogoutButton />
        </div>

        <PlayerNav active="me" />
      </main>
    </>
  );
}
