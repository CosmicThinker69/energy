import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { dashboards, planName } from "@/lib/config";
import { Analytics } from "@/components/analytics";
import { AccessGate } from "@/components/analytics";
import { requireAccess } from "@/lib/server/auth";
import { DashboardViewer } from "@/components/dashboard-viewer";
import { Badge, Icon } from "@/components/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboard = dashboards.find((d) => d.id === id);
  if (!dashboard) notFound();
  const user = await requireAccess(dashboard.id);
  if (!user) {
    return <AccessGate plan={dashboard.plan} title={dashboard.title} />;
  }
  if (dashboard.viewerType !== "native") {
    return (
      <>
        <Link className="back-link dashboard-back" href="/dashboards">
          <Icon name="left" size={13} />
          Market dashboards<span>/</span>
          {dashboard.shortTitle}
        </Link>
        <div className="page-heading analytics-heading">
          <div>
            <div className="title-with-badge">
              <h1>{dashboard.title}</h1>
              <Badge tone="subtle">{planName(dashboard.plan)}</Badge>
              {dashboard.liveData && (
                <Badge tone="green" dot>
                  LIVE DATA
                </Badge>
              )}
            </div>
            <p>{dashboard.description}</p>
          </div>
        </div>
        <DashboardViewer
          type={dashboard.viewerType}
          source={dashboard.source}
          title={dashboard.title}
        />
      </>
    );
  }
  return (
    <Suspense>
      <Analytics dashboard={dashboard} />
    </Suspense>
  );
}
