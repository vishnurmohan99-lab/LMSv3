"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker in production only (dev-mode SWs interfere with
 * Next's HMR and can serve stale chunks). The SW itself (public/sw.js) never caches
 * API responses — navigations are network-first — so live/auth'd data is never stale.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works without it */
      });
    };
    // If the page already finished loading before this effect ran (common on fast
    // connections), the "load" event won't fire again — register immediately.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
