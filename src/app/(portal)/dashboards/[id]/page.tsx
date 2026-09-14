import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { planName } from "@/lib/config";
import { AccessGate } from "@/components/analytics";
import { requireDashboardPlan } from "@/lib/server/auth";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
import { DashboardViewer } from "@/components/dashboard-viewer";
import { Badge, Icon } from "@/components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboard = await dashboardRepository.getDashboardBySlug(id);
  if (!dashboard) notFound();
  const user = await requireDashboardPlan(dashboard.minimumPlan);
  if (!user) {
    return <AccessGate plan={dashboard.minimumPlan} title={dashboard.title} />;
  }
  if (dashboard.viewerType !== "native") {
    return (
      <>
        <Link className="back-link dashboard-back" href="/dashboards">
          <Icon name="left" size={13} />
          Market dashboards<span>/</span>
          {dashboard.title}
        </Link>
        <div className="page-heading analytics-heading">
          <div>
            <div className="title-with-badge">
              <h1>{dashboard.title}</h1>
              <Badge tone="subtle">{planName(dashboard.minimumPlan)}</Badge>
              {dashboard.badge && (
                <Badge tone="green" dot={dashboard.badge === "LIVE DATA"}>
                  {dashboard.badge}
                </Badge>
              )}
            </div>
            <p>{dashboard.description}</p>
          </div>
        </div>
        <DashboardViewer dashboard={dashboard} />
      </>
    );
  }
  return (
    <Suspense>
      <DashboardViewer dashboard={dashboard} />
    </Suspense>
  );
}
