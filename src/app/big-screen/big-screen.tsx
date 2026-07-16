"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";

type Data = {
  frozen: boolean;
  top: {
    playerId: string;
    username: string;
    avatarUrl: string | null;
    points: number;
    rank: number;
  }[];
  photos: { url: string; username: string }[];
};

const POLL_MS = 10_000;
const ROTATE_MS = 6_000;

export function BigScreen() {
  const [data, setData] = useState<Data | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/big-screen");
        if (res.ok && live) setData(await res.json());
      } catch {
        // projector keeps showing the last good data
      }
    };
    void load();
    const poll = setInterval(load, POLL_MS);
    const rotate = setInterval(
      () => setPhotoIndex((i) => i + 1),
      ROTATE_MS,
    );
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(rotate);
    };
  }, []);

  const photo =
    data && data.photos.length > 0
      ? data.photos[photoIndex % data.photos.length]
      : null;

  return (
    <main className="flex min-h-screen flex-col p-8 lg:p-12">
      <header className="mb-8 text-center">
        <p className="label-caps">
          {data?.frozen ? "Final results" : "The wedding game"}
        </p>
        <h1 className="text-5xl lg:text-6xl">Teodora &amp; Uroš</h1>
        {data?.frozen && (
          <p className="mt-2 text-2xl">❄️ The leaderboard is final!</p>
        )}
      </header>

      <div className="grid flex-1 gap-8 lg:grid-cols-2">
        <section className="card rounded-2xl p-6">
          <h2 className="label-caps mb-4 text-center">Leaderboard</h2>
          {!data || data.top.length === 0 ? (
            <p className="text-center text-2xl text-muted">
              Scan the QR code on your table to play!
            </p>
          ) : (
            <ol className="space-y-2">
              {data.top.map((entry) => (
                <li
                  key={entry.playerId}
                  className="flex items-center gap-4 text-2xl lg:text-3xl"
                >
                  <span className="w-10 shrink-0 text-center font-heading">
                    {entry.rank === 1
                      ? "🥇"
                      : entry.rank === 2
                        ? "🥈"
                        : entry.rank === 3
                          ? "🥉"
                          : entry.rank}
                  </span>
                  <Avatar
                    name={entry.username}
                    avatarUrl={entry.avatarUrl}
                    size={44}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {entry.username}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {entry.points}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card flex flex-col items-center justify-center overflow-hidden rounded-2xl p-6">
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photo.url}
                src={photo.url}
                alt={`Photo by ${photo.username}`}
                className="max-h-[60vh] w-full rounded-xl object-contain"
              />
              <p className="label-caps mt-4">{photo.username}</p>
            </>
          ) : (
            <p className="text-center text-2xl text-muted">
              Photos appear here as guests complete quests 📷
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
