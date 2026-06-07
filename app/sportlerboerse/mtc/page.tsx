import Link from "next/link";

import ExternalBottomTabs from "@/app/components/external-bottom-tabs";
import NavBar from "@/app/components/nav-bar";
import TeamRegistration from "@/app/components/team-registration";

export default function PublicMtcDraftRegistrationPage() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Sportlerbörse</p>
            <h1 className="text-2xl font-bold">Unvollständige Mannschaft melden</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Für Teams, bei denen noch Slots offen sind oder Angaben später ergänzt werden. Der Stand wird als MTC-Entwurf gespeichert und kann per vertraulichem Link weiter gepflegt werden.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sportlerboerse" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              Einzelteilnehmer
            </Link>
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
          initialMode="TEAM"
          lockRegistrationMode
          presentation="mtc-draft"
        />
      </main>
      <ExternalBottomTabs />
    </div>
  );
}
