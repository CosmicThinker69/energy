import type { Plan } from "./config";

export const viewerTypes = ["native", "streamlit", "external-html"] as const;
export type ViewerType = (typeof viewerTypes)[number];

export const nativeDashboardKeys = [
  "day-ahead",
  "energy-mix",
  "regional",
  "balancing",
  "negative-prices",
  "renewables",
  "cross-border",
  "historical",
  "country",
  "intelligence",
] as const;
export type NativeDashboardKey = (typeof nativeDashboardKeys)[number];

export type DashboardRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  viewerType: ViewerType;
  nativeKey: NativeDashboardKey | null;
  sourceUrl: string | null;
  minimumPlan: Plan;
  badge: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardInput = Pick<
  DashboardRecord,
  | "slug"
  | "title"
  | "description"
  | "category"
  | "viewerType"
  | "nativeKey"
  | "sourceUrl"
  | "minimumPlan"
  | "badge"
  | "enabled"
  | "sortOrder"
>;

export function isNativeDashboardKey(
  value: unknown,
): value is NativeDashboardKey {
  return nativeDashboardKeys.includes(value as NativeDashboardKey);
}

export function dashboardIcon(dashboard: DashboardRecord) {
  if (dashboard.viewerType === "streamlit") return "zap";
  if (dashboard.viewerType === "external-html") return "external";
  const icons: Record<NativeDashboardKey, string> = {
    "day-ahead": "chart",
    "energy-mix": "pie",
    regional: "globe",
    balancing: "activity",
    "negative-prices": "down",
    renewables: "leaf",
    "cross-border": "arrows",
    historical: "history",
    country: "pin",
    intelligence: "sparkles",
  };
  return dashboard.nativeKey ? icons[dashboard.nativeKey] : "chart";
}
