"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import AuthRedirectBridge from "@/app/components/auth-redirect-bridge";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CompetitionProvider } from "@/lib/competition-context";
import { NotificationProvider } from "@/lib/notification-context";
import { PrivacyConsentProvider } from "@/lib/privacy-consent-context";
import PresenceHeartbeat from "@/app/components/presence-heartbeat";
import PrivacyConsentBanner from "@/app/components/privacy-consent-banner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PrivacyConsentProvider>
        <Suspense fallback={null}>
          <AuthRedirectBridge />
        </Suspense>
        <PresenceHeartbeat />
        <PermissionsProvider>
          <ThemeProvider>
            <NotificationProvider>
              <CompetitionProvider>
                {children}
                <PrivacyConsentBanner />
              </CompetitionProvider>
            </NotificationProvider>
          </ThemeProvider>
        </PermissionsProvider>
      </PrivacyConsentProvider>
    </SessionProvider>
  );
}
