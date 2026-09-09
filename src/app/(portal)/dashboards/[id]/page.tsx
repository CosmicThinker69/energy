import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dashboards } from "@/lib/config";
import { Analytics } from "@/components/analytics";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboard = dashboards.find((d) => d.id === id);
  if (!dashboard) notFound();
  return (
    <Suspense>
      <Analytics dashboard={dashboard} />
    </Suspense>
  );
}
