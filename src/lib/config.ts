export const plans = ["basic", "professional", "premium"] as const;
export type Plan = (typeof plans)[number];
export type DashboardId =
  | "day-ahead"
  | "energy-mix"
  | "regional"
  | "balancing"
  | "negative-prices"
  | "renewables"
  | "cross-border"
  | "historical"
  | "country"
  | "intelligence"
  | "entsoe-energy";
export type ViewerType = "native" | "iframe" | "streamlit" | "external-html";
export type DashboardConfig = {
  id: DashboardId;
  title: string;
  shortTitle: string;
  description: string;
  category: string;
  plan: Plan;
  icon: string;
  live: boolean;
  viewerType: ViewerType;
  source?: string;
  liveData?: boolean;
};
export const dashboards: DashboardConfig[] = [
  {
    id: "entsoe-energy",
    title: "ENTSO-E Energy Dashboard",
    shortTitle: "ENTSO-E energy",
    description:
      "Day-ahead electricity prices and actual generation mix from ENTSO-E.",
    category: "Market Data",
    plan: "basic",
    icon: "zap",
    live: true,
    liveData: true,
    viewerType: "streamlit",
    source: process.env.STREAMLIT_ENTSOE_URL,
  },
  {
    id: "day-ahead",
    title: "Day-Ahead Electricity Prices",
    shortTitle: "Day-ahead prices",
    description: "Hourly electricity prices across European bidding zones.",
    category: "Prices",
    plan: "basic",
    icon: "chart",
    live: true,
    viewerType: "native",
  },
  {
    id: "energy-mix",
    title: "Energy Generation Mix",
    shortTitle: "Energy mix",
    description:
      "Electricity production, broken down by generation technology.",
    category: "Generation",
    plan: "basic",
    icon: "pie",
    live: true,
    viewerType: "native",
  },
  {
    id: "regional",
    title: "Regional Price Comparison",
    shortTitle: "Regional price comparison",
    description: "A connected view of prices and spreads across eight markets.",
    category: "Regional",
    plan: "professional",
    icon: "globe",
    live: true,
    viewerType: "native",
  },
  {
    id: "balancing",
    title: "Balancing Market",
    shortTitle: "Balancing market",
    description: "Upward and downward balancing prices and activated volumes.",
    category: "Balancing",
    plan: "professional",
    icon: "activity",
    live: true,
    viewerType: "native",
  },
  {
    id: "negative-prices",
    title: "Negative Price Analysis",
    shortTitle: "Negative price analysis",
    description:
      "Track the frequency, duration, and drivers of negative prices.",
    category: "Prices",
    plan: "premium",
    icon: "down",
    live: false,
    viewerType: "native",
  },
  {
    id: "renewables",
    title: "Renewable Generation",
    shortTitle: "Renewable generation",
    description: "Solar, wind, and hydro output across the energy transition.",
    category: "Generation",
    plan: "professional",
    icon: "leaf",
    live: true,
    viewerType: "native",
  },
  {
    id: "cross-border",
    title: "Cross-Border Electricity Flows",
    shortTitle: "Cross-border flows",
    description:
      "Explore electricity imports, exports, and interconnector use.",
    category: "Regional",
    plan: "professional",
    icon: "arrows",
    live: true,
    viewerType: "native",
  },
  {
    id: "historical",
    title: "Historical Market Analysis",
    shortTitle: "Historical market analysis",
    description:
      "Put today in perspective with daily and monthly market trends.",
    category: "Research",
    plan: "premium",
    icon: "history",
    live: false,
    viewerType: "native",
  },
  {
    id: "country",
    title: "Bulgaria Market Overview",
    shortTitle: "Country market overview",
    description: "A detailed view of Bulgaria’s prices, supply, and demand.",
    category: "Regional",
    plan: "basic",
    icon: "pin",
    live: true,
    viewerType: "native",
  },
  {
    id: "intelligence",
    title: "Advanced Market Intelligence",
    shortTitle: "Advanced market intelligence",
    description:
      "Capture price signals, renewable capture rates, and volatility.",
    category: "Research",
    plan: "premium",
    icon: "sparkles",
    live: false,
    viewerType: "native",
  },
];
export const permissions = Object.fromEntries(
  dashboards.map((d) => [d.id, d.plan]),
) as Record<DashboardId, Plan>;
export function canAccess(
  plan: Plan,
  resource: DashboardId | "explorer" | "reports" | "overview",
) {
  const required =
    resource === "explorer"
      ? "professional"
      : resource === "reports"
        ? "premium"
        : resource === "overview"
          ? "basic"
          : permissions[resource];
  return plans.indexOf(plan) >= plans.indexOf(required);
}
export function planName(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
export const planDetails: Record<
  Plan,
  { description: string; features: string[] }
> = {
  basic: {
    description: "Essential market information.",
    features: [
      "Market overview",
      "Day-ahead prices & energy mix",
      "Live ENTSO-E dashboard",
      "Bulgaria market overview",
      "Live market updates",
    ],
  },
  professional: {
    description: "A broader view of the market.",
    features: [
      "Everything in Basic",
      "Regional & balancing markets",
      "Renewables & cross-border flows",
      "Data Explorer & CSV exports",
    ],
  },
  premium: {
    description: "The complete intelligence platform.",
    features: [
      "Everything in Professional",
      "Negative price analysis",
      "Historical & advanced intelligence",
      "Advanced research reports",
    ],
  },
};
export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  plan: Plan;
  createdAt: string;
};
