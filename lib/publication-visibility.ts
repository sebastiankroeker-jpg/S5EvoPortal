export type TeamPublicationLevel =
  | "TEAM_ANONYM"
  | "TEAMNAME_OEFFENTLICH"
  | "ALLES_OEFFENTLICH";

export type ParticipantPublicationPreference =
  | "NAME_VERBERGEN"
  | "NAME_VEROEFFENTLICHEN";

export const ANONYMOUS_TEAM_NAME = "Anonymes Team";
export const ANONYMOUS_PARTICIPANT_NAME = "Teilnehmer:in";

function normalizeTeamPublicationLevel(
  value?: string | null,
): TeamPublicationLevel {
  if (value === "TEAMNAME_OEFFENTLICH" || value === "ALLES_OEFFENTLICH") {
    return value;
  }
  return "TEAM_ANONYM";
}

function normalizeParticipantPublicationPreference(
  value?: string | null,
): ParticipantPublicationPreference {
  if (value === "NAME_VEROEFFENTLICHEN") {
    return value;
  }
  return "NAME_VERBERGEN";
}

export function canViewerSeeFullPublication(options: {
  isPrivilegedViewer: boolean;
  ownsTeam?: boolean;
}) {
  return options.isPrivilegedViewer || Boolean(options.ownsTeam);
}

export function resolveVisibleTeamName(input: {
  actualTeamName: string;
  teamPublicationLevel?: string | null;
  canSeeFullPublication: boolean;
}) {
  if (input.canSeeFullPublication) {
    return input.actualTeamName;
  }

  const teamPublicationLevel = normalizeTeamPublicationLevel(input.teamPublicationLevel);
  return teamPublicationLevel === "TEAM_ANONYM"
    ? ANONYMOUS_TEAM_NAME
    : input.actualTeamName;
}

export function resolveVisibleParticipantName(input: {
  actualName: string;
  teamPublicationLevel?: string | null;
  participantPublicationPreference?: string | null;
  canSeeFullPublication: boolean;
}) {
  if (input.canSeeFullPublication) {
    return input.actualName;
  }

  const teamPublicationLevel = normalizeTeamPublicationLevel(input.teamPublicationLevel);
  const participantPublicationPreference = normalizeParticipantPublicationPreference(
    input.participantPublicationPreference,
  );

  if (
    teamPublicationLevel === "ALLES_OEFFENTLICH" &&
    participantPublicationPreference === "NAME_VEROEFFENTLICHEN"
  ) {
    return input.actualName;
  }

  return ANONYMOUS_PARTICIPANT_NAME;
}

export function splitDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { firstName: ANONYMOUS_PARTICIPANT_NAME, lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "",
  };
}
