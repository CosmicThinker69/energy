import { AdminDashboardManager } from "@/components/admin-dashboard-manager";
import { nativeDashboardKeys } from "@/lib/dashboard";
import { requireAdmin } from "@/lib/server/auth";
import { dashboardRepository } from "@/lib/server/dashboard-repository";

export default async function Page() {
  await requireAdmin();
  const dashboards = await dashboardRepository.getDashboards();
  return (
    <AdminDashboardManager
      initialDashboards={dashboards}
      nativeKeys={[...nativeDashboardKeys]}
    />
  );
}
