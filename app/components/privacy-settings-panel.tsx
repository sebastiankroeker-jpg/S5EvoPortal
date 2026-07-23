"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Map, MonitorCog, Save, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";
import type { ConsentState } from "@/lib/privacy-consent";

const OPTIONS = [
  {
    key: "FUNCTIONAL_STORAGE" as const,
    icon: MonitorCog,
    title: "Ansichten merken",
    description: "Wir merken uns z. B. Theme, geöffnete Navigation, Dashboard-Ansicht und ausgewählten Wettkampf. Ausgeschaltet funktioniert das Portal weiter, vergisst diese Einstellungen aber nach der Sitzung.",
  },
  {
    key: "EXTERNAL_MAPS" as const,
    icon: Map,
    title: "Karte laden",
    description: "Die Sponsor-Karte lädt Kartenbilder von externen Kartendiensten. Ausgeschaltet bleibt die Karte blockiert, bis du sie aktiv freigibst.",
  },
  {
    key: "LOCAL_OFFLINE" as const,
    icon: WifiOff,
    title: "Offline & Entwürfe",
    description: "Das Portal darf Entwürfe und Offline-Daten lokal auf deinem Gerät speichern. Ausgeschaltet werden diese Daten nicht lokal behalten.",
  },
  {
    key: "PORTAL_MESSAGE_EMAIL" as const,
    icon: Mail,
    title: "Portal-Nachrichten per E-Mail",
    description: "Du bekommst optionale E-Mail-Hinweise, wenn im Portal neue Nachrichten für dich vorliegen. Wichtige Pflichtmails bleiben unabhängig davon möglich.",
  },
];

export default function PrivacySettingsPanel() {
  const { categories, saveConsent } = usePrivacyConsent();
  const [draft, setDraft] = useState<ConsentState>(categories);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveConsent(draft, "PROFILE");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
        Notwendige Cookies für Login, Sicherheit und deine Datenschutzeinstellungen sind immer aktiv. Alles Weitere
        kannst du hier ein- oder ausschalten. Details stehen in der{" "}
        <Link href="/datenschutz" className="font-medium text-primary hover:underline">
          Datenschutzerklärung
        </Link>
        .
      </div>

      <div className="grid gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <label key={option.key} className="flex gap-3 rounded-md border border-border/60 p-3">
              <input
                type="checkbox"
                checked={draft[option.key]}
                onChange={(event) => setDraft((current) => ({ ...current, [option.key]: event.target.checked }))}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4 text-primary" />
                  {option.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-emerald-600">Gespeichert</span> : null}
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Speichert..." : "Einwilligungen speichern"}
        </Button>
      </div>
    </div>
  );
}
