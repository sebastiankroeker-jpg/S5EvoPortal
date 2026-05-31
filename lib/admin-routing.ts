"use client";

type ChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export const ACTIVE_TAB_STORAGE_KEY = "s5evo-active-tab";
export const TEAM_VIEW_STORAGE_KEY = "s5evo-team-view";
export const TEAM_FOCUS_STORAGE_KEY = "s5evo.dashboard.focusTeamId";
export const TEAM_SEARCH_STORAGE_KEY = "s5evo.dashboard.searchQuery";

function pushLocation(path: string) {
  window.location.href = path;
}

export function openTeamDashboard(input: { teamId?: string | null; search?: string | null } = {}) {
  window.sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, "registration");
  window.sessionStorage.setItem(TEAM_VIEW_STORAGE_KEY, "mannschaften");
  if (input.teamId) window.sessionStorage.setItem(TEAM_FOCUS_STORAGE_KEY, input.teamId);
  if (input.search?.trim()) window.sessionStorage.setItem(TEAM_SEARCH_STORAGE_KEY, input.search.trim());
  pushLocation("/#registration");
}

export function openUserDashboard(input: { userId?: string | null; email?: string | null; teamId?: string | null } = {}) {
  const params = new URLSearchParams({ tab: "users" });
  if (input.userId) params.set("userId", input.userId);
  if (input.email?.trim()) params.set("userQuery", input.email.trim());
  if (input.teamId) params.set("teamId", input.teamId);
  pushLocation(`/admin?${params.toString()}`);
}

export function openChangesDashboard(
  input: {
    participantId?: string | null;
    teamId?: string | null;
    status?: ChangeStatus | null;
    search?: string | null;
  } = {},
) {
  const params = new URLSearchParams();
  if (input.participantId) params.set("participantId", input.participantId);
  if (input.teamId) params.set("teamId", input.teamId);
  if (input.status) params.set("status", input.status);
  if (input.search?.trim()) params.set("q", input.search.trim());
  const query = params.toString();
  pushLocation(query ? `/aenderungen?${query}` : "/aenderungen");
}
