"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_VERSION } from "@/lib/version";

type TenantConfig = {
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string;
  heroImageUrl: string;
  contactEmail: string;
  website: string;
  privacyText: string;
  defaultTheme: string;
};

type CompetitionConfig = {
  name: string;
  year: number;
  date: string;
  registrationDeadline: string;
  status: string;
  maxTeams: number;
  teamSize: number;
  ageReferenceDate: string;
  benchPressTara: number;
  benchPressMode: string;
  stockShotsCount: number;
  stockStrikeoutCount: number;
  location: string;
  publicResults: boolean;
};

const STATUS_OPTIONS = ["DRAFT", "OPEN", "RUNNING", "CLOSED"];
const THEME_OPTIONS = ["LIGHT", "DARK", "ESV"];
const BENCH_MODES = ["GROSS", "NETTO"];

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [tenant, setTenant] = useState<TenantConfig>({
    name: "ESV Rosenheim",
    slug: "esv-rosenheim",
    primaryColor: "#dc2626",
    logoUrl: "",
    heroImageUrl: "",
    contactEmail: "",
    website: "",
    privacyText: "",
    defaultTheme: "DARK",
  });

  const [competition, setCompetition] = useState<CompetitionConfig>({
    name: "Mannschafts-5-Kampf 2026",
    year: 2026,
    date: "2026-07-12",
    registrationDeadline: "2026-06-28",
    status: "DRAFT",
    maxTeams: 120,
    teamSize: 5,
    ageReferenceDate: "2026-12-31",
    benchPressTara: 20.0,
    benchPressMode: "GROSS",
    stockShotsCount: 11,
    stockStrikeoutCount: 1,
    location: "",
    publicResults: true,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const handleSaveTenant = () => {
    setSaving(true);
    // TODO: API call to save tenant config
    setTimeout(() => {
      setSaving(false);
      setSaved("tenant");
      setTimeout(() => setSaved(null), 2000);
    }, 500);
  };

  const handleSaveCompetition = () => {
    setSaving(true);
    // TODO: API call to save competition config
    setTimeout(() => {
      setSaving(false);
      setSaved("competition");
      setTimeout(() => setSaved(null), 2000);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🏅</span>
            <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
          </Link>
          <Badge variant="secondary" className="text-xs">{APP_VERSION}</Badge>
          <Badge variant="destructive" className="text-xs">Admin</Badge>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">← Zurück</Button>
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">⚙️ Administration</h1>
          <p className="text-muted-foreground">
            Tenant- und Wettkampf-Konfiguration
          </p>
        </motion.div>

        <Tabs defaultValue="tenant" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tenant">🏢 Tenant</TabsTrigger>
            <TabsTrigger value="competition">🏆 Wettkampf</TabsTrigger>
          </TabsList>

          {/* ==================== TENANT TAB ==================== */}
          <TabsContent value="tenant">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Branding */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Branding</CardTitle>
                  <CardDescription>Erscheinungsbild des Vereins</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Vereinsname">
                      <Input
                        value={tenant.name}
                        onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Slug" hint="URL-freundlicher Name (z.B. esv-rosenheim)">
                      <Input
                        value={tenant.slug}
                        onChange={(e) => setTenant({ ...tenant, slug: e.target.value })}
                        className="font-mono"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Primärfarbe">
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={tenant.primaryColor}
                          onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border border-border"
                        />
                        <Input
                          value={tenant.primaryColor}
                          onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })}
                          className="font-mono"
                          placeholder="#dc2626"
                        />
                      </div>
                    </FormField>
                    <FormField label="Standard-Theme">
                      <select
                        value={tenant.defaultTheme}
                        onChange={(e) => setTenant({ ...tenant, defaultTheme: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        {THEME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Logo URL" hint="Pfad oder URL zum Vereinslogo">
                      <Input
                        value={tenant.logoUrl}
                        onChange={(e) => setTenant({ ...tenant, logoUrl: e.target.value })}
                        placeholder="/logos/esv.svg"
                      />
                    </FormField>
                    <FormField label="Hero-Image URL" hint="Hintergrundbild für die Startseite">
                      <Input
                        value={tenant.heroImageUrl}
                        onChange={(e) => setTenant({ ...tenant, heroImageUrl: e.target.value })}
                        placeholder="/heroes/luftbild.jpg"
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Kontakt & DSGVO */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Kontakt & Datenschutz</CardTitle>
                  <CardDescription>Vereinskontakt und DSGVO-Einstellungen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Kontakt-E-Mail">
                      <Input
                        type="email"
                        value={tenant.contactEmail}
                        onChange={(e) => setTenant({ ...tenant, contactEmail: e.target.value })}
                        placeholder="5kampf@esv.de"
                      />
                    </FormField>
                    <FormField label="Website">
                      <Input
                        value={tenant.website}
                        onChange={(e) => setTenant({ ...tenant, website: e.target.value })}
                        placeholder="https://esv-rosenheim.de"
                      />
                    </FormField>
                  </div>
                  <FormField label="DSGVO-Einwilligungstext" hint="Wird bei der Anmeldung angezeigt">
                    <textarea
                      value={tenant.privacyText}
                      onChange={(e) => setTenant({ ...tenant, privacyText: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
                      placeholder="Ich erkläre mich einverstanden, dass meine persönlichen Daten..."
                    />
                  </FormField>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveTenant} disabled={saving} size="lg">
                  {saving ? "Speichert..." : saved === "tenant" ? "✓ Gespeichert!" : "💾 Tenant speichern"}
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          {/* ==================== COMPETITION TAB ==================== */}
          <TabsContent value="competition">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Grunddaten */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Grunddaten</CardTitle>
                  <CardDescription>Name, Datum und Status des Wettkampfs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField label="Wettkampf-Name">
                    <Input
                      value={competition.name}
                      onChange={(e) => setCompetition({ ...competition, name: e.target.value })}
                    />
                  </FormField>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Jahr">
                      <Input
                        type="number"
                        value={competition.year}
                        onChange={(e) => setCompetition({ ...competition, year: parseInt(e.target.value) || 2026 })}
                      />
                    </FormField>
                    <FormField label="Wettkampf-Datum">
                      <Input
                        type="date"
                        value={competition.date}
                        onChange={(e) => setCompetition({ ...competition, date: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Status">
                      <select
                        value={competition.status}
                        onChange={(e) => setCompetition({ ...competition, status: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Veranstaltungsort">
                    <Input
                      value={competition.location}
                      onChange={(e) => setCompetition({ ...competition, location: e.target.value })}
                      placeholder="Sportgelände ESV Rosenheim"
                    />
                  </FormField>
                </CardContent>
              </Card>

              {/* Anmeldung */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Anmeldung</CardTitle>
                  <CardDescription>Anmeldezeitraum und Teamkonfiguration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Anmeldeschluss">
                      <Input
                        type="date"
                        value={competition.registrationDeadline}
                        onChange={(e) => setCompetition({ ...competition, registrationDeadline: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Max. Teams" hint="0 = unbegrenzt">
                      <Input
                        type="number"
                        value={competition.maxTeams}
                        onChange={(e) => setCompetition({ ...competition, maxTeams: parseInt(e.target.value) || 0 })}
                      />
                    </FormField>
                    <FormField label="Teamgröße">
                      <Input
                        type="number"
                        value={competition.teamSize}
                        onChange={(e) => setCompetition({ ...competition, teamSize: parseInt(e.target.value) || 5 })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Altersberechnung */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Klassifikation</CardTitle>
                  <CardDescription>Altersberechnung und Stichtag</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Stichtag Altersberechnung" hint="Gesamtalter wird zu diesem Datum berechnet">
                      <Input
                        type="date"
                        value={competition.ageReferenceDate}
                        onChange={(e) => setCompetition({ ...competition, ageReferenceDate: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Ergebnisse öffentlich">
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() => setCompetition({ ...competition, publicResults: !competition.publicResults })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            competition.publicResults ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                              competition.publicResults ? "translate-x-6" : ""
                            }`}
                          />
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {competition.publicResults ? "Ergebnistafel sichtbar" : "Nur für Admins"}
                        </span>
                      </div>
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* Disziplin-Regeln */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Disziplin-Regeln</CardTitle>
                  <CardDescription>Bankdrücken und Stockschießen Konfiguration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Bankdrücken Modus">
                      <select
                        value={competition.benchPressMode}
                        onChange={(e) => setCompetition({ ...competition, benchPressMode: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        {BENCH_MODES.map((m) => (
                          <option key={m} value={m}>{m === "GROSS" ? "Brutto (inkl. Stange)" : "Netto (ohne Stange)"}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Stangen-Tara (kg)" hint="Gewicht der Langhantelstange">
                      <Input
                        type="number"
                        step="0.5"
                        value={competition.benchPressTara}
                        onChange={(e) => setCompetition({ ...competition, benchPressTara: parseFloat(e.target.value) || 20 })}
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Stockschießen Schübe" hint="Anzahl Schübe pro Teilnehmer">
                      <Input
                        type="number"
                        value={competition.stockShotsCount}
                        onChange={(e) => setCompetition({ ...competition, stockShotsCount: parseInt(e.target.value) || 11 })}
                      />
                    </FormField>
                    <FormField label="Streicher" hint="Anzahl zu streichender Schübe">
                      <Input
                        type="number"
                        value={competition.stockStrikeoutCount}
                        onChange={(e) => setCompetition({ ...competition, stockStrikeoutCount: parseInt(e.target.value) || 1 })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveCompetition} disabled={saving} size="lg">
                  {saving ? "Speichert..." : saved === "competition" ? "✓ Gespeichert!" : "💾 Wettkampf speichern"}
                </Button>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-8 text-xs text-muted-foreground"
        >
          S5Evo Portal {APP_VERSION} • Administration
        </motion.footer>
      </main>
    </div>
  );
}
