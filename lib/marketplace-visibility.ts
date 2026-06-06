export type MarketplaceGlobalVisibility = "SELECTIVE" | "OFFLINE";

export type MarketplaceVisibility =
  | "PUBLIC"
  | "MARKETPLACE_USERS"
  | "PORTAL_USERS"
  | "ADMIN_MANAGEMENT_ONLY";

export const DEFAULT_MARKETPLACE_GLOBAL_VISIBILITY: MarketplaceGlobalVisibility = "SELECTIVE";

export function normalizeMarketplaceGlobalVisibility(value?: string | null): MarketplaceGlobalVisibility {
  return value === "OFFLINE" ? "OFFLINE" : DEFAULT_MARKETPLACE_GLOBAL_VISIBILITY;
}

export function canViewerSeeMarketplaceTeam(input: {
  globalVisibility?: string | null;
  teamVisibility?: string | null;
  isPrivilegedViewer: boolean;
  ownsMarketplaceTeam?: boolean;
  hasMarketplaceRegistration?: boolean;
  isAuthenticated?: boolean;
}) {
  if (input.isPrivilegedViewer) {
    return true;
  }

  const globalVisibility = normalizeMarketplaceGlobalVisibility(input.globalVisibility);
  if (globalVisibility === "OFFLINE") {
    return false;
  }

  if (input.ownsMarketplaceTeam) {
    return true;
  }

  switch (input.teamVisibility) {
    case "PUBLIC":
      return true;
    case "PORTAL_USERS":
      return input.isAuthenticated === true;
    case "MARKETPLACE_USERS":
      return input.hasMarketplaceRegistration === true;
    case "ADMIN_MANAGEMENT_ONLY":
    default:
      return false;
  }
}
