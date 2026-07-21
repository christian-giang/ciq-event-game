import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth";
import { getQuestResults, type QuestResult } from "@/lib/results";
import { isFrozen } from "@/lib/settings";
import { Avatar } from "@/components/avatar";
import { BoardTabs } from "@/components/board-tabs";
import { PlayerShell } from "@/components/player-shell";

type QuizR = Extract<QuestResult, { kind: "quiz" }>;
type VotedR = Extract<QuestResult, { kind: "voted" }>;

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

export default async function ResultsPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  if (!player.username) redirect("/me");
  if (!player.isActivated) redirect("/quests");

  const [results, frozen] = await Promise.all([getQuestResults(), isFrozen()]);

  return (
    <PlayerShell username={player.username} avatarUrl={player.avatarUrl}>
      <p className="label-caps mb-1">{frozen ? "Final results" : "Results"}</p>
      <h1 className="mb-4 text-3xl">Results</h1>
      <BoardTabs active="results" />

      {results.length === 0 ? (
        <p className="card rounded-2xl p-6 text-center text-muted">
          No results yet — they appear here as the hosts complete quests.
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((r) => (
            <ResultCard key={r.questId} result={r} />
          ))}
        </div>
      )}
    </PlayerShell>
  );
}

function ResultCard({ result }: { result: QuestResult }) {
  return (
    <section className="card rounded-2xl p-4">
      <p className="label-caps mb-1 text-xs">
        {result.order}. {result.kind === "quiz" ? "Quiz" : "Voted"}
      </p>
      <h2 className="mb-1 text-xl">{result.title}</h2>
      <p className="mb-3 text-sm text-muted">{result.prompt}</p>

      {result.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.imageUrl}
          alt=""
          className="mb-3 max-h-64 w-full rounded-lg object-contain"
        />
      )}

      {result.kind === "quiz" ? (
        <QuizResult result={result} />
      ) : (
        <VotedResult result={result} />
      )}

      {result.resultImageUrl && (
        <div className="mt-3">
          <p className="label-caps mb-1 text-xs">Result</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.resultImageUrl}
            alt=""
            className="max-h-64 w-full rounded-lg object-contain"
          />
        </div>
      )}
    </section>
  );
}

function QuizResult({ result }: { result: QuizR }) {
  return (
    <>
      <ul className="space-y-2">
        {result.options.map((o) => (
          <li
            key={o.id}
            className={`flex items-center justify-between rounded-lg border-2 p-2 text-sm ${
              o.isCorrect ? "border-sage bg-sage" : "border-line"
            }`}
          >
            <span>
              {o.isCorrect && "✓ "}
              {o.label}
            </span>
            <span className="text-muted">{o.count} picked</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">
        {result.correctCount} of {result.totalAnswers} got it right.
      </p>
    </>
  );
}

function VotedResult({ result }: { result: VotedR }) {
  if (result.entries.length === 0) {
    return <p className="text-sm text-muted">No submissions for this one.</p>;
  }

  return (
    <>
      {!result.ranked && (
        <p className="mb-3 rounded-lg bg-sand p-2 text-xs">
          Not enough votes to rank — everyone who took part got participation
          points.
        </p>
      )}
      <ul className="space-y-3">
        {result.entries.map((e) => (
          <li key={e.submissionId} className="rounded-lg border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              {result.ranked && (
                <span className="text-xl">{medal(e.rank)}</span>
              )}
              <Avatar name={e.username} avatarUrl={e.avatarUrl} size={28} />
              <span className="font-medium">{e.username}</span>
              <span className="ml-auto text-sm text-muted">
                {e.votes} {e.votes === 1 ? "vote" : "votes"}
              </span>
            </div>
            {e.bodyText && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {e.bodyText}
              </p>
            )}
            {e.mediaUrl &&
              (e.kind === "video" ? (
                <video
                  src={e.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-80 w-full rounded-lg"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.mediaUrl}
                  alt={`Submission by ${e.username}`}
                  className="max-h-80 w-full rounded-lg object-contain"
                />
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
