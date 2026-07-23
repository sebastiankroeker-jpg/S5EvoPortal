"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrivacyConsent } from "@/lib/privacy-consent-context";
import { DEFAULT_CONSENT_STATE, type ConsentState } from "@/lib/privacy-consent";

type ConsentToggle = {
  key: keyof ConsentState;
  title: string;
  description: string;
};

const TOGGLES: ConsentToggle[] = [
  {
    key: "FUNCTIONAL_STORAGE",
    title: "Komfort speichern",
    description: "Theme, Navigation, Dashboard-Ansichten und ausgewaehlter Wettkampf.",
  },
  {
    key: "EXTERNAL_MAPS",
    title: "Externe Karten laden",
    description: "MapTiler/OpenStreetMap-Kacheln auf der Sponsor-Karte.",
  },
  {
    key: "LOCAL_OFFLINE",
    title: "Offline & lokale Entwuerfe",
    description: "PWA-Service-Worker, lokale Entwuerfe und lokale Zeitnahme-Daten.",
  },
  {
    key: "PORTAL_MESSAGE_EMAIL",
    title: "Portal-Nachrichten per E-Mail",
    description: "Optionale Hinweise zu neuen Portal-Nachrichten. Pflichtmails bleiben davon getrennt.",
  },
];

function ConsentCheckbox({
  checked,
  description,
  onChange,
  title,
}: {
  checked: boolean;
  description: string;
  onChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <label className="flex gap-3 rounded-md border border-border/60 bg-background/70 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-primary"
      />
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export default function PrivacyConsentBanner() {
  const { acceptAll, acceptEssential, decided, loading, saveConsent } = usePrivacyConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentState>({ ...DEFAULT_CONSENT_STATE });
  const [saving, setSaving] = useState(false);

  if (loading || decided) return null;

  async function saveDraft() {
    setSaving(true);
    try {
      await saveConsent(draft, "BANNER");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[10020] border-t border-border/70 bg-background/95 px-3 py-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            Datenschutz & Cookies
          </div>
          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
            Notwendige Cookies und Speicherungen nutzen wir fuer Login, Sicherheit und deine
            Datenschutzeinstellungen. Optionale Karten, Offline-Funktionen, Komfortspeicher und
            E-Mail-Hinweise bleiben aus, bis du sie aktivierst.
          </p>
          <Link href="/datenschutz" className="text-xs font-medium text-primary hover:underline">
            Datenschutzerklaerung
          </Link>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => void acceptEssential()}>
            Nur notwendige
          </Button>
          <Button variant="outline" onClick={() => setSettingsOpen((open) => !open)}>
            <SlidersHorizontal className="size-4" />
            Einstellungen
          </Button>
          <Button onClick={() => void acceptAll()}>Alle akzeptieren</Button>
        </div>
      </div>

      {settingsOpen ? (
        <div className="mx-auto mt-3 grid max-w-5xl gap-2 md:grid-cols-2">
          {TOGGLES.map((toggle) => (
            <ConsentCheckbox
              key={toggle.key}
              title={toggle.title}
              description={toggle.description}
              checked={draft[toggle.key]}
              onChange={(checked) => setDraft((current) => ({ ...current, [toggle.key]: checked }))}
            />
          ))}
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={() => void acceptEssential()} disabled={saving}>
              Nur notwendige speichern
            </Button>
            <Button onClick={() => void saveDraft()} disabled={saving}>
              Auswahl speichern
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
