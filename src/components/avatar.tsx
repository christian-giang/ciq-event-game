// Palette for initial-avatars (no picture). Inline styles, not Tailwind
// classes, so dynamic selection can't be purged.
const PALETTE = ["#f1aaa1", "#d5e0db", "#efe4d9", "#e7c4b8", "#b8c9c0", "#dfd6cc"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A guest's avatar: their uploaded picture, or a colored circle with their
 * initial when they haven't set one. Plain component (no hooks) so it works
 * in both server and client components.
 */
export function Avatar({
  name,
  avatarUrl,
  size = 40,
  className = "",
}: {
  name: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? "avatar"}
        style={box}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const trimmed = name?.trim() ?? "";
  const initial = trimmed ? trimmed[0].toUpperCase() : "?";
  const color = PALETTE[hash(trimmed || "?") % PALETTE.length];

  return (
    <span
      aria-hidden
      style={{ ...box, backgroundColor: color, fontSize: size * 0.44 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-heading leading-none text-ink ${className}`}
    >
      {initial}
    </span>
  );
}
