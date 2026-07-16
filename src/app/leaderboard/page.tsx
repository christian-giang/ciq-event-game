import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getLeaderboards,
  type LeaderboardCategory,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import { getCurrentPlayer } from "@/lib/auth";
import { isFrozen } from "@/lib/settings";
import { Avatar } from "@/components/avatar";
import { PlayerShell } from "@/components/player-shell";

const CATEGORIES: { key: LeaderboardCategory; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "quiz", label: "🧠 Quiz" },
  { key: "text", label: "✍️ Write" },
  { key: "media", label: "📷 Camera" },
];

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

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  if (!player.username) redirect("/me");
  const playerId = player.id;

  const { c } = await searchParams;
  const category: LeaderboardCategory = CATEGORIES.some((x) => x.key === c)
    ? (c as LeaderboardCategory)
    : "overall";

  const [boards, frozen] = await Promise.all([getLeaderboards(), isFrozen()]);
  const entries = boards[category];
  const top = entries.slice(0, 20);
  const mine = entries.find((e) => e.playerId === playerId);
  const mineInTop = top.some((e) => e.playerId === playerId);
  const anyPoints = entries.some((e) => e.points > 0);

  return (
    <PlayerShell username={player.username} avatarUrl={player.avatarUrl}>
      <p className="label-caps mb-1">
        {frozen ? "Final results" : "Live standings"}
      </p>
      <h1 className="mb-4 text-3xl">Leaderboard</h1>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.key}
            href={
              cat.key === "overall"
                ? "/leaderboard"
                : `/leaderboard?c=${cat.key}`
            }
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-medium ${
              category === cat.key
                ? "bg-accent text-white shadow"
                : "text-muted"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </nav>

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
      ) : (
        <ol className="space-y-2">
          {top.map((entry) => (
            <Row
              key={entry.playerId}
              entry={entry}
              isMe={entry.playerId === playerId}
            />
          ))}
        </ol>
      )}

      {anyPoints && mine && !mineInTop && (
        <div className="mt-4">
          <p className="label-caps mb-2 text-xs">Your rank</p>
          <ol>
            <Row entry={mine} isMe />
          </ol>
        </div>
      )}
    </PlayerShell>
  );
}
