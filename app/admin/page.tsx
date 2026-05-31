"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/permissions-context";
import { useCompetition } from "@/lib/competition-context";
import { useSession } from "next-auth/react";
import { APP_VERSION } from "@/lib/version";
import RestoreCenter from "@/app/components/restore-center";
import UserManagement from "@/app/components/user-management";
import NavBar from "@/app/components/nav-bar";
import BottomTabBar from "@/app/components/bottom-tab-bar";

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
  claimTokenExpiryMode: string;
  claimTokenTtlDays: number;
  teamOwnerFilterVisibleForTeamchef: boolean;
  participantsCanViewAllTeams: boolean;
  spectatorsCanViewAllTeams: boolean;
  registrationNotificationEmail: string;
  shirtOrderDeadline: string;
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

type ResetCounts = {
  teamsTotal: number;
  teamsActive: number;
  participantsTotal: number;
  participantsActive: number;
  pendingChangesOpen?: number;
  pendingChangesApproved?: number;
  pendingChangesRejected?: number;
  pendingChangesTotal?: number;
  pendingChanges?: number;
  participantAuditLogs: number;
  registrationClaimTokens: number;
  registrationClaimAuditEventsRetained: number;
  competitionRankings: number;
  disciplineResults: number;
  shots: number;
};

type ResetSummary = {
  competition: {
    id: string;
    name: string;
    year: number;
    status: string;
  };
  counts: ResetCounts;
};

type ResetSnapshotEntry = {
  id: string;
  reason: string;
  createdAt: string;
  summary: ResetSummary;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type ResetAuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type InlineFeedback = {
  type: "success" | "error";
  text: string;
};

const STATUS_OPTIONS = ["DRAFT", "OPEN", "RUNNING", "CLOSED"];
const THEME_OPTIONS = ["LIGHT", "DARK", "ESV"];
const BENCH_MODES = ["GROSS", "NETTO"];
const CLAIM_TOKEN_EXPIRY_MODES = ["COMPETITION_END", "REGISTRATION_DEADLINE", "FIXED_DAYS"];

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("de-DE");
}

function labelForResetAction(action: string) {
  switch (action) {
    case "COMPETITION_RESET_DRY_RUN":
      return "Dry Run";
    case "COMPETITION_RESET_STARTED":
      return "Reset gestartet";
    case "COMPETITION_RESET_COMPLETED":
      return "Reset abgeschlossen";
    default:
      return action;
  }
}

