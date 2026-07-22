import Link from "next/link";
import { count, desc, eq, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { bonusPoints, loginAttempts, players, submissions } from "@/db/schema";
import { isAdmin } from "@/lib/session";
import { getLeaderboardMode, isFrozen } from "@/lib/settings";
import { DEMO_EMAIL } from "@/lib/leaderboard";
import { getQuests } from "@/lib/quests";
import { AdminLogin } from "./admin-login";
import { ActivateAll } from "./activate-all";
import {
  FreezeToggle,
  LeaderboardModeToggle,
  PlayerRow,
  SubmissionRow,
} from "./admin-controls";
import { BonusPoints } from "./bonus-points";
import { DemoPlayerButton } from "./demo-player-button";
import { EmailTest } from "./email-test";
import { PostHogTest } from "./posthog-test";
import { QuestsSection } from "./quest-editor";
import { SimulationControls } from "./simulation-controls";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "quests", label: "Quests" },
  { key: "submissions", label: "Submissions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8">
        <section className="card w-full rounded-2xl p-6 md:p-10">
          <p className="label-caps mb-2">Staff only</p>
          <h1 className="mb-6 text-4xl">Admin</h1>
          <AdminLogin />
        </section>
      </main>
    );
  }

  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : "overview";

  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const [allPlayers, allSubmissions, [failed], frozen, allQuests] =
    await Promise.all([
      db.query.players.findMany({ orderBy: desc(players.createdAt) }),
      db.query.submissions.findMany({
        orderBy: desc(submissions.createdAt),
        limit: 200,
      }),
      db
        .select({ n: count() })
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.success, false),
            gt(loginAttempts.createdAt, oneHourAgo),
          ),
        ),
      isFrozen(),
      getQuests(),
    ]);
  const leaderboardMode = await getLeaderboardMode();

  // Recent bonus awards, grouped by batch (newest first).
  const bonusRows = await db
    .select({
      batchId: bonusPoints.batchId,
      points: bonusPoints.points,
      reason: bonusPoints.reason,
      username: players.username,
    })
    .from(bonusPoints)
    .innerJoin(players, eq(players.id, bonusPoints.playerId))
    .orderBy(desc(bonusPoints.createdAt))
    .limit(200);
  const batches = new Map<
    string,
    { batchId: string; points: number; reason: string; names: string[] }
  >();
  for (const r of bonusRows) {
    let b = batches.get(r.batchId);
    if (!b) {
      b = { batchId: r.batchId, points: r.points, reason: r.reason, names: [] };
      batches.set(r.batchId, b);
    }
    if (r.username) b.names.push(r.username);
  }
  const recentBonus = [...batches.values()].slice(0, 12);

  const bonusPlayers = allPlayers
    .filter((p) => p.username && !p.isBlocked && p.email !== DEMO_EMAIL)
    .map((p) => ({ id: p.id, username: p.username! }));

  const playerName = new Map(allPlayers.map((p) => [p.id, p.username]));
  const countLabel: Record<TabKey, number | null> = {
    overview: null,
    players: allPlayers.length,
    quests: allQuests.length,
    submissions: allSubmissions.length,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="label-caps mb-1">Staff only</p>
      <h1 className="mb-4 text-4xl">Admin</h1>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? "/admin" : `/admin?tab=${t.key}`}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-center text-sm font-medium ${
              tab === t.key
                ? "bg-accent text-white shadow"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {countLabel[t.key] !== null && (
              <span className="ml-1 opacity-70">{countLabel[t.key]}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3 text-center">
            <Link href="/admin?tab=players" className="card rounded-2xl p-4">
              <p className="text-3xl font-semibold">{allPlayers.length}</p>
              <p className="text-sm text-muted">players</p>
            </Link>
            <Link
              href="/admin?tab=submissions"
              className="card rounded-2xl p-4"
            >
              <p className="text-3xl font-semibold">{allSubmissions.length}</p>
              <p className="text-sm text-muted">submissions</p>
            </Link>
            <div className="card rounded-2xl p-4">
              <p className="text-3xl font-semibold">{failed.n}</p>
              <p className="text-sm text-muted">failed logins (1h)</p>
            </div>
          </div>

          <section className="card mb-6 rounded-2xl p-4">
            <FreezeToggle frozen={frozen} />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <LeaderboardModeToggle mode={leaderboardMode} />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <BonusPoints players={bonusPlayers} recent={recentBonus} />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <DemoPlayerButton />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <SimulationControls />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <EmailTest />
          </section>

          <section className="card mb-6 rounded-2xl p-4">
            <PostHogTest />
          </section>

          <section className="card rounded-2xl p-4">
            <p className="font-medium">Big screen</p>
            <p className="text-sm text-muted">
              Projector view with the live leaderboard and photo wall:{" "}
              <Link href="/big-screen" className="underline" target="_blank">
                /big-screen
              </Link>
            </p>
          </section>
        </>
      )}

      {tab === "players" && (
        <section>
          {allPlayers.length === 0 ? (
            <p className="text-sm text-muted">Nobody has signed up yet.</p>
          ) : (
            <>
              <ActivateAll
                activated={allPlayers.filter((p) => p.isActivated).length}
                total={allPlayers.length}
              />
              <ul className="space-y-2">
                {allPlayers.map((p) => (
                  <PlayerRow
                    key={p.id}
                    id={p.id}
                    username={p.username}
                    email={p.email}
                    accessCode={p.accessCode}
                    isBlocked={p.isBlocked}
                    isActivated={p.isActivated}
                    createdAt={p.createdAt.toISOString()}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "quests" && <QuestsSection quests={allQuests} />}

      {tab === "submissions" && (
        <section>
          {allSubmissions.length === 0 ? (
            <p className="text-sm text-muted">
              No submissions yet — they appear here as players play.
            </p>
          ) : (
            <ul className="space-y-2">
              {allSubmissions.map((s) => (
                <SubmissionRow
                  key={s.id}
                  id={s.id}
                  player={playerName.get(s.playerId) ?? "?"}
                  questId={s.questId}
                  kind={s.kind}
                  bodyText={s.bodyText}
                  mediaUrl={s.mediaUrl}
                  isHidden={s.isHidden}
                  contributors={(s.contributorIds ?? [])
                    .map((id) => playerName.get(id))
                    .filter((n): n is string => !!n)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
