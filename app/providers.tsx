"use client";

import { SessionProvider } from "next-auth/react";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ThemeProvider } from "@/lib/theme-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PermissionsProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}
