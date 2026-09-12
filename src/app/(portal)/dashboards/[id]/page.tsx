import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dashboards } from "@/lib/config";
import { Analytics } from "@/components/analytics";
import { AccessGate } from "@/components/analytics";
import { requireAccess } from "@/lib/server/auth";
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
  return (
    <Suspense>
      <Analytics dashboard={dashboard} />
    </Suspense>
  );
}
