import { redirect } from "next/navigation";
import {
  getLeaderboards,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import { getCurrentPlayer } from "@/lib/auth";
import { getLeaderboardMode, isFrozen } from "@/lib/settings";
import { Avatar } from "@/components/avatar";
import { BoardTabs } from "@/components/board-tabs";
import { PlayerShell } from "@/components/player-shell";

function Row({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  return (
    <li
      className={`card flex items-center gap-3 rounded-2xl p-3 ${
        isMe ? "border-2 border-accent" : ""
      }`}
    >
      <span
        className={`w-8 shrink-0 text-center font-heading text-2xl ${
          entry.rank <= 3 ? "" : "text-muted"
        }`}
      >
        {entry.rank === 1
          ? "🥇"
          : entry.rank === 2
            ? "🥈"
            : entry.rank === 3
              ? "🥉"
              : entry.rank}
      </span>
      <Avatar name={entry.username} avatarUrl={entry.avatarUrl} size={36} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {entry.username}
        {isMe && <span className="ml-2 text-sm text-muted">(you)</span>}
      </span>
      <span className="shrink-0 font-semibold">{entry.points}</span>
    </li>
  );
}

export default async function LeaderboardPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  if (!player.username) redirect("/me");
  if (!player.isActivated) redirect("/quests");
  const playerId = player.id;

  const [boards, frozen, mode] = await Promise.all([
    getLeaderboards(),
    isFrozen(),
    getLeaderboardMode(),
  ]);
  const entries = boards.overall;
  const top = entries.slice(0, 20);
  const mine = entries.find((e) => e.playerId === playerId);
  const mineInTop = top.some((e) => e.playerId === playerId);
  const anyPoints = entries.some((e) => e.points > 0);

  // Relative view: only you and the player just above and just below you.
  const myIndex = entries.findIndex((e) => e.playerId === playerId);
  const relative: LeaderboardEntry[] = [];
  if (myIndex > 0) relative.push(entries[myIndex - 1]);
  if (myIndex >= 0) relative.push(entries[myIndex]);
  if (myIndex >= 0 && myIndex < entries.length - 1) {
    relative.push(entries[myIndex + 1]);
  }

  return (
    <PlayerShell username={player.username} avatarUrl={player.avatarUrl}>
      <p className="label-caps mb-1">
        {frozen ? "Final results" : "Live standings"}
      </p>
      <h1 className="mb-4 text-3xl">Leaderboard</h1>
      <BoardTabs active="standings" />

      {frozen && (
        <p className="mb-4 rounded-lg bg-sage p-3 text-center text-sm font-medium">
          ❄️ The game is over — these are the final results!
        </p>
      )}

      {!anyPoints ? (
        <p className="card rounded-2xl p-6 text-center text-muted">
          No points on this board yet — they appear as the hosts complete
          quests during the evening.
        </p>
      ) : mode === "relative" ? (
        <>
          <p className="mb-3 text-sm text-muted">
            You and your closest rivals — climb past the player above you!
          </p>
          <ol className="space-y-2">
            {relative.map((entry) => (
              <Row
                key={entry.playerId}
                entry={entry}
                isMe={entry.playerId === playerId}
              />
            ))}
          </ol>
        </>
      ) : (
        <>
          <ol className="space-y-2">
            {top.map((entry) => (
              <Row
                key={entry.playerId}
                entry={entry}
                isMe={entry.playerId === playerId}
              />
            ))}
          </ol>
          {mine && !mineInTop && (
            <div className="mt-4">
              <p className="label-caps mb-2 text-xs">Your rank</p>
              <ol>
                <Row entry={mine} isMe />
              </ol>
            </div>
          )}
        </>
      )}
    </PlayerShell>
  );
}
