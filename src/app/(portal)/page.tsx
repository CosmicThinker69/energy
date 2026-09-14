import { Overview } from "@/components/overview";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
export default async function Page() {
  const dashboards = await dashboardRepository.getEnabledDashboards();
  return <Overview dashboards={dashboards} />;
}
