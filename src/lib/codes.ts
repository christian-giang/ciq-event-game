import { randomInt } from "node:crypto";

/**
 * Access codes are 6-digit zero-padded strings drawn uniformly from the full
 * 000000–999999 space with crypto randomness. Never sequential, never
 * Math.random() — a guessable code space breaks code-only login entirely.
 */

export function formatCode(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) {
    throw new Error(`code out of range: ${n}`);
  }
  return String(n).padStart(6, "0");
}

/** Fisher–Yates with crypto randomness. */
export function cryptoShuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draws `count` unique random codes, shuffled. */
export function generateCodePool(count: number): string[] {
  if (count > 500_000) {
    throw new Error("pool too large for rejection sampling");
  }
  const seen = new Set<string>();
  while (seen.size < count) {
    seen.add(formatCode(randomInt(0, 1_000_000)));
  }
  return cryptoShuffle([...seen]);
}
