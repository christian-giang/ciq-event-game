"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // A failed SW registration degrades to a plain website — fine.
        console.warn("sw registration failed", err);
      });
    }
  }, []);
  return null;
}
