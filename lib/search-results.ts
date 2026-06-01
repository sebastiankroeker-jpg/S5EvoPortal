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

export type SearchResultSection = {
  key: "menu" | "team" | "participant";
  label: string;
  results: SearchResult[];
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

  const menuResults: SearchResult[] = input.permittedMenuItems
    .filter((item) => {
      if (!lowerQuery) return true;
      return (
        item.label.toLowerCase().includes(lowerQuery) ||
        item.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
      );
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
    .filter((team) => valueMatchesQuery(team.name, lowerQuery))
    .filter((team) => Boolean(team.id && team.name))
    .map((team) => ({
      type: "team",
      id: team.id as string,
      name: team.name as string,
      discipline: team.discipline,
      participants: team.participants ?? [],
      icon: "🏅",
    }));

  const participantResults: SearchResult[] = [];
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
