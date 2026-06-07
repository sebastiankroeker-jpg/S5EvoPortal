import Link from "next/link";
import ExternalBottomTabs from "@/app/components/external-bottom-tabs";
import NavBar from "@/app/components/nav-bar";
import TeamRegistration from "@/app/components/team-registration";

export default function PublicMarketplaceRegistrationPage() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
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
            <Link href="/sportlerboerse/mtc" className="inline-flex h-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/15">
              Unvollständige Mannschaft
            </Link>
            <Link href="/anmeldung" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Mannschaft anmelden
            </Link>
            <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Startseite
            </Link>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Link href="/sportlerboerse" className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
            <span className="block font-medium">Einzelteilnehmer melden</span>
            <span className="text-xs text-muted-foreground">Eine Person ohne feste Mannschaft</span>
          </Link>
          <Link href="/sportlerboerse/mtc" className="rounded-md border border-border/60 bg-background p-3 text-sm hover:bg-muted/30">
            <span className="block font-medium">Unvollständige Mannschaft melden</span>
            <span className="text-xs text-muted-foreground">MTC-Entwurf mit offenen Slots</span>
          </Link>
        </div>

        <TeamRegistration
          allowAnonymous
          initialMode="MARKETPLACE"
          lockRegistrationMode
          presentation="marketplace"
        />
      </main>
      <ExternalBottomTabs />
    </div>
  );
}
