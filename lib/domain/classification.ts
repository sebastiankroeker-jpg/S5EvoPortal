/**
 * Klassifikationslogik für Mannschaftsfünfkampf 2026
 * Shared zwischen Frontend (Live-Preview) und Backend (Validierung)
 */

const COMPETITION_YEAR = 2026;

export interface ClassificationInput {
  birthYear: number;
  gender: "M" | "W" | "D" | "MALE" | "FEMALE" | "DIVERSE";
}

export interface ClassificationResult {
  code: string;
  label: string;
  emoji: string;
  totalAge: number;
  isFemaleOnly: boolean;
  isYouthClass: boolean;
  warnings: string[];
  info: string[];
}

export const CLASSIFICATIONS: Record<string, { label: string; emoji: string; desc: string }> = {
  "schueler-a": { label: "Schüler A", emoji: "🧒", desc: "Jg. 2016–2018" },
  "schueler-b": { label: "Schüler B", emoji: "🧒", desc: "Jg. 2013–2015" },
  "jugend": { label: "Jugend", emoji: "⚡", desc: "Jg. 2009–2012" },
  "jungsters": { label: "Jungsters", emoji: "🔥", desc: "Gesamtalter ≤ 125" },
  "herren": { label: "Herren", emoji: "🏆", desc: "Gesamtalter 126–225" },
  "masters": { label: "Masters", emoji: "⭐", desc: "Gesamtalter ≥ 226" },
  "damen-a": { label: "Damen A", emoji: "👑", desc: "Nur Frauen, ≤ 150" },
  "damen-b": { label: "Damen B", emoji: "💎", desc: "Nur Frauen, > 150" },
  "unclassified": { label: "Unklassifiziert", emoji: "❓", desc: "Unvollständig" },
};

function isFemale(gender: string): boolean {
  return gender === "W" || gender === "FEMALE";
}

/**
 * Klassifiziert ein Team anhand seiner Teilnehmer.
 * Gibt Klasse + Warnungen zurück.
 */
