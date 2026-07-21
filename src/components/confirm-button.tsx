"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A button that confirms a destructive action WITHOUT window.confirm().
 * Native confirm()/alert() are synchronous — they block the main thread until
 * dismissed, which Speed Insights counts as interaction latency (bad INP).
 * Instead this "arms" on the first click (label → confirmLabel) and fires on a
 * second click within a few seconds; it auto-disarms after that.
 *
 * Set needsConfirm={false} to make it a normal one-click button (useful when
 * only one direction of a toggle is destructive).
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm?",
  className = "",
  armedClassName,
  disabled = false,
  needsConfirm = true,
}: {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  confirmLabel?: React.ReactNode;
  className?: string;
  armedClassName?: string;
  disabled?: boolean;
  needsConfirm?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleClick() {
    if (!needsConfirm) {
      void onConfirm();
      return;
    }
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    void onConfirm();
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={armed && armedClassName ? armedClassName : className}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
