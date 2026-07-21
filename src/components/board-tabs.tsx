import Link from "next/link";

/** Shared Standings / Results switcher for the Board section. */
export function BoardTabs({ active }: { active: "standings" | "results" }) {
  const tabs = [
    { key: "standings", label: "Standings", href: "/leaderboard" },
    { key: "results", label: "Results", href: "/results" },
  ] as const;

  return (
    <nav className="mb-4 flex gap-1 rounded-xl border border-line bg-paper p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-medium ${
            active === t.key ? "bg-accent text-white shadow" : "text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
