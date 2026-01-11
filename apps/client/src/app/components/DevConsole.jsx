"use client";

import { useEffect } from "react";

export default function DevConsole() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;

    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;
    if (!isMobile) return;

    let consoleInstance;
    let active = true;

    (async () => {
      const mod = await import("vconsole");
      if (!active) return;
      const VConsole = mod.default ?? mod;
      consoleInstance = new VConsole();
    })();

    return () => {
      active = false;
      if (consoleInstance?.destroy) {
        consoleInstance.destroy();
      }
    };
  }, []);

  return null;
}
