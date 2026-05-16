"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import AuthRedirectBridge from "@/app/components/auth-redirect-bridge";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CompetitionProvider } from "@/lib/competition-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <AuthRedirectBridge />
      </Suspense>
      <PermissionsProvider>
        <ThemeProvider>
          <CompetitionProvider>
            {children}
          </CompetitionProvider>
        </ThemeProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}
