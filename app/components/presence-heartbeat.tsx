"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const HEARTBEAT_INTERVAL_MS = 60_000;

export default function PresenceHeartbeat() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;

      void fetch("/api/profile/presence", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        // Presence is best-effort; auth/API errors must not disturb the UI.
      });
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    const handleVisibilityChange = () => ping();

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status]);

  return null;
}
