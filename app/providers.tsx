"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import AuthRedirectBridge from "@/app/components/auth-redirect-bridge";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CompetitionProvider } from "@/lib/competition-context";
import { NotificationProvider } from "@/lib/notification-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <AuthRedirectBridge />
      </Suspense>
      <PermissionsProvider>
        <ThemeProvider>
          <NotificationProvider>
            <CompetitionProvider>
              {children}
            </CompetitionProvider>
          </NotificationProvider>
        </ThemeProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}
