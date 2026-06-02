"use client";

import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/permissions-context";

export default function OrgaLinksPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canAccess = can("team.view.all") || can("results.edit");

  if (!canAccess) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">🗂️ Orga-Links</h1>
        <p className="text-sm text-muted-foreground">
          Sammelstelle für Seiten, die aktuell nicht in die Hauptnavigation sollen, aber erreichbar bleiben.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => window.open("/architecture", "_blank", "noopener,noreferrer")}
          className="rounded-md border border-border/40 bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent"
        >
          <div className="space-y-1">
            <span className="text-lg">🔗</span>
            <p className="font-medium text-sm">Referenzarchitektur</p>
            <p className="text-xs text-muted-foreground">Technische Übersicht und Systembild.</p>
          </div>
        </button>

        <button
          onClick={() => router.push("/tech")}
          className="rounded-md border border-border/40 bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent"
        >
          <div className="space-y-1">
            <span className="text-lg">🖥️</span>
            <p className="font-medium text-sm">Infrastruktur</p>
            <p className="text-xs text-muted-foreground">System- und Hosting-Übersicht.</p>
          </div>
        </button>

        <button
          onClick={() => router.push("/changelog")}
          className="rounded-md border border-border/40 bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent"
        >
          <div className="space-y-1">
            <span className="text-lg">📋</span>
            <p className="font-medium text-sm">Changelog</p>
            <p className="text-xs text-muted-foreground">Änderungen und Entwicklungsstand nachlesen.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
