"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHANGELOG } from "@/lib/data/changelog";
import { APP_VERSION } from "@/lib/version";

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🏅</span>
            <span className="font-bold text-lg tracking-tight">S5Evo Portal</span>
          </Link>
          <Badge variant="secondary" className="text-xs">{APP_VERSION}</Badge>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm">← Zurück</Button>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight">📋 Changelog</h1>
          <p className="text-muted-foreground">
            Versionshistorie und Änderungen am S5Evo Portal
          </p>
        </motion.div>

        <div className="space-y-4">
          {CHANGELOG.map((entry, index) => (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={index === 0 ? "border-primary/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{entry.version}</CardTitle>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">Aktuell</Badge>
                      )}
                    </div>
                    <CardDescription>{entry.date}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
                    {entry.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-8 text-xs text-muted-foreground"
        >
          S5Evo Portal {APP_VERSION} • Mannschaftsfünfkampf • Built with ❤️
        </motion.footer>
      </main>
    </div>
  );
}
