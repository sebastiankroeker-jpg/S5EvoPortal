import type { NavigationMenuItem } from "@/lib/navigation-menu";

type SearchableParticipant = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
};

type SearchableTeam = {
  id?: string;
  name?: string;
  discipline?: string | null;
  participants?: SearchableParticipant[];
};

export type SearchResult =
  | {
      type: "menu";
      id: string;
      label: string;
      icon: NavigationMenuItem["icon"];
    }
  | {
      type: "team";
      id: string;
      name: string;
      discipline?: string | null;
      participants?: SearchableParticipant[];
      icon: string;
    }
  | {
      type: "participant";
      id: string;
      name: string;
      teamId: string;
      teamName: string;
      discipline?: string | null;
      icon: string;
    };

type ParticipantSearchResult = Extract<SearchResult, { type: "participant" }>;

export type SearchResultSection = {
  key: "menu" | "team" | "participant";
  label: string;
  results: SearchResult[];
};

export type HighlightPart = {
  text: string;
  highlighted: boolean;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function participantName(participant: SearchableParticipant) {
  return [participant.firstName, participant.lastName].filter(Boolean).join(" ").trim();
}

function valueMatchesQuery(value: string | null | undefined, query: string) {
  return typeof value === "string" && value.toLowerCase().includes(query);
}

function scoreValue(value: string | null | undefined, query: string) {
  if (!value) return -1;
  const normalized = value.toLowerCase();
  if (normalized === query) return 300;
  if (normalized.startsWith(query)) return 200;
  if (normalized.includes(` ${query}`)) return 120;
  if (normalized.includes(query)) return 100;
  return -1;
}

function scoreMenuItem(item: NavigationMenuItem, query: string) {
  return Math.max(
    scoreValue(item.label, query),
    ...item.keywords.map((keyword) => scoreValue(keyword, query)),
  );
}

function scoreTeam(team: SearchableTeam, query: string) {
  return scoreValue(team.name, query);
}

function participantMatchesQuery(participant: SearchableParticipant, query: string) {
  const fullName = participantName(participant);
  return (
    valueMatchesQuery(fullName, query) ||
    valueMatchesQuery(participant.firstName, query) ||
    valueMatchesQuery(participant.lastName, query) ||
    valueMatchesQuery(participant.email ?? undefined, query)
  );
}

export function buildSearchResults(input: {
  query: string;
  permittedMenuItems: NavigationMenuItem[];
  teams: SearchableTeam[];
}): SearchResult[] {
  const lowerQuery = normalizeQuery(input.query);
  const menuOrder = new Map(input.permittedMenuItems.map((item, index) => [item.id, index]));

  const menuResults: SearchResult[] = input.permittedMenuItems
    .filter((item) => !lowerQuery || scoreMenuItem(item, lowerQuery) >= 0)
    .sort((left, right) => {
      if (!lowerQuery) return (menuOrder.get(left.id) ?? 0) - (menuOrder.get(right.id) ?? 0);
      return scoreMenuItem(right, lowerQuery) - scoreMenuItem(left, lowerQuery) ||
        (menuOrder.get(left.id) ?? 0) - (menuOrder.get(right.id) ?? 0) ||
        left.label.localeCompare(right.label, "de");
    })
    .map((item) => ({
      type: "menu",
      id: item.id,
      label: item.label,
      icon: item.icon,
    }));

  if (!lowerQuery) {
    return menuResults;
  }

  const teamResults: SearchResult[] = input.teams
    .filter((team) => scoreTeam(team, lowerQuery) >= 0)
    .filter((team) => Boolean(team.id && team.name))
    .sort((left, right) =>
      scoreTeam(right, lowerQuery) - scoreTeam(left, lowerQuery) ||
      (left.name ?? "").localeCompare(right.name ?? "", "de"),
    )
    .map((team) => ({
      type: "team",
      id: team.id as string,
      name: team.name as string,
      discipline: team.discipline,
      participants: team.participants ?? [],
      icon: "🏅",
    }));

  const participantResults: ParticipantSearchResult[] = [];
  const seenParticipantKeys = new Set<string>();

  for (const team of input.teams) {
    if (!team.id || !team.name) continue;

    for (const participant of team.participants ?? []) {
      const name = participantName(participant);
      if (!name || !participantMatchesQuery(participant, lowerQuery)) continue;

      const participantKey = participant.id ?? `${team.id}:${name.toLowerCase()}`;
      if (seenParticipantKeys.has(participantKey)) continue;
      seenParticipantKeys.add(participantKey);

      participantResults.push({
        type: "participant",
        id: participant.id ?? participantKey,
        name,
        teamId: team.id,
        teamName: team.name,
        discipline: team.discipline,
        icon: "🧍",
      });
    }
  }

  participantResults.sort((left, right) =>
    scoreValue(right.name, lowerQuery) - scoreValue(left.name, lowerQuery) ||
    left.name.localeCompare(right.name, "de"),
  );

  return [...menuResults, ...teamResults, ...participantResults];
}

export function groupSearchResults(results: SearchResult[]): SearchResultSection[] {
  const sections: SearchResultSection[] = [
    { key: "menu", label: "Navigation", results: [] },
    { key: "team", label: "Mannschaften", results: [] },
    { key: "participant", label: "Teilnehmer", results: [] },
  ];

  for (const result of results) {
    const section = sections.find((entry) => entry.key === result.type);
    if (section) {
      section.results.push(result);
    }
  }

  return sections.filter((section) => section.results.length > 0);
}

export function splitHighlightedText(text: string, query: string): HighlightPart[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery || !text) {
    return [{ text, highlighted: false }];
  }

  const normalizedText = text.toLowerCase();
  const startIndex = normalizedText.indexOf(normalizedQuery);

  if (startIndex < 0) {
    return [{ text, highlighted: false }];
  }

  const endIndex = startIndex + normalizedQuery.length;
  const parts: HighlightPart[] = [];

  if (startIndex > 0) {
    parts.push({ text: text.slice(0, startIndex), highlighted: false });
  }

  parts.push({ text: text.slice(startIndex, endIndex), highlighted: true });

  if (endIndex < text.length) {
    parts.push({ text: text.slice(endIndex), highlighted: false });
  }

  return parts;
}
