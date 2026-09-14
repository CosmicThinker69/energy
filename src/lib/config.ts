export const plans = ["basic", "professional", "premium"] as const;
export type Plan = (typeof plans)[number];
export function canAccessPlan(plan: Plan, minimumPlan: Plan) {
  return plans.indexOf(plan) >= plans.indexOf(minimumPlan);
}
export function canAccess(
  plan: Plan,
  resource: "explorer" | "reports" | "overview",
) {
  const required =
    resource === "explorer"
      ? "professional"
      : resource === "reports"
        ? "premium"
        : "basic";
  return canAccessPlan(plan, required);
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
  role: "user" | "admin";
  createdAt: string;
};
