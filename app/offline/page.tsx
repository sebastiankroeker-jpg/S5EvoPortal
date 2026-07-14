import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="size-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Keine Verbindung</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Das S5Evo Portal braucht fuer aktuelle Anmeldungen, Nachrichten und Admin-Daten eine aktive
          Internetverbindung.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            href="/"
          >
            Erneut versuchen
          </Link>
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            href="/login"
          >
            Zum Login
          </Link>
        </div>
      </div>
    </main>
  );
}
