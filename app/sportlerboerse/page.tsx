import Link from "next/link";
import NavBar from "@/app/components/nav-bar";
import TeamRegistration from "@/app/components/team-registration";

export default function PublicMarketplaceRegistrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Sportlerbörse</p>
            <h1 className="text-2xl font-bold">Einzelteilnehmer melden</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Noch keine vollständige Mannschaft? Melde dich einzeln bei der Orga. Deine Kontaktdaten bleiben geschützt und die Sichtbarkeit bestimmst du selbst.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/anmeldung" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Mannschaft anmelden
            </Link>
            <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Startseite
            </Link>
          </div>
        </div>

        <TeamRegistration
          allowAnonymous
          initialMode="MARKETPLACE"
          lockRegistrationMode
          presentation="marketplace"
        />
      </main>
    </div>
  );
}