export function classifyTeam(participants: ClassificationInput[]): ClassificationResult {
  const warnings: string[] = [];
  const infoMessages: string[] = [];
  const valid = participants.filter(p => p.birthYear > 1900);

  if (valid.length < 5) {
    return {
      code: "unclassified",
      label: "Unklassifiziert",
      emoji: "❓",
      totalAge: 0,
      isFemaleOnly: false,
      isYouthClass: false,
      warnings: [`Nur ${valid.length}/5 Teilnehmer mit gültigem Geburtsjahr`],
      info: [],
    };
  }

  const ages = valid.map(p => COMPETITION_YEAR - p.birthYear);
  const totalAge = ages.reduce((sum, age) => sum + age, 0);
  const birthYears = valid.map(p => p.birthYear);
  const isFemaleOnly = valid.every(p => isFemale(p.gender));
  const hasMixed = !isFemaleOnly && valid.some(p => isFemale(p.gender));

  // Klassifikation — zuerst prüfen, dann Warnungen generieren
  let code: string;
  let isYouthClass = false;

  // Jahrgänge-basierte Klassen (Schüler/Jugend)
  if (birthYears.every(y => y >= 2016 && y <= 2018)) {
    code = "schueler-a";
    isYouthClass = true;
  } else if (birthYears.every(y => y >= 2013 && y <= 2015)) {
    code = "schueler-b";
    isYouthClass = true;
  } else if (birthYears.every(y => y >= 2009 && y <= 2012)) {
    code = "jugend";
    isYouthClass = true;
  }
  // Altersklassen (Gesamtalter)
  else if (isFemaleOnly && totalAge <= 150) {
    code = "damen-a";
  } else if (isFemaleOnly && totalAge > 150) {
    code = "damen-b";
  } else if (totalAge <= 125) {
    code = "jungsters";
  } else if (totalAge >= 226) {
    code = "masters";
  } else {
    code = "herren";
  }

  // Info-Nachrichten für Jugend-Klassen
  if (isYouthClass) {
    infoMessages.push("Eigene Ergebnisliste (nicht in der Gesamtwertung)");
    infoMessages.push("Klassifikation nach Jahrgängen, nicht Gesamtalter");
  }

  // Warnungen nur für Erwachsenen-Klassen
  if (!isYouthClass && hasMixed) {
    warnings.push("Gemischtes Team → startet in der Herren-Wertung (keine Mixed-Kategorie 2026)");
  }

  // Grenzfall-Warnungen nur für altersbasierte Klassen
  if (!isYouthClass && !isFemaleOnly) {
    if (totalAge >= 121 && totalAge <= 125) {
      warnings.push(`Grenzfall Jungsters/Herren: Gesamtalter ${totalAge} (Grenze: 125)`);
    }
    if (totalAge >= 226 && totalAge <= 230) {
      warnings.push(`Grenzfall Herren/Masters: Gesamtalter ${totalAge} (Grenze: 226)`);
    }
  }
  if (!isYouthClass && isFemaleOnly) {
    if (totalAge >= 146 && totalAge <= 154) {
      warnings.push(`Grenzfall Damen A/B: Gesamtalter ${totalAge} (Grenze: 150)`);
    }
  }

  // Jahrgangs-Validierung für Jugend
  if (isYouthClass) {
    const outOfRange = birthYears.filter(y => {
      if (code === "schueler-a") return y < 2016 || y > 2018;
      if (code === "schueler-b") return y < 2013 || y > 2015;
      if (code === "jugend") return y < 2009 || y > 2012;
      return false;
    });
    if (outOfRange.length > 0) {
      warnings.push(`${outOfRange.length} Teilnehmer außerhalb des Jahrgangsbereichs`);
    }
  }

  // Alters-Validierung
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  if (minAge < 6) {
    warnings.push(`Jüngster Teilnehmer ist ${minAge} Jahre — ungewöhnlich jung`);
  }
  if (maxAge > 80) {
    warnings.push(`Ältester Teilnehmer ist ${maxAge} Jahre — bitte prüfen`);
  }

  const classInfo = CLASSIFICATIONS[code];

  return {
    code,
    label: classInfo?.label || code,
    emoji: classInfo?.emoji || "❓",
    totalAge,
    isFemaleOnly,
    isYouthClass,
    warnings,
    info: infoMessages,
  };
}

/**
 * Vergleicht alte und neue Klassifikation.
 * Gibt Warnungen zurück wenn sich die Klasse ändert.
 */
export function compareClassification(
  oldCode: string,
  newResult: ClassificationResult
): string[] {
  const warnings = [...newResult.warnings];

  if (oldCode && oldCode !== newResult.code && oldCode !== "unclassified") {
    const oldInfo = CLASSIFICATIONS[oldCode];
    warnings.unshift(
      `⚠️ Klassenwechsel: ${oldInfo?.emoji || ""} ${oldInfo?.label || oldCode} → ${newResult.emoji} ${newResult.label}`
    );
  }

  return warnings;
}

/**
 * Prüft ob alle 5 Disziplinen besetzt sind (keine Duplikate, kein TBD).
 */
export function validateDisciplineAssignment(
  disciplines: string[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const required = ["RUN", "BENCH", "STOCK", "ROAD", "MTB"];
  const assigned = disciplines.filter(d => d !== "TBD");
  const missing = required.filter(d => !assigned.includes(d));
  const duplicates = assigned.filter((d, i) => assigned.indexOf(d) !== i);

  if (missing.length > 0) {
    warnings.push(`Disziplinen noch offen: ${missing.join(", ")}`);
  }
  if (duplicates.length > 0) {
    warnings.push(`Disziplin doppelt vergeben: ${[...new Set(duplicates)].join(", ")}`);
  }

  return { valid: missing.length === 0 && duplicates.length === 0, warnings };
}
