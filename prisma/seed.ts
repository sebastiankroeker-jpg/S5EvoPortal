/**
 * Seed-Script: Historische Wettkampfdaten + Test-Mandant 2026
 *
 * Usage:
 *   npx tsx prisma/seed.ts
 *
 * Idempotent: löscht vorherige Seed-Daten (by tenant slug) und legt neu an.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── CSV Parser (simple, no deps) ───────────────────────────────────────────

function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] ?? "").trim()));
    return row;
  });
}

// RFC 4180 compliant CSV line splitter (handles quoted fields with commas)
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Classification mapping for 2024 ────────────────────────────────────────

const CLASS_MAP_2024: Record<
  string,
  {
    code: string;
    name: string;
    type: "AGE_INDIVIDUAL" | "AGE_TEAM" | "COMBINED";
    minAge?: number;
    maxAge?: number;
    genderRestriction?: "FEMALE_ONLY";
    sourceClassCodes?: string[];
  }
> = {
  "Schüler A": {
    code: "SA",
    name: "Schüler A",
    type: "AGE_INDIVIDUAL",
    minAge: 6,
    maxAge: 8,
  },
  "Schüler B": {
    code: "SB",
    name: "Schüler B",
    type: "AGE_INDIVIDUAL",
    minAge: 9,
    maxAge: 11,
  },
  Jugend: {
    code: "JU",
    name: "Jugend",
    type: "AGE_INDIVIDUAL",
    minAge: 12,
    maxAge: 15,
  },
  "Herren Jungsters (A)": {
    code: "HA",
    name: "Herren Jungsters",
    type: "AGE_TEAM",
    maxAge: 125,
  },
  "Herren (B)": {
    code: "HB",
    name: "Herren",
    type: "AGE_TEAM",
    minAge: 126,
    maxAge: 225,
  },
  "Masters ( C)": {
    code: "HC",
    name: "Masters",
    type: "AGE_TEAM",
    minAge: 226,
  },
  "Damen Gruppe A (DA)": {
    code: "DA",
    name: "Damen A",
    type: "AGE_TEAM",
    maxAge: 150,
    genderRestriction: "FEMALE_ONLY",
  },
  "Damen Gruppe B (DB)": {
    code: "DB",
    name: "Damen B",
    type: "AGE_TEAM",
    minAge: 151,
    genderRestriction: "FEMALE_ONLY",
  },
  Herren: {
    code: "H_COMBINED",
    name: "Herren Gesamt",
    type: "COMBINED",
    sourceClassCodes: ["HA", "HB", "HC"],
  },
  Damen: {
    code: "D_COMBINED",
    name: "Damen Gesamt",
    type: "COMBINED",
    sourceClassCodes: ["DA", "DB"],
    genderRestriction: "FEMALE_ONLY",
  },
};

// ─── Discipline mapping ─────────────────────────────────────────────────────

const DISCIPLINE_MAP: Record<
  string,
  {
    code: "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";
    name: string;
    unit: string;
    sortOrder: "ASC" | "DESC";
    type: "SIMPLE" | "SHOTS";
    assignment: "RUN" | "BENCH" | "STOCK" | "ROAD" | "MTB";
  }
> = {
  Laufen: { code: "RUN", name: "Laufen", unit: "s", sortOrder: "ASC", type: "SIMPLE", assignment: "RUN" },
  Bankdrücken: { code: "BENCH", name: "Bankdrücken", unit: "kg", sortOrder: "DESC", type: "SIMPLE", assignment: "BENCH" },
  Stock: { code: "STOCK", name: "Stockschießen", unit: "Ringe", sortOrder: "DESC", type: "SHOTS", assignment: "STOCK" },
  Rennrad: { code: "ROAD", name: "Rennrad", unit: "s", sortOrder: "ASC", type: "SIMPLE", assignment: "ROAD" },
  Mountainbike: { code: "MTB", name: "Mountainbike", unit: "s", sortOrder: "ASC", type: "SIMPLE", assignment: "MTB" },
};

// ─── Gender detection from first names (simple heuristic) ───────────────────

const FEMALE_NAMES = new Set([
  "lena", "sophia", "katja", "chidera", "emilia", "anna", "sarah", "julia",
  "laura", "mia", "nina", "franziska", "katharina", "maria", "sophie",
  "hannah", "lea", "johanna", "christina", "lisa", "eva", "marlene",
  "theresa", "magdalena", "elisabeth", "amelie", "nora", "paulina",
  "antonia", "victoria", "carla", "ronja", "annika", "selina", "andrea",
  "simone", "melanie", "verena", "sabine", "monika", "claudia", "martina",
  "birgit", "heike", "kerstin", "petra", "sandra", "nicole", "stefanie",
  "anja", "tanja", "sonja", "cornelia", "manuela", "renate", "ingrid",
  "helga", "brigitte", "ursula", "greta", "clara", "ida", "frieda",
  "rosa", "alma", "ella", "lina", "mathilda", "veronika", "barbara",
  "christine", "angelika", "elke", "silvia", "susanne", "irene", "doris",
  "rita", "ilse", "irmgard", "elfriede", "martha", "gertrude", "waltraud",
  "hildegard", "rosemarie", "agnes", "carina", "daniela", "diana",
  "elena", "gabriele", "gabi", "gisela", "gudrun", "hanna", "ines",
  "jana", "jasmin", "jennifer", "jessica", "karin", "karoline", "katrin",
  "kristin", "larissa", "lara", "leonie", "linda", "luisa", "lydia",
  "madlen", "margarete", "margit", "marion", "marlies", "mechthild",
  "michaela", "miriam", "monika", "nadine", "natalie", "patrizia",
  "ramona", "rebecca", "regina", "sabrina", "silke", "stella", "svenja",
  "tabea", "tamara", "tatjana", "ulrike", "vanessa", "vera", "vivien",
  "yvonne", "alexandra", "betty", "bianca", "carmen", "conny", "desiree",
]);

function guessGender(fullName: string): "MALE" | "FEMALE" {
  const firstName = fullName.split(" ")[0].toLowerCase();
  return FEMALE_NAMES.has(firstName) ? "FEMALE" : "MALE";
}

// ─── Main seed ──────────────────────────────────────────────────────────────

async function main() {
  const dataDir = path.resolve("/home/ocadmin/.openclaw/workspace/data/archiv-pdfs/processed");

  console.log("🌱 Starting seed...\n");

  // ── 1. Clean up previous seed data ──────────────────────────────────────
  const slugs = ["esv-2024", "esv-2026-test"];
  for (const slug of slugs) {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      console.log(`🗑️  Deleting existing tenant: ${slug}`);
      await prisma.tenant.delete({ where: { slug } });
    }
  }

  // ── 2. Create system user for imported data ───────────────────────────
  let systemUser = await prisma.user.findUnique({ where: { email: "import@s5evo.de" } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: "import@s5evo.de",
        name: "Datenimport",
      },
    });
  }
  console.log(`✅ System user: ${systemUser.email}`);

  // ── 3. Create Tenants ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: "ESV Fünfkampf",
      slug: "esv-2024",
      primaryColor: "#dc2626",
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.slug})`);

  // ── 4. Create Competition 2024 ─────────────────────────────────────────
  const comp2024 = await prisma.competition.create({
    data: {
      name: "Mannschafts-Fünfkampf 2024",
      year: 2024,
      date: new Date("2024-07-27"),
      status: "CLOSED",
      maxTeams: 120,
      teamSize: 5,
      ageReferenceDate: new Date("2024-07-27"),
      benchPressTara: 20.0,
      benchPressMode: "GROSS",
      stockShotsCount: 11,
      stockStrikeoutCount: 1,
      location: "Peiting",
      publicResults: true,
      tenant: { connect: { id: tenant.id } },
    },
  });
  console.log(`✅ Competition created: ${comp2024.name}`);

  // ── 5. Create Disciplines ──────────────────────────────────────────────
  const disciplineRecords: Record<string, string> = {}; // code → id
  let sortIdx = 0;
  for (const [, disc] of Object.entries(DISCIPLINE_MAP)) {
    const d = await prisma.discipline.create({
      data: {
        code: disc.code,
        name: disc.name,
        unit: disc.unit,
        sortOrder: disc.sortOrder,
        type: disc.type,
        competition: { connect: { id: comp2024.id } },
      },
    });
    disciplineRecords[disc.code] = d.id;
    sortIdx++;
  }
  console.log(`✅ Disciplines created: ${Object.keys(disciplineRecords).length}`);

  // ── 6. Create Classifications ──────────────────────────────────────────
  const classRecords: Record<string, string> = {}; // code → id
  for (const [, cls] of Object.entries(CLASS_MAP_2024)) {
    const c = await prisma.classification.create({
      data: {
        code: cls.code,
        name: cls.name,
        type: cls.type,
        minAge: cls.minAge ?? null,
        maxAge: cls.maxAge ?? null,
        genderRestriction: cls.genderRestriction ?? null,
        sourceClassCodes: cls.sourceClassCodes ?? [],
        competition: { connect: { id: comp2024.id } },
      },
    });
    classRecords[cls.code] = c.id;
  }
  console.log(`✅ Classifications created: ${Object.keys(classRecords).length}`);

  // ── 7. Parse discipline results CSV ────────────────────────────────────
  const discCSV = parseCSV(path.join(dataDir, "2024-discipline-results.csv"));
  const nonCombined = discCSV.filter((r) => r.is_combined === "no");

  // Build team map: startnr → { teamName, classGroup, participants[] }
  type PartData = {
    name: string;
    discipline: string;
    valueRaw: string;
    valueNormalized: string;
    unit: string;
    rank: number;
    classGroup: string;
  };
  const teamMap = new Map<
    string,
    { teamName: string; classGroup: string; startnr: string; participants: PartData[] }
  >();

  for (const row of nonCombined) {
    const sn = row.startnr;
    if (!teamMap.has(sn)) {
      teamMap.set(sn, {
        teamName: row.team_name,
        classGroup: row.class_group,
        startnr: sn,
        participants: [],
      });
    }
    teamMap.get(sn)!.participants.push({
      name: row.participant_name,
      discipline: row.discipline,
      valueRaw: row.value_raw,
      valueNormalized: row.value_normalized,
      unit: row.unit,
      rank: parseInt(row.platz) || 0,
      classGroup: row.class_group,
    });
  }

  console.log(`📊 Parsed ${teamMap.size} teams from discipline results`);

  // ── 8. Parse team results CSV (for total points) ──────────────────────
  const teamCSV = parseCSV(path.join(dataDir, "2024-results.csv"));
  // Build startnr → { platz, gesamt, laufen, bankdruecken, stock, rennrad, mountainbike }
  // Filter out combined rankings (class != "")
  const teamResults = new Map<string, Record<string, string>>();
  for (const row of teamCSV) {
    if (row.class && row.class.trim() !== "") continue; // skip combined
    const sn = row.startnr;
    if (!teamResults.has(sn)) {
      teamResults.set(sn, row);
    }
  }
  console.log(`📊 Parsed ${teamResults.size} team results (per-group)`);

  // ── 9. Insert Teams + Participants + DisciplineResults ─────────────────
  let teamCount = 0;
  let participantCount = 0;
  let resultCount = 0;

  for (const [startnr, team] of teamMap) {
    const classInfo = CLASS_MAP_2024[team.classGroup];
    if (!classInfo) {
      console.warn(`⚠️  Unknown class group: "${team.classGroup}" for team ${team.teamName}`);
      continue;
    }

    const teamRow = teamResults.get(startnr);

    const dbTeam = await prisma.team.create({
      data: {
        name: team.teamName,
        approved: true,
        classificationCode: classInfo.code,
        competition: { connect: { id: comp2024.id } },
        owner: { connect: { id: systemUser.id } },
      },
    });
    teamCount++;

    // Create ranking if we have total points
    if (teamRow) {
      const gesamt = parseInt(teamRow.gesamt) || 0;
      const platz = parseInt(teamRow.platz) || 0;
      if (classRecords[classInfo.code]) {
        await prisma.competitionRanking.create({
          data: {
            totalPoints: gesamt,
            rank: platz,
            classification: { connect: { id: classRecords[classInfo.code] } },
            team: { connect: { id: dbTeam.id } },
          },
        });
      }
    }

    // Create participants
    for (const p of team.participants) {
      const discInfo = DISCIPLINE_MAP[p.discipline];
      if (!discInfo) {
        console.warn(`⚠️  Unknown discipline: "${p.discipline}"`);
        continue;
      }

      const [firstName, ...lastParts] = p.name.split(" ");
      const lastName = lastParts.join(" ") || "Unbekannt";

      const participant = await prisma.participant.create({
        data: {
          firstName,
          lastName,
          birthYear: 2000, // not in CSV, placeholder
          gender: guessGender(p.name),
          disciplineCode: discInfo.assignment,
          consentGiven: true,
          team: { connect: { id: dbTeam.id } },
        },
      });
      participantCount++;

      // Create discipline result
      const rawValue = parseFloat(p.valueNormalized) || null;
      if (rawValue !== null && disciplineRecords[discInfo.code]) {
        await prisma.disciplineResult.create({
          data: {
            rawValue,
            rank: p.rank,
            points: null, // could be derived later
            discipline: { connect: { id: disciplineRecords[discInfo.code] } },
            participant: { connect: { id: participant.id } },
          },
        });
        resultCount++;
      }
    }
  }

  console.log(`\n✅ Seed complete for 2024:`);
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Participants: ${participantCount}`);
  console.log(`   Discipline Results: ${resultCount}`);

  // ── 10. Create Test-Tenant 2026 ─────────────────────────────────────────
  const tenant2026 = await prisma.tenant.create({
    data: {
      name: "ESV Fünfkampf",
      slug: "esv-2026-test",
      primaryColor: "#dc2626",
    },
  });

  const comp2026 = await prisma.competition.create({
    data: {
      name: "Mannschafts-Fünfkampf 2026",
      year: 2026,
      date: new Date("2026-07-25"),
      registrationDeadline: new Date("2026-07-01"),
      status: "OPEN",
      maxTeams: 120,
      teamSize: 5,
      ageReferenceDate: new Date("2026-07-25"),
      benchPressTara: 20.0,
      benchPressMode: "GROSS",
      stockShotsCount: 11,
      stockStrikeoutCount: 1,
      location: "Peiting",
      publicResults: true,
      tenant: { connect: { id: tenant2026.id } },
    },
  });

  // 2026 classifications
  const classes2026 = [
    { code: "SA", name: "Schüler A", type: "AGE_INDIVIDUAL" as const, minAge: 8, maxAge: 10 },
    { code: "SB", name: "Schüler B", type: "AGE_INDIVIDUAL" as const, minAge: 11, maxAge: 13 },
    { code: "JU", name: "Jugend", type: "AGE_INDIVIDUAL" as const, minAge: 14, maxAge: 17 },
    { code: "JS", name: "Jungsters", type: "AGE_TEAM" as const, maxAge: 125 },
    { code: "HE", name: "Herren", type: "AGE_TEAM" as const, minAge: 126, maxAge: 225 },
    { code: "MA", name: "Masters", type: "AGE_TEAM" as const, minAge: 226 },
    { code: "DA", name: "Damen A", type: "AGE_TEAM" as const, maxAge: 150, genderRestriction: "FEMALE_ONLY" as const },
    { code: "DB", name: "Damen B", type: "AGE_TEAM" as const, minAge: 151, genderRestriction: "FEMALE_ONLY" as const },
    { code: "H_COMBINED", name: "Herren Gesamt", type: "COMBINED" as const, sourceClassCodes: ["JS", "HE", "MA"] },
    { code: "D_COMBINED", name: "Damen Gesamt", type: "COMBINED" as const, sourceClassCodes: ["DA", "DB"], genderRestriction: "FEMALE_ONLY" as const },
  ];

  for (const cls of classes2026) {
    await prisma.classification.create({
      data: {
        code: cls.code,
        name: cls.name,
        type: cls.type,
        minAge: cls.minAge ?? null,
        maxAge: cls.maxAge ?? null,
        genderRestriction: cls.genderRestriction ?? null,
        sourceClassCodes: cls.sourceClassCodes ?? [],
        competition: { connect: { id: comp2026.id } },
      },
    });
  }

  // 2026 disciplines (same 5)
  for (const [, disc] of Object.entries(DISCIPLINE_MAP)) {
    await prisma.discipline.create({
      data: {
        code: disc.code,
        name: disc.name,
        unit: disc.unit,
        sortOrder: disc.sortOrder,
        type: disc.type,
        competition: { connect: { id: comp2026.id } },
      },
    });
  }

  console.log(`\n✅ Test-Tenant 2026 created:`);
  console.log(`   Tenant: ${tenant2026.slug}`);
  console.log(`   Competition: ${comp2026.name} (OPEN)`);
  console.log(`   Classifications: ${classes2026.length}`);
  console.log(`   Disciplines: 5`);
  console.log(`\n🏁 Done!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
