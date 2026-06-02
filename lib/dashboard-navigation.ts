export type DashboardScope = "mine" | "all";

export const DASHBOARD_SCOPE_STORAGE_KEY = "s5evo-dashboard-scope";

export function isDashboardScope(value: string | null): value is DashboardScope {
  return value === "mine" || value === "all";
}

export function getStoredDashboardScope() {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(DASHBOARD_SCOPE_STORAGE_KEY);
  return isDashboardScope(stored) ? stored : null;
}

export function setStoredDashboardScope(scope: DashboardScope) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DASHBOARD_SCOPE_STORAGE_KEY, scope);
}
