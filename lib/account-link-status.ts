export type AccountLinkClaimStatus = "missing_email" | "none" | "active" | "claimed" | "expired" | "revoked" | "linked";

export type AccountLinkDisplayStatus =
  | "linked"
  | "portal_account"
  | "invitation_open"
  | "placeholder_user"
  | "expired"
  | "revoked"
  | "missing_email"
  | "no_invitation";

export type AccountLinkStatusMeta = {
  status: AccountLinkDisplayStatus;
  label: string;
  className: string;
  description: string;
};

export function deriveAccountLinkStatus(input: {
  hasEmail?: boolean;
  hasEntityLink?: boolean;
  hasPortalAccount?: boolean;
  hasPlaceholderUser?: boolean;
  claimStatus?: AccountLinkClaimStatus | null;
  entityLabel?: string;
}) {
  const entityLabel = input.entityLabel || "Datensatz";
  const claimStatus = input.claimStatus || "none";

  if (input.hasEntityLink || claimStatus === "linked" || claimStatus === "claimed") {
    return {
      status: "linked",
      label: "Verknüpft",
      className: "border-green-300 bg-green-50 text-green-800",
      description: `${entityLabel} ist mit einem Portal-Konto verknüpft.`,
    } satisfies AccountLinkStatusMeta;
  }

  if (!input.hasEmail || claimStatus === "missing_email") {
    return {
      status: "missing_email",
      label: "Keine E-Mail hinterlegt",
      className: "border-muted bg-muted/30 text-muted-foreground",
      description: `Für diesen ${entityLabel} ist keine zustellbare E-Mail hinterlegt.`,
    } satisfies AccountLinkStatusMeta;
  }

  if (input.hasPortalAccount) {
    return {
      status: "portal_account",
      label: "Portal-Konto ohne Link",
      className: "border-sky-300 bg-sky-50 text-sky-800",
      description: "Ein Portal-Konto mit dieser E-Mail existiert bereits, die fachliche Zuordnung ist aber noch nicht abgeschlossen.",
    } satisfies AccountLinkStatusMeta;
  }

  if (input.hasPlaceholderUser) {
    return {
      status: "placeholder_user",
      label: "Login noch nicht aktiviert",
      className: "border-sky-300 bg-sky-50 text-sky-800",
      description:
        claimStatus === "active"
          ? "Ein interner Datensatz existiert bereits. Der Claim-Link ist noch offen, aber der Portal-Login wurde noch nicht bestätigt."
          : "Ein interner Datensatz existiert bereits, aber der Portal-Login wurde noch nicht bestätigt.",
    } satisfies AccountLinkStatusMeta;
  }

  if (claimStatus === "active") {
    return {
      status: "invitation_open",
      label: "Einladung ausstehend",
      className: "border-blue-300 bg-blue-50 text-blue-800",
      description: "Ein Claim-Link wurde versendet und wartet noch auf Einlösung.",
    } satisfies AccountLinkStatusMeta;
  }

  if (claimStatus === "expired") {
    return {
      status: "expired",
      label: "Einladung abgelaufen",
      className: "border-amber-300 bg-amber-50 text-amber-800",
      description: "Der Claim-Link ist abgelaufen.",
    } satisfies AccountLinkStatusMeta;
  }

  if (claimStatus === "revoked") {
    return {
      status: "revoked",
      label: "Einladung gesperrt",
      className: "border-red-300 bg-red-50 text-red-800",
      description: "Der Claim-Link wurde gesperrt.",
    } satisfies AccountLinkStatusMeta;
  }

  return {
    status: "no_invitation",
    label: "Keine Einladung versendet",
    className: "border-muted bg-muted/30 text-muted-foreground",
    description: `Für diesen ${entityLabel} wurde bisher kein Claim-Link versendet.`,
  } satisfies AccountLinkStatusMeta;
}
