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
    let onErrorHandler;
    let onRejectionHandler;

    (async () => {
      const mod = await import("vconsole");
      if (!active) return;
      const VConsole = mod.default ?? mod;
      consoleInstance = new VConsole();

      onErrorHandler = (event) => {
        const payload = {
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
        };
        console.error("[window.onerror]", payload);
      };

      onRejectionHandler = (event) => {
        const reason = event.reason;
        const payload = {
          message: reason?.message || String(reason),
          stack: reason?.stack,
        };
        console.error("[unhandledrejection]", payload);
      };

      window.addEventListener("error", onErrorHandler);
      window.addEventListener("unhandledrejection", onRejectionHandler);
    })();

    return () => {
      active = false;
      if (onErrorHandler) {
        window.removeEventListener("error", onErrorHandler);
      }
      if (onRejectionHandler) {
        window.removeEventListener("unhandledrejection", onRejectionHandler);
      }
      if (consoleInstance?.destroy) {
        consoleInstance.destroy();
      }
    };
  }, []);

  return null;
}
