"use client";

import { useEffect, useState } from "react";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";

export default function PwaServiceWorker() {
  const { hasConsent } = usePrivacyConsent();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const localOfflineAllowed = hasConsent("LOCAL_OFFLINE");

  useEffect(() => {
    if (localOfflineAllowed || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
    if ("caches" in window) {
      void caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
    }
  }, [localOfflineAllowed]);

  useEffect(() => {
    if (!localOfflineAllowed) {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isSecureContext = window.location.protocol === "https:" || window.location.hostname === "localhost";

    if (!isSecureContext) {
      return;
    }

    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(nextWorker);
            }
          });
        });
      });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, [localOfflineAllowed]);

  useEffect(() => {
    if (!localOfflineAllowed) return;
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      if (refreshing) return;
      setRefreshing(true);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [localOfflineAllowed, refreshing]);

  if (!waitingWorker) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-[70] rounded-md border border-border/70 bg-background p-3 text-sm shadow-lg lg:bottom-4 lg:left-auto lg:max-w-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Neue App-Version verfügbar</p>
          <p className="text-xs text-muted-foreground">Aktualisieren lädt die PWA neu.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
        >
          App aktualisieren
        </button>
      </div>
    </div>
  );
}
