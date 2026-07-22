"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Component, type ReactNode, useState } from "react";

// 3D is client-only and lazy — three.js never touches the first paint / SSR.
const MenuCharacter = dynamic(
  () => import("@/components/menu-character").then((m) => m.MenuCharacter),
  { ssr: false, loading: () => null },
);

/** If WebGL/3D throws, show the emoji instead of breaking the tile. */
class Fallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

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
  const [playing, setPlaying] = useState(false);

  function go() {
    if (playing) return;
    setPlaying(true);
    // Let the clip play, then navigate.
    window.setTimeout(() => router.push(href), 1100);
  }

  const emoji = <span className="text-5xl">{icon}</span>;

  return (
    <button
      type="button"
      onClick={go}
      className="card flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl p-4 text-center transition-transform active:scale-[0.98]"
    >
      <div className="h-20 w-20">
        <Fallback fallback={emoji}>
          <MenuCharacter clip={clip} playing={playing} />
        </Fallback>
      </div>
      <span className="text-xl font-medium">{label}</span>
      {children}
    </button>
  );
}
