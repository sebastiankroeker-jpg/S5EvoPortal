import Link from "next/link";
import TeamRegistration from "@/app/components/team-registration";

export default function PublicRegistrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📋 Öffentliche Mannschaftsanmeldung</h1>
            <p className="text-sm text-muted-foreground">Ohne Login anmelden, später per Claim-Link mit Authentik übernehmen.</p>
          </div>
          <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
            ← Startseite
          </Link>
        </div>
        <TeamRegistration allowAnonymous />
      </div>
    </div>
  );
}
