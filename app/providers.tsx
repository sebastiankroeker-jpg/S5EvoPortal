"use client";

import { SessionProvider } from "next-auth/react";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CompetitionProvider } from "@/lib/competition-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
