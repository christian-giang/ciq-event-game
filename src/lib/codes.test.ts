import { describe, expect, it } from "vitest";
import { formatCode, generateCodePool } from "./codes";
import { buildUsernameCombinations } from "../content/usernames";

describe("formatCode", () => {
  it("zero-pads to 6 characters", () => {
    expect(formatCode(0)).toBe("000000");
    expect(formatCode(42107)).toBe("042107");
    expect(formatCode(999999)).toBe("999999");
  });

  it("rejects out-of-range values", () => {
    expect(() => formatCode(1_000_000)).toThrow();
    expect(() => formatCode(-1)).toThrow();
    expect(() => formatCode(1.5)).toThrow();
  });
});

describe("generateCodePool", () => {
  const POOL = generateCodePool(10_000);

  it("generates the requested count, all 6 chars, zero-padding preserved", () => {
    expect(POOL).toHaveLength(10_000);
    for (const code of POOL) {
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(POOL).size).toBe(POOL.length);
  });

  it("digit distribution passes a chi-squared uniformity test", () => {
    // 60,000 digits over 10 bins; H0 = uniform. df = 9,
    // critical value at p = 0.001 is 27.88.
    const counts = new Array<number>(10).fill(0);
    for (const code of POOL) {
      for (const ch of code) counts[Number(ch)]++;
    }
    const total = POOL.length * 6;
    const expected = total / 10;
    const chi2 = counts.reduce(
      (sum, observed) => sum + (observed - expected) ** 2 / expected,
      0,
    );
    expect(chi2).toBeLessThan(27.88);
  });

  it("is not sequential or clustered: adjacent draws differ wildly", () => {
    // In a sequential handout, consecutive codes differ by 1. With uniform
    // random draws the mean absolute gap between consecutive codes is ~333k.
    const gaps = POOL.slice(1).map((c, i) =>
      Math.abs(Number(c) - Number(POOL[i])),
    );
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(meanGap).toBeGreaterThan(100_000);
  });
});

describe("username pool", () => {
  it("provides ≥720 unique combinations", () => {
    const names = buildUsernameCombinations();
    expect(names.length).toBeGreaterThanOrEqual(720);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    }
  });
});
