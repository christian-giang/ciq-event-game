import { redirect } from "next/navigation";
import { getPlayerId } from "@/lib/session";
import { SignupForm } from "./signup-form";

export default async function LandingPage() {
  if (await getPlayerId()) redirect("/quests");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-8">
      <section className="card w-full rounded-2xl p-6 md:p-10">
        <p className="label-caps mb-2">Private event</p>
        <h1 className="mb-1 text-4xl md:text-5xl">Combat IQ</h1>
        <p className="mb-6 text-muted">The team event game</p>

        <p className="mb-4 text-sm leading-relaxed">
          Complete quests, earn points, climb the leaderboard. Everything
          happens on this phone — no app store, nothing to install.
        </p>

        <div className="mb-4 rounded-lg border border-line bg-blush p-4 text-sm leading-relaxed text-muted">
          Some quests ask you to upload a photo or video.{" "}
          <strong className="text-ink">
            Anything you upload will be visible to everyone else at the event
          </strong>{" "}
          in the app, and may be shown on the screen in the room. Only upload
          things you&apos;re happy for everyone here to see. Plenty of quests
          don&apos;t involve photos or videos at all — you can skip the ones
          you don&apos;t like and still play.
          <br />
          <br />
          We store your email address only to send you your access code.
          Everything is deleted 30 days after the event.
        </div>

        <SignupForm />
      </section>
    </main>
  );
}
