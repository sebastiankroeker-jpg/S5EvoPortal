export type CompetitionPortalVisibility = "PRIVATE" | "PORTAL_USERS" | "PUBLIC";
export type CompetitionRegistrationVisibility = "CLOSED" | "PORTAL_USERS" | "PUBLIC";
export type CompetitionLifecycleStatus = "DRAFT" | "OPEN" | "RUNNING" | "CLOSED";

type VisibilityInput = {
  status: CompetitionLifecycleStatus;
  portalVisibility?: CompetitionPortalVisibility | null;
  registrationVisibility?: CompetitionRegistrationVisibility | null;
};

export type CompetitionViewerAccess = {
  authenticated: boolean;
  isAdmin?: boolean;
  hasOperationalAssignment?: boolean;
  hasOwnRelationship?: boolean;
};

/**
 * Legacy rows have no explicit visibility yet. Keep already published event
 * history readable, but never turn an old draft into a newly public draft.
 */
export function resolvePortalVisibility(competition: VisibilityInput): CompetitionPortalVisibility {
  if (competition.portalVisibility) return competition.portalVisibility;
  return competition.status === "DRAFT" ? "PRIVATE" : "PUBLIC";
}

/**
 * Registration no longer infers permission from the lifecycle. Null keeps the
 * former safe public OPEN-only behaviour until an admin chooses a setting.
 */
export function resolveRegistrationVisibility(competition: VisibilityInput): CompetitionRegistrationVisibility {
  if (competition.registrationVisibility) return competition.registrationVisibility;
  return competition.status === "OPEN" ? "PUBLIC" : "CLOSED";
}

export function canViewerReadCompetition(
  competition: VisibilityInput,
  viewer: CompetitionViewerAccess,
) {
  if (viewer.isAdmin || viewer.hasOperationalAssignment || viewer.hasOwnRelationship) return true;

  const visibility = resolvePortalVisibility(competition);
  return visibility === "PUBLIC" || (visibility === "PORTAL_USERS" && viewer.authenticated);
}

export function canViewerRegisterForCompetition(
  competition: VisibilityInput,
  viewer: CompetitionViewerAccess,
) {
  const visibility = resolveRegistrationVisibility(competition);
  if (visibility === "CLOSED") return false;
  if (visibility === "PUBLIC") return true;
  return viewer.authenticated;
}

export function selectDefaultCompetitionId<T extends VisibilityInput & { id: string; year: number }>(
  competitions: T[],
  preferredId?: string | null,
) {
  if (preferredId && competitions.some((competition) => competition.id === preferredId)) return preferredId;

  const newest = (candidates: T[]) => [...candidates].sort((left, right) => right.year - left.year)[0];
  return newest(competitions.filter((competition) => competition.status === "RUNNING"))?.id
    ?? newest(competitions.filter((competition) => competition.status === "CLOSED"))?.id
    ?? newest(competitions)?.id
    ?? null;
}
