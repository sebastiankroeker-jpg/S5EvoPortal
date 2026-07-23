import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  ["Vercel", "Hosting und Auslieferung des Portals."],
  ["PostgreSQL/Prisma", "Speicherung von Portal-, Anmelde-, Ergebnis- und Auditdaten."],
  ["Authentik", "Login, Konto und Rollen über OpenID Connect."],
  ["Resend", "Versand notwendiger transaktionaler E-Mails."],
  ["MapTiler/OpenStreetMap", "Optionale Kartenbilder auf der Sponsor-Karte nach Einwilligung."],
  ["Google Maps", "Wird erst kontaktiert, wenn ein Route-Link aktiv geöffnet wird."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-24">
      <div className="mb-6 space-y-2">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Zurück zum Portal
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Datenschutzerklärung</h1>
        <p className="text-sm text-muted-foreground">
          Kurze und einfache Erklärung, welche Daten wir im S5Evo-Portal verarbeiten und
          welche freiwilligen Funktionen du selbst einschalten kannst.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Verantwortlich</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Verantwortlich für die Datenverarbeitung im S5Evo-Portal ist Sebastian Kroeker,
              Bad Bayersoien.
            </p>
            <p>
              Kontakt:{" "}
              <a href="mailto:esv@s5evo.de" className="font-medium text-primary hover:underline">
                esv@s5evo.de
              </a>
            </p>
            <p className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/30 dark:text-amber-100">
              Hinweis vor Live-Freigabe: Eine vollständige postalische Anschrift mit Straße,
              Hausnummer und Postleitzahl sollte hier noch ergänzt werden.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Welche Daten wir verarbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Wir verarbeiten die im Portal eingegebenen Daten, um den Soier 5Kampf zu
              organisieren: Anmeldung, Mannschaftsverwaltung, Startnummern, Ergebnisse,
              Nachrichten und organisatorische Rückfragen.
            </p>
            <p>
              Dazu gehören je nach Nutzung Namen, Geburtsjahr bzw. Geburtsdatum,
              E-Mail-Adresse, Telefonnummer, Mannschafts- und Teilnehmerdaten, Rollen,
              Nachrichten, Änderungsprotokolle und technische Auditdaten.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cookies und lokale Speicherung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Notwendige Cookies und Speicherungen nutzen wir für Login, Sicherheit,
              Formularschutz, Session und die Speicherung deiner Datenschutzeinstellungen.
            </p>
            <p>
              Optionale Speicherungen für Komfortfunktionen, lokale Entwürfe, Offline-
              Funktionen und externe Kartendienste werden nur genutzt, wenn du sie aktivierst.
              Wenn du sie nicht aktivierst, bleiben die entsprechenden Funktionen deaktiviert
              oder werden nur eingeschränkt angezeigt.
            </p>
            <p>
              Du kannst freiwillige Einwilligungen jederzeit im Profil ändern oder widerrufen.
              Bei einem Widerruf stoppen wir die jeweilige Funktion und löschen bekannte lokale
              Speicherungen, soweit sie zu dieser Einwilligung gehören.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dienstleister</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Wir geben Daten nicht an Dritte weiter, sofern dies für Betrieb und Nutzung
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
              für deine Anmeldung, dein Konto, deine Mannschaft oder eine von dir ausgelöste
              Portalaktion erforderlich sind.
            </p>
            <p>
              Für zusätzliche Portal-Benachrichtigungen per E-Mail fragen wir dich gesondert.
              Diese Einwilligung kannst du jederzeit in deinem Profil widerrufen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Speicherdauer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Wir speichern Daten nur so lange, wie sie für Organisation, Durchführung,
              Nachbereitung, Nachweise und berechtigte Rückfragen zum Wettkampf benötigt werden.
            </p>
            <p>
              Lokale Komfortdaten auf deinem Gerät bleiben nur erhalten, wenn du das erlaubst.
              Du kannst sie durch Widerruf der jeweiligen Einwilligung wieder entfernen lassen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deine Rechte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Du kannst Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
              Datenübertragbarkeit verlangen. Außerdem kannst du freiwillige Einwilligungen
              jederzeit mit Wirkung für die Zukunft widerrufen.
            </p>
            <p>
              Schreib uns dafür an{" "}
              <a href="mailto:esv@s5evo.de" className="font-medium text-primary hover:underline">
                esv@s5evo.de
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
