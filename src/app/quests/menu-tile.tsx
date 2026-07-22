"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

/**
 * Menu tile with a pre-rendered fighter animation. At rest it shows the poster
 * (first frame, transparent WebP); on tap it plays the short WebM once, then
 * navigates. The clips were rendered offline from the shared character GLB, so
 * there's no three.js on the client — just a tiny video per icon.
 */
export function MenuTile({
  href,
  label,
  clip,
  icon,
  children,
}: {
  href: string;
  label: string;
  clip: string;
  icon: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function go() {
    if (busy) return;
    setBusy(true);
    const v = video.current;
    if (v) {
      try {
        v.currentTime = 0;
        void v.play();
      } catch {
        // ignore — we navigate regardless
      }
    }
    window.setTimeout(() => router.push(href), 1100);
  }

  return (
    <button
      type="button"
      onClick={go}
      className="card flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl p-2 text-center transition-transform active:scale-[0.98]"
    >
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {failed ? (
          <span className="text-7xl">{icon}</span>
        ) : (
          <video
            ref={video}
            src={`/animations-video/${clip}.webm`}
            poster={`/animations-video/${clip}.webp`}
            muted
            playsInline
            preload="none"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <span className="text-lg font-medium leading-tight">
        <span aria-hidden>{icon}</span> {label}
      </span>
      {children}
    </button>
  );
}
