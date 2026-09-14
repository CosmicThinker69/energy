import { DashboardLibrary } from "@/components/dashboard-library";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
export default async function Page() {
  const dashboards = await dashboardRepository.getEnabledDashboards();
  return <DashboardLibrary dashboards={dashboards} />;
}
