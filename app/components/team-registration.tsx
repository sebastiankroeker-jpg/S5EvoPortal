"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const categories = [
  { value: "herren", label: "Herren", icon: "🏋️" },
  { value: "damen", label: "Damen", icon: "🏋️‍♀️" },
  { value: "mixed", label: "Mixed", icon: "👫" },
  { value: "senioren", label: "Senioren", icon: "🎖️" },
  { value: "jugend", label: "Jugend", icon: "🌟" },
];

export default function TeamRegistration() {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [category, setCategory] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!session?.user) return null;

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Mannschaft anmelden
            <Badge variant="outline">Schritt {step}/3</Badge>
          </CardTitle>
          <CardDescription>
            Registriere deine Mannschaft für den Fünfkampf
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step Indicator */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Teamchef (aus Authentik)
                </label>
                <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {session.user.name}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  E-Mail (aus Authentik)
                </label>
                <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {session.user.email}
                </div>
              </div>
              <div>
                <label htmlFor="teamName" className="text-sm font-medium">
                  Mannschaftsname *
                </label>
                <input
                  id="teamName"
                  type="text"
                  placeholder="z.B. Die Bergziegen"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                onClick={() => setStep(2)}
                disabled={!teamName}
                className="w-full"
              >
                Weiter →
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <label className="text-sm font-medium">Kategorie wählen *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      category === cat.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-xl block mb-1">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  ← Zurück
                </Button>
                <Button onClick={() => setStep(3)} disabled={!category} className="flex-1">
                  Weiter →
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h3 className="font-semibold">Zusammenfassung</h3>
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Teamchef:</span>
                  <span className="font-medium">{session.user.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">E-Mail:</span>
                  <span className="font-medium">{session.user.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Team:</span>
                  <span className="font-medium">{teamName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kategorie:</span>
                  <Badge variant="secondary">
                    {categories.find((c) => c.value === category)?.icon}{" "}
                    {categories.find((c) => c.value === category)?.label}
                  </Badge>
                </div>
              </div>
              {submitted ? (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center"
                >
                  <span className="text-2xl">🎉</span>
                  <p className="text-green-500 font-semibold mt-1">
                    Mannschaft "{teamName}" erfolgreich angemeldet!
                  </p>
                </motion.div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    ← Zurück
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1">
                    ✅ Anmelden
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
