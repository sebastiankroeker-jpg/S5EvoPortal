import { z } from "zod";

export const TEAM_DASHBOARD_KEY = "TEAM_DASHBOARD";
export const DASHBOARD_LAYOUT_CONFIG_VERSION = 1;

export const DASHBOARD_LAYOUT_SCOPES = ["PERSONAL", "GLOBAL"] as const;
export const DASHBOARD_VIEW_MODES = ["cards", "list"] as const;
export const TEAM_LAYOUT_VISIBLE_COLUMNS = [
  "category",
  "contactName",
  "contactEmail",
  "ownerEmail",
  "participantCount",
  "participants",
  "createdAt",
  "updatedAt",
] as const;
export const TEAM_LAYOUT_SORT_FIELDS = [
  "name",
  "category",
  "contactName",
  "contactEmail",
  "ownerEmail",
  "participantCount",
  "createdAt",
  "updatedAt",
] as const;
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export const TEAM_EXPORT_COLUMN_KEYS = [
  "teamName",
  "category",
  "contactName",
  "contactEmail",
  "ownerEmail",
  "participantCount",
  "participants",
  "createdAt",
  "updatedAt",
] as const;

export type DashboardLayoutScope = (typeof DASHBOARD_LAYOUT_SCOPES)[number];
export type DashboardViewMode = (typeof DASHBOARD_VIEW_MODES)[number];
export type TeamLayoutVisibleColumn = (typeof TEAM_LAYOUT_VISIBLE_COLUMNS)[number];
export type TeamLayoutSortField = (typeof TEAM_LAYOUT_SORT_FIELDS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
export type TeamExportColumnKey = (typeof TEAM_EXPORT_COLUMN_KEYS)[number];

export type TeamDashboardLayoutConfig = {
  version: typeof DASHBOARD_LAYOUT_CONFIG_VERSION;
  viewMode: DashboardViewMode;
  visibleColumns: TeamLayoutVisibleColumn[];
  sortField: TeamLayoutSortField;
  sortDirection: SortDirection;
  exportColumns: TeamExportColumnKey[];
};

const adminOnlyVisibleColumns = new Set<TeamLayoutVisibleColumn>(["createdAt"]);
const adminOnlySortFields = new Set<TeamLayoutSortField>(["createdAt"]);
const adminOnlyExportColumns = new Set<TeamExportColumnKey>(["createdAt"]);

export const DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG: TeamDashboardLayoutConfig = {
  version: DASHBOARD_LAYOUT_CONFIG_VERSION,
  viewMode: "list",
  visibleColumns: ["category", "participantCount", "participants", "updatedAt"],
  sortField: "updatedAt",
  sortDirection: "desc",
  exportColumns: ["teamName", "category", "participantCount", "participants", "updatedAt"],
};

export const TeamDashboardLayoutConfigSchema = z.object({
  version: z.literal(DASHBOARD_LAYOUT_CONFIG_VERSION).default(DASHBOARD_LAYOUT_CONFIG_VERSION),
  viewMode: z.enum(DASHBOARD_VIEW_MODES).default(DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.viewMode),
  visibleColumns: z.array(z.enum(TEAM_LAYOUT_VISIBLE_COLUMNS)).min(1).default(DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.visibleColumns),
  sortField: z.enum(TEAM_LAYOUT_SORT_FIELDS).default(DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.sortField),
  sortDirection: z.enum(SORT_DIRECTIONS).default(DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.sortDirection),
  exportColumns: z.array(z.enum(TEAM_EXPORT_COLUMN_KEYS)).min(1).default(DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.exportColumns),
}).strict();

export function sanitizeTeamDashboardLayoutConfig(
  value: unknown,
  options: { isAdmin: boolean },
): TeamDashboardLayoutConfig {
  const parsed = TeamDashboardLayoutConfigSchema.safeParse(value);
  const config = parsed.success ? parsed.data : DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG;

  const visibleColumns = config.visibleColumns.filter((column) => options.isAdmin || !adminOnlyVisibleColumns.has(column));
  const exportColumns = config.exportColumns.filter((column) => options.isAdmin || !adminOnlyExportColumns.has(column));
  const sortField = !options.isAdmin && adminOnlySortFields.has(config.sortField)
    ? DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.sortField
    : config.sortField;

  return {
    version: DASHBOARD_LAYOUT_CONFIG_VERSION,
    viewMode: config.viewMode,
    visibleColumns: visibleColumns.length > 0 ? visibleColumns : DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.visibleColumns.filter((column) => options.isAdmin || !adminOnlyVisibleColumns.has(column)),
    sortField,
    sortDirection: config.sortDirection,
    exportColumns: exportColumns.length > 0 ? exportColumns : DEFAULT_TEAM_DASHBOARD_LAYOUT_CONFIG.exportColumns.filter((column) => options.isAdmin || !adminOnlyExportColumns.has(column)),
  };
}
