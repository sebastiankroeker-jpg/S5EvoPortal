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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState([
    { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
    { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
    { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
    { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
    { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
  ]);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamName,
          category,
          contactName: session?.user?.name || "",
          contactEmail: session?.user?.email || "",
          contactPhone: "",
          participants
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setStep(1);
          setTeamName("");
          setCategory("");
          setParticipants([
            { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
            { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
            { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
            { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
            { firstName: "", lastName: "", birthDate: "", gender: "M", email: "", phone: "" },
          ]);
        }, 3000);
      } else {
        setError(data.error || 'Failed to register team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.user) return null;

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
            <Badge variant="outline">Schritt {step}/4</Badge>
          </CardTitle>
          <CardDescription>
            Registriere deine Mannschaft für den Fünfkampf
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step Indicator */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 space-y-4"
            >
              <div className="text-6xl">🏅</div>
              <h3 className="text-xl font-semibold text-green-600">
                Anmeldung erfolgreich!
              </h3>
              <p className="text-muted-foreground">
                Eure Mannschaft "{teamName}" wurde erfolgreich angemeldet.
              </p>
            </motion.div>
          )}

          {!submitted && (
            <>
              {/* Step 1: Team Info */}
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

              {/* Step 2: Category */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Kategorie wählen</h3>
                    <p className="text-muted-foreground">
                      In welcher Kategorie tritt euer Team an?
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`p-4 text-center rounded-lg border-2 transition-all hover:scale-105 ${
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

              {/* Step 3: Participants */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Teilnehmer</h3>
                    <p className="text-muted-foreground">
                      Erfasse deine 5 Sportler für die Mannschaft
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {participants.map((participant, index) => (
                      <Card key={index} className="p-3">
                        <div className="text-sm font-medium mb-2">Teilnehmer {index + 1}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="Vorname"
                            value={participant.firstName}
                            onChange={(e) => {
                              const newParticipants = [...participants];
                              newParticipants[index].firstName = e.target.value;
                              setParticipants(newParticipants);
                            }}
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                          />
                          <input
                            placeholder="Nachname"
                            value={participant.lastName}
                            onChange={(e) => {
                              const newParticipants = [...participants];
                              newParticipants[index].lastName = e.target.value;
                              setParticipants(newParticipants);
                            }}
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                          />
                          <input
                            type="date"
                            value={participant.birthDate}
                            onChange={(e) => {
                              const newParticipants = [...participants];
                              newParticipants[index].birthDate = e.target.value;
                              setParticipants(newParticipants);
                            }}
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                          />
                          <select
                            value={participant.gender}
                            onChange={(e) => {
                              const newParticipants = [...participants];
                              newParticipants[index].gender = e.target.value;
                              setParticipants(newParticipants);
                            }}
                            className="px-2 py-1 bg-background border border-input rounded text-sm"
                          >
                            <option value="M">Männlich</option>
                            <option value="W">Weiblich</option>
                            <option value="D">Divers</option>
                          </select>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                      ← Zurück
                    </Button>
                    <Button onClick={() => setStep(4)} className="flex-1">
                      Weiter →
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Confirmation */}
              {step === 4 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Bestätigung</h3>
                    <p className="text-muted-foreground">
                      Prüfe deine Angaben und sende die Anmeldung ab
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Team:</span>
                      <span className="font-medium">{teamName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kategorie:</span>
                      <span className="font-medium">
                        {categories.find(c => c.value === category)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Teilnehmer:</span>
                      <span className="font-medium">
                        {participants.filter(p => p.firstName && p.lastName).length}/5 erfasst
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={loading}>
                      ← Zurück
                    </Button>
                    <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
                      {loading ? "Speichere..." : "Anmelden! 🏅"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}