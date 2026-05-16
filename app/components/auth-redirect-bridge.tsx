"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { clearPendingAuthCallback, readPendingAuthCallback } from "@/lib/auth-flow";

export default function AuthRedirectBridge() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const pendingCallback = readPendingAuthCallback();
    if (!pendingCallback) return;

    const currentSearch = searchParams?.toString() || "";
    const currentLocation = currentSearch ? `${pathname}?${currentSearch}` : pathname;

    if (status !== "authenticated") return;

    if (pendingCallback === currentLocation) {
      clearPendingAuthCallback();
      return;
    }

    clearPendingAuthCallback();
    router.replace(pendingCallback);
  }, [status, pathname, router, searchParams]);

  return null;
}
