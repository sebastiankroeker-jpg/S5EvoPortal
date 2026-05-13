"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      // Direkt zu Authentik weiterleiten, keine Zwischenseite
      const callbackUrl = new URL(window.location.href).searchParams.get("callbackUrl") || "/";
      signIn("authentik", { callbackUrl });
    } else if (status === "authenticated") {
      const callbackUrl = new URL(window.location.href).searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground text-sm">Weiterleitung zu Authentik...</p>
      </div>
    </div>
  );
}
