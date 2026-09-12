import { Reports } from "@/components/reports";
import { reports } from "@/lib/reports";
import { AccessGate } from "@/components/analytics";
import { requireAccess } from "@/lib/server/auth";
export default async function Page() {
  const user = await requireAccess("reports");
  if (!user) return <AccessGate plan="premium" title="Reports" />;
  return (
    <Reports reports={reports.map(({ sections, ...metadata }) => metadata)} />
  );
}
