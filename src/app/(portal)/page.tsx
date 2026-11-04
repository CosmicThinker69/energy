import { StoredOverview } from "@/components/stored-overview";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
export default async function Page() {
  const dashboards = await dashboardRepository.getEnabledDashboards();
  return <StoredOverview dashboards={dashboards} />;
}