function renderResetCounts(counts: ResetCounts) {
  const pendingChangesOpen = counts.pendingChangesOpen ?? counts.pendingChanges ?? 0;
  const pendingChangesApproved = counts.pendingChangesApproved ?? 0;
  const pendingChangesRejected = counts.pendingChangesRejected ?? 0;
  const pendingChangesTotal =
    counts.pendingChangesTotal ?? counts.pendingChanges ?? pendingChangesOpen + pendingChangesApproved + pendingChangesRejected;

  return [
    `Teams: ${counts.teamsActive}/${counts.teamsTotal}`,
    `Teilnehmer: ${counts.participantsActive}/${counts.participantsTotal}`,
    `Pending Changes offen: ${pendingChangesOpen}`,
    `Historische Änderungen: ${pendingChangesApproved + pendingChangesRejected}/${pendingChangesTotal}`,
    `Claim-Tokens: ${counts.registrationClaimTokens}`,
    `Rankings: ${counts.competitionRankings}`,
    `Results/Shots: ${counts.disciplineResults}/${counts.shots}`,
  ].join(" • ");
}

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
  const router = useRouter();
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { active: activeCompetition, all: competitions, switchTo } = useCompetition();

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
    date: "2026-07-24",
    dateEnd: "2026-07-25",
    registrationDeadline: "2026-07-22",
    claimTokenExpiryMode: "COMPETITION_END",
    claimTokenTtlDays: 7,
    teamOwnerFilterVisibleForTeamchef: false,
    participantsCanViewAllTeams: false,
    spectatorsCanViewAllTeams: false,
    registrationNotificationEmail: "",
    shirtOrderDeadline: "",
    status: "DRAFT",
    maxTeams: 120,
    teamSize: 5,
    ageReferenceDate: "2026-12-31",
    benchPressTara: 20.0,
    benchPressMode: "GROSS",
    stockShotsCount: 11,
    stockStrikeoutCount: 1,
    location: "Bad Bayersoien",
    publicResults: true,
  });

  const [loading, setLoading] = useState(true);
  const [activeAdminTab, setActiveAdminTab] = useState("tenant");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [resetForce, setResetForce] = useState(false);
  const [resetDryRunSummary, setResetDryRunSummary] = useState<ResetSummary | null>(null);
  const [resetSnapshots, setResetSnapshots] = useState<ResetSnapshotEntry[]>([]);
  const [resetAuditEvents, setResetAuditEvents] = useState<ResetAuditEntry[]>([]);
  const [loadingResetMeta, setLoadingResetMeta] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<InlineFeedback | null>(null);
  const hasAdminAccess = !!session && can("config.edit");
  const expectedResetConfirmationText = activeCompetition?.name || competition.name;

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "tenant" || tab === "competition" || tab === "users" || tab === "restore") {
      setActiveAdminTab(tab);
    }
  }, []);

  const navigateFromBottomTab = (tabId: string) => {
    if (tabId === "profile") {
      router.push("/profile");
      return;
    }

    router.push(tabId === "home" ? "/" : `/#${tabId}`);
  };

  const loadCompetitionDetails = async (compId: string) => {
    const res = await fetch(`/api/admin/competition?id=${compId}`);
    if (res.ok) {
      const { competition: comp } = await res.json();
      if (comp) {
        setCompetition({
          name: comp.name || "",
          year: comp.year || 2026,
          date: comp.date ? comp.date.split('T')[0] : "",
          dateEnd: comp.dateEnd ? comp.dateEnd.split('T')[0] : "",
          registrationDeadline: comp.registrationDeadline ? comp.registrationDeadline.split('T')[0] : "",
          claimTokenExpiryMode: comp.claimTokenExpiryMode || "COMPETITION_END",
          claimTokenTtlDays: comp.claimTokenTtlDays || 7,
          teamOwnerFilterVisibleForTeamchef: comp.teamOwnerFilterVisibleForTeamchef === true,
          participantsCanViewAllTeams: comp.participantsCanViewAllTeams === true,
          spectatorsCanViewAllTeams: comp.spectatorsCanViewAllTeams === true,
          registrationNotificationEmail: comp.registrationNotificationEmail || "",
          shirtOrderDeadline: comp.shirtOrderDeadline ? comp.shirtOrderDeadline.split('T')[0] : "",
          status: comp.status || "DRAFT",
          maxTeams: comp.maxTeams || 120,
          teamSize: comp.teamSize || 5,
          ageReferenceDate: comp.ageReferenceDate ? comp.ageReferenceDate.split('T')[0] : "",
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

  const loadResetMetadata = async (compId: string) => {
    setLoadingResetMeta(true);
    try {
      const res = await fetch(`/api/admin/competition/reset?id=${compId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset-Daten konnten nicht geladen werden");
      }
      setResetSnapshots(data.snapshots || []);
      setResetAuditEvents(data.auditEvents || []);
    } catch (error) {
      console.error("Failed to load reset metadata:", error);
      showMessage("error", error instanceof Error ? error.message : "Reset-Daten konnten nicht geladen werden");
    } finally {
      setLoadingResetMeta(false);
    }
  };

  // Load tenant on mount
  useEffect(() => {
    if (status === "loading" || permissionsLoading) {
      return;
    }

    if (!hasAdminAccess) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const tenantResponse = await fetch('/api/admin/tenant');
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          if (tenantData.tenant) {
            setTenant({
              name: tenantData.tenant.name || "",
              slug: tenantData.tenant.slug || "",
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
      } catch (error) {
        console.error('Failed to load tenant:', error);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Konfiguration' });
      } finally {
        setLoading(false);
      }
    })();
  }, [hasAdminAccess, permissionsLoading, status]);

  // Load competition details when active competition changes
  useEffect(() => {
    if (hasAdminAccess && activeCompetition?.id) {
      loadCompetitionDetails(activeCompetition.id);
      loadResetMetadata(activeCompetition.id);
      setResetDryRunSummary(null);
      setResetConfirmationText("");
      setResetForce(false);
      setResetFeedback(null);
    }
    // loadResetMetadata intentionally stays out of deps to avoid re-fetch loops from local state updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition?.id, hasAdminAccess]);

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
        body: JSON.stringify({ ...competition, id: activeCompetition?.id }),
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

  const handleSendCompetitionExport = async () => {
    if (!activeCompetition?.id) {
      showMessage('error', 'Kein aktiver Wettkampf ausgewählt');
      return;
    }

    setSaving('competition-export');
    try {
      const response = await fetch('/api/admin/daily-orga-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: activeCompetition.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        showMessage('success', data.message || 'CSV erfolgreich versendet');
      } else {
        showMessage('error', data.error || 'CSV konnte nicht versendet werden');
      }
    } catch (error) {
      console.error('Failed to send daily orga export:', error);
      showMessage('error', 'Netzwerkfehler beim CSV-Versand');
    } finally {
      setSaving(null);
    }
  };

  const handleCompetitionReset = async (dryRun: boolean) => {
    if (!activeCompetition?.id) {
      setResetFeedback({ type: "error", text: "Kein aktiver Wettkampf ausgewählt." });
      showMessage("error", "Kein aktiver Wettkampf ausgewählt");
      return;
    }

    if (resetReason.trim().length < 10) {
      setResetFeedback({ type: "error", text: "Bitte gib eine aussagekräftige Begründung mit mindestens 10 Zeichen an." });
      showMessage("error", "Bitte gib eine aussagekräftige Begründung mit mindestens 10 Zeichen an.");
      return;
    }

    if (!dryRun && resetConfirmationText !== expectedResetConfirmationText) {
      setResetFeedback({
        type: "error",
        text: `Bestätigungstext fehlt oder stimmt nicht exakt. Bitte genau "${expectedResetConfirmationText}" eingeben.`,
      });
      showMessage("error", "Bestätigungstext fehlt oder stimmt nicht exakt.");
      return;
    }

    setSaving(dryRun ? "competition-reset-dry-run" : "competition-reset");
    setResetFeedback(null);
    try {
      const response = await fetch("/api/admin/competition/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeCompetition.id,
          reason: resetReason.trim(),
          dryRun,
          force: resetForce,
          confirmationText: dryRun ? undefined : resetConfirmationText,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Competition Reset fehlgeschlagen");
      }

      if (data.summary) {
        setResetDryRunSummary(data.summary);
      }

      if (!dryRun) {
        setResetConfirmationText("");
        setResetForce(false);
        setResetFeedback({ type: "success", text: `Wettkampf zurückgesetzt. Snapshot ${data.snapshotId} wurde erstellt.` });
        showMessage("success", `Wettkampf zurückgesetzt. Snapshot ${data.snapshotId} wurde erstellt.`);
      } else {
        setResetFeedback({ type: "success", text: "Dry Run erfolgreich berechnet." });
        showMessage("success", "Dry Run erfolgreich berechnet.");
      }

      await loadResetMetadata(activeCompetition.id);
    } catch (error) {
      console.error("Competition reset failed:", error);
      setResetFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Competition Reset fehlgeschlagen",
      });
      showMessage("error", error instanceof Error ? error.message : "Competition Reset fehlgeschlagen");
    } finally {
      setSaving(null);
    }
  };

  if (status === "loading" || permissionsLoading || loading) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Lade Konfiguration...</p>
          </div>
        </div>
        <div className="lg:hidden">
          <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <NavBar />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
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
        <div className="lg:hidden">
          <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <NavBar />

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
            Tenant-, Wettkampf- und Benutzerverwaltung
          </p>
        </motion.div>

        <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tenant">🏢 Tenant</TabsTrigger>
            <TabsTrigger value="competition">🏆 Wettkampf</TabsTrigger>
            <TabsTrigger value="users">👥 Benutzer</TabsTrigger>
            <TabsTrigger value="restore">♻️ Papierkorb</TabsTrigger>
          </TabsList>

          {/* ==================== TENANT TAB ==================== */}
          <TabsContent value="tenant">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Competition Switcher */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Wettkampf-Mandant</CardTitle>
                  <CardDescription>Wähle den aktiven Wettkampf — wirkt auf alle Ansichten</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {competitions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => switchTo(c.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                          activeCompetition?.id === c.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xl ${
                            activeCompetition?.id === c.id ? "" : "opacity-40"
                          }`}>
                            {activeCompetition?.id === c.id ? "✅" : "⚪"}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.year} • {c.teamCount} Teams</p>
                          </div>
                        </div>
                        <Badge variant={c.status === "OPEN" ? "default" : c.status === "CLOSED" ? "secondary" : "outline"} className="text-xs">
                          {c.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Anmeldeschluss">
                      <Input
                        type="date"
                        value={competition.registrationDeadline}
                        onChange={(e) => setCompetition({ ...competition, registrationDeadline: e.target.value })}
                      />
                    </FormField>
                    <FormField label="T-Shirt-Bestellschluss" hint="Bis dahin dürfen Teams Größen pflegen">
                      <Input
                        type="date"
                        value={competition.shirtOrderDeadline}
                        onChange={(e) => setCompetition({ ...competition, shirtOrderDeadline: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Claim-Link Gültigkeit" hint="Steuert, bis wann neu erzeugte Claim-Links gültig bleiben.">
                      <select
                        value={competition.claimTokenExpiryMode}
                        onChange={(e) => setCompetition({ ...competition, claimTokenExpiryMode: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        {CLAIM_TOKEN_EXPIRY_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode === "COMPETITION_END"
                              ? "Bis Wettkampfende"
                              : mode === "REGISTRATION_DEADLINE"
                                ? "Bis Anmeldeschluss"
                                : "Feste Anzahl Tage"}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label="Claim-Link Tage"
                      hint="Wird nur genutzt, wenn 'Feste Anzahl Tage' gewählt ist."
                    >
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={competition.claimTokenTtlDays}
                        disabled={competition.claimTokenExpiryMode !== "FIXED_DAYS"}
                        onChange={(e) => setCompetition({ ...competition, claimTokenTtlDays: parseInt(e.target.value) || 7 })}
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Teamchef:in sieht Anleger-Filter">
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={() =>
                            setCompetition({
                              ...competition,
                              teamOwnerFilterVisibleForTeamchef: !competition.teamOwnerFilterVisibleForTeamchef,
                            })
                          }
                          className={`relative h-6 w-12 rounded-full transition-colors ${
                            competition.teamOwnerFilterVisibleForTeamchef ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              competition.teamOwnerFilterVisibleForTeamchef ? "translate-x-6" : ""
                            }`}
                          />
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {competition.teamOwnerFilterVisibleForTeamchef ? "Filter sichtbar" : "Filter ausgeblendet"}
                        </span>
                      </div>
                    </FormField>
                    <FormField label="Teilnehmer:innen sehen Konkurrenz">
                      <div className="flex items-center gap-3 pt-2">
                        <div className="relative h-6 w-12 rounded-full bg-primary">
                          <span className="absolute left-0.5 top-0.5 h-5 w-5 translate-x-6 rounded-full bg-white" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Privacy-gefiltert sichtbar
                        </span>
                      </div>
                    </FormField>
                    <FormField label="Zuschauer:innen sehen Konkurrenz">
                      <div className="flex items-center gap-3 pt-2">
                        <div className="relative h-6 w-12 rounded-full bg-muted">
                          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Noch nicht freigegeben
                        </span>
                      </div>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Orga-Mails für Anmeldungen" hint="Mehrere Empfänger mit Komma oder Semikolon trennen. Wenn leer, wird die Tenant-Kontaktadresse genutzt.">
                      <Input
                        type="text"
                        value={competition.registrationNotificationEmail}
                        onChange={(e) => setCompetition({ ...competition, registrationNotificationEmail: e.target.value })}
                        placeholder="anmeldung@s5evo.de, 5kampf@cross-communication.com"
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CSV-Export</CardTitle>
                  <CardDescription>
                    Sende den aktuellen Mannschaftsstand des aktiven Wettkampfs sofort an den Orga-Verteiler.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      Aktiver Wettkampf: {activeCompetition?.name || "Kein Wettkampf ausgewählt"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Empfänger kommen aus <code>Orga-Mails für Anmeldungen</code> und fallen sonst auf die Tenant-Kontaktadresse zurück.
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleSendCompetitionExport}
                      disabled={saving === 'competition-export' || !activeCompetition?.id}
                    >
                      {saving === 'competition-export' ? "Versendet..." : "📨 Jetzt CSV senden"}
                    </Button>
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

              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-lg">🧨 Competition Reset</CardTitle>
                  <CardDescription>
                    Setzt nur den aktiven Wettkampf zurück. Tenant, Benutzer, Rollen, Branding und Wettkampf-Stammdaten bleiben erhalten.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      Aktiver Wettkampf: {activeCompetition?.name || "Kein Wettkampf ausgewählt"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Betroffen sind Teams, Teilnehmer, Pending Changes, Claim-Tokens, Rankings und Ergebnissätze. Vor dem Reset wird immer ein Snapshot angelegt.
                    </p>
                  </div>

                  <FormField
                    label="Begründung"
                    hint="Wird im Audit gespeichert. Beispiel: Testdaten vor offizieller Freischaltung entfernen."
                  >
                    <Textarea
                      value={resetReason}
                      onChange={(e) => {
                        setResetReason(e.target.value);
                        if (resetFeedback?.type === "error") setResetFeedback(null);
                      }}
                      placeholder="Warum wird dieser Wettkampf zurückgesetzt?"
                      className="min-h-[96px]"
                    />
                  </FormField>

                  <FormField
                    label="Bestätigungstext"
                    hint={`Für den echten Reset exakt eingeben: ${activeCompetition?.name || competition.name}`}
                  >
                    <Input
                      value={resetConfirmationText}
                      onChange={(e) => {
                        setResetConfirmationText(e.target.value);
                        if (resetFeedback?.type === "error") setResetFeedback(null);
                      }}
                      placeholder={expectedResetConfirmationText}
                    />
                  </FormField>

                  <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                    <input
                      id="reset-force"
                      type="checkbox"
                      checked={resetForce}
                      onChange={(e) => setResetForce(e.target.checked)}
                    />
                    <label htmlFor="reset-force" className="text-muted-foreground">
                      `force` aktivieren, falls ein Reset trotz Status `RUNNING` oder `CLOSED` nötig ist.
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void handleCompetitionReset(true)}
                      disabled={saving === "competition-reset-dry-run" || saving === "competition-reset" || !activeCompetition?.id}
                    >
                      {saving === "competition-reset-dry-run" ? "Berechne..." : "Dry Run berechnen"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleCompetitionReset(false)}
                      disabled={
                        saving === "competition-reset-dry-run" ||
                        saving === "competition-reset" ||
                        !activeCompetition?.id ||
                        resetReason.trim().length < 10 ||
                        resetConfirmationText !== expectedResetConfirmationText
                      }
                    >
                      {saving === "competition-reset" ? "Reset läuft..." : "Wettkampf jetzt zurücksetzen"}
                    </Button>
                  </div>

                  {resetFeedback && (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        resetFeedback.type === "success"
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {resetFeedback.type === "success" ? "✓" : "✗"} {resetFeedback.text}
                    </div>
                  )}

                  {resetDryRunSummary && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm space-y-2">
                      <p className="font-medium">Letzte Dry-Run Zusammenfassung</p>
                      <p className="text-muted-foreground">
                        {renderResetCounts(resetDryRunSummary.counts)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Genehmigt/abgelehnt: {resetDryRunSummary.counts.pendingChangesApproved ?? 0}/{resetDryRunSummary.counts.pendingChangesRejected ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Claim-Audit-Events bleiben erhalten: {resetDryRunSummary.counts.registrationClaimAuditEventsRetained}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Reset-Snapshots</CardTitle>
                  <CardDescription>
                    Die letzten Snapshots des aktiven Wettkampfs. Restore ist bewusst noch nicht freigeschaltet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingResetMeta ? (
                    <div className="text-sm text-muted-foreground">Lade Reset-Historie...</div>
                  ) : resetSnapshots.length === 0 ? (
                    <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                      Für diesen Wettkampf wurden noch keine Reset-Snapshots angelegt.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {resetSnapshots.map((snapshot) => (
                        <div key={snapshot.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-medium text-sm">{snapshot.id}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(snapshot.createdAt)} • {snapshot.createdBy?.name || snapshot.createdBy?.email || "Unbekannt"}
                              </p>
                            </div>
                            <Badge variant="outline">Snapshot</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{snapshot.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {renderResetCounts(snapshot.summary.counts)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {resetAuditEvents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Letzte Audit-Einträge</p>
                      <div className="space-y-2">
                        {resetAuditEvents.map((entry) => (
                          <div key={entry.id} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{labelForResetAction(entry.action)}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(entry.createdAt)} • {entry.actor?.name || entry.actor?.email || "Unbekannt"}
                              </span>
                            </div>
                            {entry.reason && <p className="mt-1 text-muted-foreground">{entry.reason}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

          <TabsContent value="users">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <UserManagement />
            </motion.div>
          </TabsContent>

          <TabsContent value="restore">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <RestoreCenter />
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
      <div className="lg:hidden">
        <BottomTabBar activeTab="orga" onTabChange={navigateFromBottomTab} />
      </div>
    </div>
  );
}
