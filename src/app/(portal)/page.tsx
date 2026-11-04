import { Overview } from "@/components/overview";
import { StoredOverview } from "@/components/stored-overview";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
export default async function Page() {
  const dashboards = await dashboardRepository.getEnabledDashboards();
  return process.env.MARKET_DATA_MODE === "demo" ? (
    <Overview dashboards={dashboards} />
  ) : (
    <StoredOverview dashboards={dashboards} />
  );
}
