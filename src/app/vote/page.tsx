import Link from "next/link";
import { and, eq, inArray, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { players, submissions, votes } from "@/db/schema";
import { getVotingQuests } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { seededShuffle } from "@/lib/shuffle";
import { PlayerNav } from "@/components/player-nav";
import { QueueIndicator } from "@/components/queue-indicator";
import { VoteFeed } from "./vote-feed";

export default async function VotePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const playerId = await getPlayerId();
  if (!playerId) redirect("/");

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) redirect("/");

  // Only quests whose voting window is open right now.
  const votable = await getVotingQuests();
  if (votable.length === 0) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">
        <h1 className="mb-4 text-3xl">Vote</h1>
        <p className="text-muted">
          Nothing is up for voting right now — the hosts open voting on each
          quest during the evening. Check back soon!
        </p>
        <PlayerNav active="vote" />
      </main>
    );
  }

  const { q } = await searchParams;
  const index = Math.max(
    0,
    votable.findIndex((quest) => quest.id === q),
  );
  const quest = votable[index];

  const rows = await db
    .select({
      id: submissions.id,
      bodyText: submissions.bodyText,
      mediaUrl: submissions.mediaUrl,
      kind: submissions.kind,
      username: players.username,
    })
    .from(submissions)
    .innerJoin(players, eq(players.id, submissions.playerId))
    .where(
      and(
        eq(submissions.questId, quest.id),
        eq(submissions.isHidden, false),
        // Own submissions are excluded from your feed (self-votes are also
        // rejected server-side).
        ne(submissions.playerId, playerId),
      ),
    );

  const questSubmissionIds = db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.questId, quest.id));
  const myVotes = await db
    .select({ submissionId: votes.submissionId })
    .from(votes)
    .where(
      and(
        eq(votes.voterId, playerId),
        inArray(votes.submissionId, questSubmissionIds),
      ),
    );

  // Stable per-player order; no bias toward early submitters.
  const shuffled = seededShuffle(rows, `${playerId}:${quest.id}`);

  const prev = votable[(index - 1 + votable.length) % votable.length];
  const next = votable[(index + 1) % votable.length];

  return (
    <>
      <QueueIndicator />
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-8">

        <div className="mb-1 flex items-center justify-between gap-2">
          <Link
            href={`/vote?q=${prev.id}`}
            aria-label="Previous quest"
            className="field rounded-lg px-3 py-2"
          >
            ‹
          </Link>
          <div className="min-w-0 text-center">
            <p className="label-caps text-xs">
              Vote · {index + 1} / {votable.length}
            </p>
            <h1 className="truncate text-2xl">{quest.title}</h1>
          </div>
          <Link
            href={`/vote?q=${next.id}`}
            aria-label="Next quest"
            className="field rounded-lg px-3 py-2"
          >
            ›
          </Link>
        </div>
        <p className="mb-4 text-center text-sm text-muted">{quest.prompt}</p>

        <VoteFeed
          submissions={shuffled}
          initialVoted={myVotes.map((v) => v.submissionId)}
          cap={quest.voting.votesPerPlayer}
        />
        <PlayerNav active="vote" />
      </main>
    </>
  );
}
