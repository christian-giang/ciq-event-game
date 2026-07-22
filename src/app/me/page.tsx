import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { players, submissions } from "@/db/schema";
import { getCurrentPlayer } from "@/lib/auth";
import { getQuests } from "@/lib/quests";
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
  const [mySubmissions, quests] = await Promise.all([
    db.query.submissions.findMany({
      where: eq(submissions.playerId, player.id),
      orderBy: desc(submissions.createdAt),
    }),
    getQuests(),
  ]);
  const questTitle = new Map(quests.map((q) => [q.id, q.title]));

  // Resolve names of teammates credited on the player's submissions.
  const contribIds = [
    ...new Set(mySubmissions.flatMap((s) => s.contributorIds ?? [])),
  ];
  const nameById = new Map<string, string>();
  if (contribIds.length) {
    const names = await db
      .select({ id: players.id, username: players.username })
      .from(players)
      .where(inArray(players.id, contribIds));
    for (const n of names) if (n.username) nameById.set(n.id, n.username);
  }

  return (
    <PlayerShell
      username={player.username}
      avatarUrl={player.avatarUrl}
      activated={player.isActivated}
    >
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
                contributors={(s.contributorIds ?? [])
                  .map((id) => nameById.get(id))
                  .filter((n): n is string => !!n)}
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
