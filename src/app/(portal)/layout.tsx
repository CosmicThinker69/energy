import { requireUser } from "@/lib/server/auth";
import { PortalProvider } from "@/components/portal-provider";
import { Shell } from "@/components/shell";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const dashboards = await dashboardRepository.getEnabledDashboards();
  return (
    <PortalProvider initialUser={user}>
      <Shell dashboards={dashboards}>{children}</Shell>
    </PortalProvider>
  );
}
