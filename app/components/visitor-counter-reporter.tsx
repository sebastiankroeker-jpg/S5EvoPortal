"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { resolveVisitorRouteKey, type VisitorRouteKey } from "@/lib/visitor-counter";

type SwitchTabDetail = {
  tabId?: string;
};

export default function VisitorCounterReporter() {
  const pathname = usePathname();
  const lastReportedRef = useRef<string | null>(null);

  const reportRouteKey = useCallback((routeKey: VisitorRouteKey | null) => {
    if (!routeKey || lastReportedRef.current === routeKey) return;
    lastReportedRef.current = routeKey;

    void fetch("/api/visitor-counter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeKey }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  const reportCurrentLocation = useCallback((hashOverride?: string) => {
    if (typeof window === "undefined") return;
    const routeKey = resolveVisitorRouteKey(
      window.location.pathname,
      hashOverride ?? window.location.hash,
    );
    reportRouteKey(routeKey);
  }, [reportRouteKey]);

  useEffect(() => {
    reportCurrentLocation();
  }, [pathname, reportCurrentLocation]);

  useEffect(() => {
    const handleHashChange = () => reportCurrentLocation();
    const handleSwitchTab = (event: Event) => {
      const detail = (event as CustomEvent<SwitchTabDetail>).detail;
      reportCurrentLocation(detail?.tabId ? `#${detail.tabId}` : undefined);
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("switchTab", handleSwitchTab as EventListener);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("switchTab", handleSwitchTab as EventListener);
    };
  }, [reportCurrentLocation]);

  return null;
}
