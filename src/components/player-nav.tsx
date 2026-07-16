import Link from "next/link";

const TABS = [
  { key: "quests", href: "/quests", label: "Quests", icon: "🎯" },
  { key: "vote", href: "/vote", label: "Vote", icon: "♥" },
  { key: "leaderboard", href: "/leaderboard", label: "Board", icon: "🏆" },
  { key: "me", href: "/me", label: "Me", icon: "🙂" },
] as const;

export function PlayerNav({
  active,
}: {
  active: (typeof TABS)[number]["key"];
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
              active === tab.key ? "font-semibold text-ink" : "text-muted"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
