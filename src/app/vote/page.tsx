import Link from "next/link";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { players, submissions, votes } from "@/db/schema";
import { getVotingQuests } from "@/lib/quests";
import { getCurrentPlayer } from "@/lib/auth";
import { seededShuffle } from "@/lib/shuffle";
import { PlayerShell } from "@/components/player-shell";
import { SectionInfo } from "../quests/section-info";
import { VoteFeed } from "./vote-feed";

export default async function VotePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  if (!player.username) redirect("/me");
  if (!player.isActivated) redirect("/quests");
  const playerId = player.id;

  // Only quests whose voting window is open right now.
  const votable = await getVotingQuests();
  if (votable.length === 0) {
    return (
      <PlayerShell username={player.username} avatarUrl={player.avatarUrl}>
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-3xl">🗳️ Vote</h1>
          <SectionInfo section="vote" />
        </div>
        <p className="card rounded-2xl p-6 text-center text-muted">
          Nothing is up for voting right now — the hosts open voting on each
          quest during the evening. Check back soon!
        </p>
      </PlayerShell>
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
      avatarUrl: players.avatarUrl,
      contributorIds: submissions.contributorIds,
    })
    .from(submissions)
    .innerJoin(players, eq(players.id, submissions.playerId))
    .where(
      and(
        eq(submissions.questId, quest.id),
        eq(submissions.isHidden, false),
        // Own submissions — and ones you're credited on — are excluded from
        // your feed (both are also rejected server-side).
        ne(submissions.playerId, playerId),
        sql`NOT (${submissions.contributorIds} @> ${JSON.stringify([playerId])}::jsonb)`,
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

  // Resolve co-contributor usernames for display.
  const contribIds = [...new Set(rows.flatMap((r) => r.contributorIds ?? []))];
  const nameById = new Map<string, string>();
  if (contribIds.length) {
    const names = await db
      .select({ id: players.id, username: players.username })
      .from(players)
      .where(inArray(players.id, contribIds));
    for (const n of names) if (n.username) nameById.set(n.id, n.username);
  }

  // Stable per-player order; no bias toward early submitters.
  const shuffled = seededShuffle(rows, `${playerId}:${quest.id}`);
  const feed = shuffled.map((r) => ({
    ...r,
    contributors: (r.contributorIds ?? [])
      .map((id) => nameById.get(id))
      .filter((n): n is string => !!n),
  }));

  const prev = votable[(index - 1 + votable.length) % votable.length];
  const next = votable[(index + 1) % votable.length];

  return (
    <PlayerShell username={player.username} avatarUrl={player.avatarUrl}>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-3xl">🗳️ Vote</h1>
        <SectionInfo section="vote" />
      </div>

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
            {index + 1} / {votable.length}
          </p>
          <h2 className="truncate text-2xl">{quest.title}</h2>
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
        key={quest.id}
        submissions={feed}
        initialVoted={myVotes.map((v) => v.submissionId)}
        cap={quest.voting.votesPerPlayer}
      />
    </PlayerShell>
  );
}
