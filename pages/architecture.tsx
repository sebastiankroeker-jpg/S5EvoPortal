"use client";

import { useState } from "react";
import { ArchitectureDiagram } from "@/app/components/architecture/diagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataAssets, personas, PersonaFilter } from "@/lib/data/architecture";

const personaFilters: { id: PersonaFilter; label: string }[] = [
  { id: "all", label: "Alle Rollen" },
  { id: "admin", label: "Administrator" },
  { id: "teamchef", label: "Teamchef" },
  { id: "athlete", label: "Athlet" },
  { id: "moderator", label: "Moderator" }
];

export default function ArchitecturePage() {
  const [filter, setFilter] = useState<PersonaFilter>("all");

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <section className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">S5Evo Referenzarchitektur</h1>
        <p className="text-muted-foreground">
          Transparenter Überblick über Komponenten, Datenflüsse und Verantwortlichkeiten – optimiert für Admins,
          Betreuer, Athleten und Moderatoren.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {personaFilters.map((option) => (
            <Button
              key={option.id}
              variant={filter === option.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Architekturübersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram activePersona={filter} />
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {personas.map((persona) => (
          <Card key={persona.id} className={filter !== "all" && filter !== persona.id ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{persona.icon}</span>
                {persona.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{persona.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Daten & Zugriff</h2>
        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left">Datensatz</th>
                <th className="px-4 py-3 text-left">Zweck</th>
                <th className="px-4 py-3 text-left">Speicherort</th>
                <th className="px-4 py-3 text-left">Retention</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Teamchef</th>
                <th className="px-4 py-3 text-left">Athlet</th>
                <th className="px-4 py-3 text-left">Moderator</th>
              </tr>
            </thead>
            <tbody>
              {dataAssets.map((asset) => (
                <tr key={asset.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{asset.title}</td>
                  <td className="px-4 py-3 max-w-xs">{asset.purpose}</td>
                  <td className="px-4 py-3">{asset.storage}</td>
                  <td className="px-4 py-3">{asset.retention}</td>
                  <td className="px-4 py-3">{asset.access.admin}</td>
                  <td className="px-4 py-3">{asset.access.teamchef}</td>
                  <td className="px-4 py-3">{asset.access.athlete}</td>
                  <td className="px-4 py-3">{asset.access.moderator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Datenschutz & Pädagogik</h2>
        <div className="space-y-3">
          {dataAssets.map((asset) => (
            <details key={`ds-${asset.id}`} className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer text-lg font-semibold">
                {asset.title} – {asset.description}
              </summary>
              <div className="mt-3 text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Zweck:</strong> {asset.purpose}
                </p>
                <p>
                  <strong>Speicherort:</strong> {asset.storage}
                </p>
                <p>
                  <strong>Aufbewahrung:</strong> {asset.retention}
                </p>
                <p>
                  <strong>Zugriff:</strong> Admin ({asset.access.admin}), Teamchef ({asset.access.teamchef}), Athlet ({
                    asset.access.athlete
                  }), Moderator ({asset.access.moderator}).
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
