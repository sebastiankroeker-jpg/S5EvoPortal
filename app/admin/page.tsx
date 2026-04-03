"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/permissions-context";
import { useSession } from "next-auth/react";
import { APP_VERSION } from "@/lib/version";

type CompetitionListItem = {
  id: string;
  name: string;
  year: number;
  status: string;
  tenant: { name: string; slug: string };
  _count: { teams: number };
};

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
  dateEnd: string;
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
  const { data: session } = useSession();
  const { can } = usePermissions();
  
  // Permission check - redirect if no access
  if (session && !can("config.edit")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>🚫 Kein Zugriff</CardTitle>
            <CardDescription>
              Du hast keine Berechtigung für die Administration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">← Zurück zur Startseite</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
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
    date: "2026-07-10",
    dateEnd: "2026-07-11",
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

  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadCompetition = async (compId?: string) => {
    const url = compId ? `/api/admin/competition?id=${compId}` : '/api/admin/competition';
    const competitionResponse = await fetch(url);
    if (competitionResponse.ok) {
      const competitionData = await competitionResponse.json();
      if (competitionData.competition) {
        const comp = competitionData.competition;
        setSelectedCompetitionId(comp.id);
        setCompetition({
          name: comp.name || "Mannschafts-5-Kampf 2026",
          year: comp.year || 2026,
          date: comp.date ? comp.date.split('T')[0] : "2026-07-10",
          dateEnd: comp.dateEnd ? comp.dateEnd.split('T')[0] : "2026-07-11",
          registrationDeadline: comp.registrationDeadline ? comp.registrationDeadline.split('T')[0] : "2026-06-28",
          status: comp.status || "DRAFT",
          maxTeams: comp.maxTeams || 120,
          teamSize: comp.teamSize || 5,
          ageReferenceDate: comp.ageReferenceDate ? comp.ageReferenceDate.split('T')[0] : "2026-12-31",
          benchPressTara: comp.benchPressTara || 20.0,
          benchPressMode: comp.benchPressMode || "GROSS",
          stockShotsCount: comp.stockShotsCount || 11,
          stockStrikeoutCount: comp.stockStrikeoutCount || 1,
          location: comp.location || "",
          publicResults: comp.publicResults !== false,
        });
      }
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Tenant
        const tenantResponse = await fetch('/api/admin/tenant');
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          if (tenantData.tenant) {
            setTenant({
              name: tenantData.tenant.name || "ESV Rosenheim",
              slug: tenantData.tenant.slug || "esv-rosenheim",
              primaryColor: tenantData.tenant.primaryColor || "#dc2626",
              logoUrl: tenantData.tenant.logoUrl || "",
              heroImageUrl: tenantData.tenant.heroImageUrl || "",
              contactEmail: tenantData.tenant.contactEmail || "",
              website: tenantData.tenant.website || "",
              privacyText: tenantData.tenant.privacyText || "",
              defaultTheme: tenantData.tenant.defaultTheme || "DARK",
            });
          }
        }

        // Load all competitions for switcher
        const compsResponse = await fetch('/api/admin/competitions');
        if (compsResponse.ok) {
          const compsData = await compsResponse.json();
          setCompetitions(compsData.competitions || []);
        }

        // Load default (latest) competition
        await loadCompetition();
      } catch (error) {
        console.error('Failed to load admin data:', error);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Konfiguration' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveTenant = async () => {
    setSaving('tenant');
    try {
      const response = await fetch('/api/admin/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant),
      });

      if (response.ok) {
        const data = await response.json();
        showMessage('success', data.message || 'Tenant erfolgreich gespeichert!');
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      console.error('Failed to save tenant:', error);
      showMessage('error', 'Netzwerkfehler beim Speichern');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveCompetition = async () => {
    setSaving('competition');
    try {
      const response = await fetch('/api/admin/competition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...competition, id: selectedCompetitionId }),
      });

      if (response.ok) {
        const data = await response.json();
        showMessage('success', data.message || 'Wettkampf erfolgreich gespeichert!');
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      console.error('Failed to save competition:', error);
      showMessage('error', 'Netzwerkfehler beim Speichern');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="mt-4 text-muted-foreground">Lade Konfiguration...</p>
        </div>
      </div>
    );
  }

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

      {/* Success/Error Message */}
      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? '✓' : '✗'} {message.text}
        </div>
      )}

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

        {/* Competition Switcher — above tabs, affects everything */}
        <Card>
          <CardContent className="pt-6">
            <FormField label="Aktiver Wettkampf" hint="Bestimmt welche Daten in allen Tabs angezeigt werden">
              <select
                value={selectedCompetitionId || ""}
                onChange={async (e) => {
                  const id = e.target.value;
                  if (id) {
                    setLoading(true);
                    await loadCompetition(id);
                    setLoading(false);
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium"
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.year}) — {c.status} • {c._count.teams} Teams
                  </option>
                ))}
              </select>
            </FormField>
          </CardContent>
        </Card>

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
                <Button 
                  onClick={handleSaveTenant} 
                  disabled={saving === 'tenant'} 
                  size="lg"
                >
                  {saving === 'tenant' ? "Speichert..." : "💾 Tenant speichern"}
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
                    <FormField label="Wettkampf von (Freitag)">
                      <Input
                        type="date"
                        value={competition.date}
                        onChange={(e) => setCompetition({ ...competition, date: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Wettkampf bis (Samstag)">
                      <Input
                        type="date"
                        min={competition.date}
                        value={competition.dateEnd || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (competition.date && val < competition.date) return;
                          setCompetition({ ...competition, dateEnd: val });
                        }}
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
                <Button 
                  onClick={handleSaveCompetition} 
                  disabled={saving === 'competition'} 
                  size="lg"
                >
                  {saving === 'competition' ? "Speichert..." : "💾 Wettkampf speichern"}
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