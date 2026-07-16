"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const LENGTH = 6;

export function CodeEntry() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  async function submit(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work — try again.");
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
        return;
      }
      localStorage.setItem("wg_code", code);
      localStorage.setItem("wg_username", data.username);
      router.push("/quests");
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  function applyDigits(next: string[]) {
    setDigits(next);
    if (next.every((d) => d !== "")) {
      void submit(next.join(""));
    }
  }

  function onChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // Paste or autofill of the whole code lands here as a long string.
    const next = [...digits];
    let i = index;
    for (const ch of clean) {
      if (i >= LENGTH) break;
      next[i] = ch;
      i++;
    }
    applyDigits(next);
    inputs.current[Math.min(i, LENGTH - 1)]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            value={digit}
            disabled={busy}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={`Digit ${i + 1}`}
            className="field h-14 w-12 rounded-lg text-center text-2xl font-semibold"
          />
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {busy && <p className="text-sm text-muted">Checking…</p>}
      <p className="text-sm text-muted">
        Lost your code?{" "}
        <Link href="/" className="underline">
          Re-enter your email
        </Link>{" "}
        and we&apos;ll send it again.
      </p>
    </div>
  );
}
