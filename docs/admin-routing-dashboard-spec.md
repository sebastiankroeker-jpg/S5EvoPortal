# Admin-Link-Routing und mobile Dashboard-Optimierung

## Ziel

Admin-Navigation aus Team-, Teilnehmer-, Änderungs- und Benutzerkontexten wird einheitlich, zielgenau und mobil ruhig. Statusinformationen bleiben für alle Rollen sichtbar. Klickbare Admin-Links gibt es nur in der aktiven Admin-Rolle.

## Leitplanken

- UI-Links sind Komfort, keine Security-Grenze. Zielseiten und APIs prüfen Berechtigungen weiterhin serverseitig.
- Status-Pillen bleiben primär Status. Klickbarkeit wird dezent markiert und nur für Admins aktiviert.
- Jede Navigation setzt einen eindeutigen Zielkontext: Dashboard, Filter, Suchwert oder fokussierte Mannschaft.
- Alte Filter dürfen nicht unbemerkt weiterwirken. Ziel-Dashboards bieten eine sichtbare Rücksetzoption.
- Fachliche Grenzen bleiben erhalten: Mannschaft, Teilnehmer, Benutzerkonto, Einladung und Änderungsantrag sind verschiedene Objekte.

## Routing-Regeln

| Quelle | Ziel | Kontext |
| --- | --- | --- |
| Änderungsstatus eines Teilnehmers | Änderungsdashboard | `participantId`, `teamId`, `status` |
| Einladungs- oder Konto-Status | Benutzerverwaltung | `userId` oder `userQuery`, optional `teamId` |
| Team-Manager-Recht | Benutzerverwaltung | `userId`, `teamId` |
| Team-/Mannschaftsbezug | Mannschaften-Ansicht | `teamId` als Fokus |
| Teilnehmerliste mit offenem Antrag | Änderungsdashboard | `participantId`, `teamId`, `status=PENDING` |

## Technische Umsetzung

- Zentrale Client-Hilfe: `lib/admin-routing.ts`
- Komponenten rufen semantische Funktionen auf:
  - `openTeamDashboard`
  - `openUserDashboard`
  - `openChangesDashboard`
- Mannschaftsfokus läuft über `sessionStorage`, weil die Ansicht innerhalb der Startseite und Subnavigation lebt.
- Admin- und Änderungsdashboards verwenden URL-Parameter, damit Ziele teilbar und nachvollziehbar bleiben.

## Entwicklungspakete

1. Routing-Fundament und empfangende Filter
2. Einheitliche Admin-Pillen in Team- und Teilnehmeransicht
3. Mobile Politur der Dashboards: kompaktere Filter, ruhigere Aktionen, bessere Zeilenstruktur
4. Regression: Admin vs. Nicht-Admin, Zielnavigation, Filter-Reset, serverseitige Berechtigungen

## Aktueller Stand

- Routing-Hilfe ist angelegt.
- Team-Detailstatus verlinkt nur in aktiver Admin-Rolle.
- Teilnehmerübersicht verlinkt offene Änderungsstatus nur in aktiver Admin-Rolle.
- Änderungsdashboard nimmt `participantId`, `teamId`, `status` und `q` als Filter auf.
- Benutzerverwaltung nimmt `userId`, `userQuery` und `teamId` auf.
- Mannschaften-Ansicht nimmt fokussierte Mannschaft und Suchkontext aus der Routing-Hilfe auf.
