import { readOfflineCache, writeOfflineCache } from "@/lib/pwa-offline-cache";

type TeamWatchlistData = {
  teamIds: string[];
};

export function getTeamWatchlistKey(competitionId: string) {
  return `s5evo.watchlist.teams.v1.${competitionId}`;
}

export function readTeamWatchlist(competitionId: string) {
  const cached = readOfflineCache<TeamWatchlistData>(getTeamWatchlistKey(competitionId));
  const teamIds = cached?.data.teamIds;
  if (!Array.isArray(teamIds)) return [];

  return Array.from(new Set(teamIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
}

export function writeTeamWatchlist(competitionId: string, teamIds: string[]) {
  const normalizedTeamIds = Array.from(new Set(teamIds.filter((id) => id.length > 0)));
  writeOfflineCache(getTeamWatchlistKey(competitionId), { teamIds: normalizedTeamIds });
  return normalizedTeamIds;
}
