import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  ["Vercel", "Hosting und Auslieferung des Portals."],
  ["PostgreSQL/Prisma", "Speicherung von Portal-, Anmelde-, Ergebnis- und Auditdaten."],
  ["Authentik", "Login, Konto und Rollen ueber OpenID Connect."],
  ["Resend", "Versand notwendiger transaktionaler E-Mails."],
  ["MapTiler/OpenStreetMap", "Optionale Kartenkacheln auf der Sponsor-Karte nach Einwilligung."],
  ["Google Maps", "Wird erst kontaktiert, wenn ein Route-Link aktiv geoeffnet wird."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-24">
      <div className="mb-6 space-y-2">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Zurueck zum Portal
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Datenschutzerklaerung</h1>
        <p className="text-sm text-muted-foreground">
          Kurzfassung fuer das S5Evo-Portal. Rechtliche Kontaktdaten und
          Aufbewahrungsfristen werden vor Live-Freigabe final ergaenzt.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Welche Daten wir verarbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Wir verarbeiten die im Portal eingegebenen Daten, um den Soier 5Kampf zu
              organisieren: Anmeldung, Mannschaftsverwaltung, Startnummern, Ergebnisse,
              Nachrichten und organisatorische Rueckfragen.
            </p>
            <p>
              Dazu gehoeren je nach Nutzung Namen, Geburtsjahr bzw. Geburtsdatum,
              E-Mail-Adresse, Telefonnummer, Mannschafts- und Teilnehmerdaten, Rollen,
              Nachrichten, Aenderungsprotokolle und technische Auditdaten.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cookies und lokale Speicherung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Notwendige Cookies und Speicherungen nutzen wir fuer Login, Sicherheit,
              Formularschutz, Session und die Speicherung deiner Datenschutzeinstellungen.
            </p>
            <p>
              Optionale Speicherungen fuer Komfortfunktionen, lokale Entwuerfe, Offline-
              Funktionen und externe Kartendienste werden nur genutzt, wenn du sie aktivierst.
              Wenn du sie nicht aktivierst, bleiben die entsprechenden Funktionen deaktiviert
              oder werden nur eingeschraenkt angezeigt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dienstleister</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Wir geben Daten nicht an Dritte weiter, sofern dies fuer Betrieb und Nutzung
              des Portals nicht erforderlich ist.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map(([name, purpose]) => (
                <div key={name} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium text-foreground">{name}</div>
                  <div className="text-xs leading-5">{purpose}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>E-Mail und Nachrichten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              E-Mail-Nachrichten senden wir ohne gesonderte Werbeeinwilligung nur, wenn sie
              fuer deine Anmeldung, dein Konto, deine Mannschaft oder eine von dir ausgeloeste
              Portalaktion erforderlich sind.
            </p>
            <p>
              Fuer zusaetzliche Portal-Benachrichtigungen per E-Mail fragen wir dich gesondert.
              Diese Einwilligung kannst du jederzeit in deinem Profil widerrufen.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
