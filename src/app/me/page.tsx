import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { getCurrentPlayer } from "@/lib/auth";
import { getPlayerRank } from "@/lib/leaderboard";
import { getQuests } from "@/lib/quests";
import { Avatar } from "@/components/avatar";
import { PlayerShell } from "@/components/player-shell";
import { CodeReveal, LogoutButton, MySubmission } from "./me-controls";
import { ProfileForm } from "./profile-form";

export default async function MePage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  // --- Onboarding: no name yet → focused setup screen, no app chrome ---
  if (!player.username) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8">
        <section className="card w-full rounded-2xl p-6 md:p-10">
          <p className="label-caps mb-2">Almost there</p>
          <h1 className="mb-2 text-3xl">Set up your profile</h1>
          <p className="mb-6 text-sm text-muted">
            Tell us your name so everyone else at the event knows who you
            are. Add a picture if you like — then you&apos;re in!
          </p>
          <ProfileForm
            initialName=""
            initialAvatarUrl={null}
            onboarding
          />
        </section>
      </main>
    );
  }

  // --- Normal profile ---
  const [mySubmissions, quests, rank] = await Promise.all([
    db.query.submissions.findMany({
      where: eq(submissions.playerId, player.id),
      orderBy: desc(submissions.createdAt),
    }),
    getQuests(),
    getPlayerRank(player.id),
  ]);
  const questTitle = new Map(quests.map((q) => [q.id, q.title]));

  return (
    <PlayerShell
      username={player.username}
      avatarUrl={player.avatarUrl}
      activated={player.isActivated}
    >
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={player.username} avatarUrl={player.avatarUrl} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-3xl">{player.username}</h1>
          {rank && (
            <p className="text-muted">
              Rank {rank.rank} · {rank.points} points
            </p>
          )}
        </div>
      </div>

      <section className="card mb-6 rounded-2xl p-4">
        <p className="label-caps mb-3 text-xs">Edit your profile</p>
        <ProfileForm
          initialName={player.username}
          initialAvatarUrl={player.avatarUrl}
          onboarding={false}
        />
      </section>

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
          <p className="text-sm text-muted">Nothing yet — go do some quests!</p>
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
          Deleting a submission removes it for everyone, immediately and for
          good.
        </p>
      </section>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </PlayerShell>
  );
}
