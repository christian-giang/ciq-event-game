"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

// Bump when the rendered clips change, to bust browser/CDN cache of the
// same-named video/poster files.
const V = "3";

/**
 * Menu tile with a pre-rendered fighter animation filling the whole tile. At
 * rest it shows the poster (first frame, transparent WebP); on tap it plays
 * the short WebM once, then navigates. The label sits on a gradient over the
 * bottom so the character can use the full tile height. No three.js on the
 * client — just a tiny video per icon.
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
      className="card relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl transition-transform active:scale-[0.98]"
    >
      {failed ? (
        <span className="text-7xl">{icon}</span>
      ) : (
        <video
          ref={video}
          src={`/animations-video/${clip}.webm?v=${V}`}
          poster={`/animations-video/${clip}.webp?v=${V}`}
          muted
          playsInline
          preload="none"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 bg-gradient-to-t from-card via-card/85 to-transparent px-2 pb-2 pt-8">
        <span className="text-lg font-medium leading-tight">
          <span aria-hidden>{icon}</span> {label}
        </span>
        {children}
      </div>
    </button>
  );
}
