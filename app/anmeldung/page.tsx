import Link from "next/link";
import NavBar from "@/app/components/nav-bar";
import TeamRegistration from "@/app/components/team-registration";

export default function PublicRegistrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">📋 Öffentliche Mannschaftsanmeldung</h1>
            <p className="text-sm text-muted-foreground">Ohne Login anmelden, später per Übernahmelink im Portal weiterführen.</p>
          </div>
          <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
            ← Startseite
          </Link>
        </div>
        <TeamRegistration allowAnonymous />
      </main>
    </div>
  );
}
