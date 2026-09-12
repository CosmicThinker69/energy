import { Explorer } from "@/components/explorer";
import { AccessGate } from "@/components/analytics";
import { requireAccess } from "@/lib/server/auth";
export default async function Page() {
  const user = await requireAccess("explorer");
  if (!user) return <AccessGate plan="professional" title="Data Explorer" />;
  return <Explorer />;
}
