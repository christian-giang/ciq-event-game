import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { players, quizAnswers, submissions } from "@/db/schema";
import { getQuest } from "@/lib/quests";
import { getPlayerId } from "@/lib/session";
import { QueueIndicator } from "@/components/queue-indicator";
import { MediaView } from "./media-view";
import { QuizView } from "./quiz-view";
import { TextView } from "./text-view";

export default async function QuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const playerId = await getPlayerId();
  if (!playerId) redirect("/");

  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player || player.isBlocked) redirect("/");

  const { id } = await params;
  const quest = await getQuest(id);
  if (!quest || quest.state === "unreleased") notFound();

  const locked = quest.state !== "released";

  let body: React.ReactNode;
  switch (quest.type) {
    case "quiz": {
      const answer = await db.query.quizAnswers.findFirst({
        where: and(
          eq(quizAnswers.playerId, playerId),
          eq(quizAnswers.questId, quest.id),
        ),
      });
      if (locked && !answer) {
        body = (
          <p className="card rounded-2xl p-6 text-center text-muted">
            Answers are closed for this quest.
          </p>
        );
      } else {
        body = (
          <QuizView
            // correctOptionId deliberately NOT sent to the client before
            // answering — no cheating via view-source.
            quest={{
              id: quest.id,
              title: quest.title,
              prompt: quest.prompt,
              options: quest.options,
              revealAfterAnswer: quest.revealAfterAnswer,
              points: quest.points,
            }}
            serverAnswer={
              answer
                ? {
                    chosenOptionId: answer.chosenOptionId,
                    ...(quest.revealAfterAnswer
                      ? {
                          isCorrect: answer.isCorrect,
                          correctOptionId: quest.correctOptionId,
                        }
                      : {}),
                  }
                : null
            }
          />
        );
      }
      break;
    }
    case "text": {
      const submission = await db.query.submissions.findFirst({
        where: and(
          eq(submissions.playerId, playerId),
          eq(submissions.questId, quest.id),
        ),
      });
      if (locked) {
        body = submission?.bodyText ? (
          <div className="card rounded-2xl p-4">
            <p className="label-caps mb-2 text-xs">Your answer</p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {submission.bodyText}
            </p>
          </div>
        ) : (
          <p className="card rounded-2xl p-6 text-center text-muted">
            Submissions are closed for this quest.
          </p>
        );
      } else {
        body = (
          <TextView
            quest={{ id: quest.id, maxChars: quest.maxChars }}
            serverSubmission={
              submission?.bodyText ? { bodyText: submission.bodyText } : null
            }
          />
        );
      }
      break;
    }
    case "media": {
      const submission = await db.query.submissions.findFirst({
        where: and(
          eq(submissions.playerId, playerId),
          eq(submissions.questId, quest.id),
        ),
      });
      if (locked) {
        body =
          submission?.mediaUrl && submission.mediaKind ? (
            <div className="card rounded-2xl p-4">
              <p className="label-caps mb-2 text-xs">Your submission</p>
              {submission.mediaKind === "video" ? (
                <video
                  src={submission.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-96 w-full rounded-lg"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={submission.mediaUrl}
                  alt="Your submission"
                  className="max-h-96 w-full rounded-lg object-contain"
                />
              )}
            </div>
          ) : (
            <p className="card rounded-2xl p-6 text-center text-muted">
              Submissions are closed for this quest.
            </p>
          );
      } else {
        body = (
          <MediaView
            quest={{
              id: quest.id,
              mediaKind: quest.mediaKind,
              maxDurationSec: quest.maxDurationSec,
            }}
            serverSubmission={
              submission?.mediaUrl && submission.mediaKind
                ? {
                    mediaUrl: submission.mediaUrl,
                    mediaKind: submission.mediaKind,
                  }
                : null
            }
          />
        );
      }
      break;
    }
    default: {
      const exhausted: never = quest;
      throw new Error(`Unhandled quest type: ${JSON.stringify(exhausted)}`);
    }
  }

  return (
    <>
      <QueueIndicator />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <Link
          href={`/quests?t=${quest.type}`}
          className="mb-4 inline-block text-sm underline"
        >
          ← All {quest.type === "quiz" ? "quizzes" : `${quest.type} quests`}
        </Link>
        <h1 className="mb-2 text-3xl">{quest.title}</h1>
        <p className="mb-6 leading-relaxed">{quest.prompt}</p>

        {quest.state === "voting" && quest.type !== "quiz" && (
          <div className="mb-4 rounded-lg bg-sand p-3 text-center text-sm">
            <p className="font-medium">Submissions are closed — voting is on!</p>
            <Link
              href={`/vote?q=${quest.id}`}
              className="mt-1 inline-block underline"
            >
              Go vote on this quest →
            </Link>
          </div>
        )}
        {quest.state === "completed" && (
          <p className="mb-4 rounded-lg bg-sage p-3 text-center text-sm font-medium">
            This quest is finished — points are on the leaderboard! 🏆
          </p>
        )}

        {body}
      </main>
    </>
  );
}
