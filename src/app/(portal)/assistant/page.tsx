import { Assistant } from "@/components/assistant";
import { AccessGate } from "@/components/analytics";
import { requireAccess } from "@/lib/server/auth";

export const metadata = { title: "Ask TEMO | TEMO Energy" };

export default async function Page() {
  const user = await requireAccess("assistant");
  if (!user) return <AccessGate plan="premium" title="Ask TEMO" />;
  return <Assistant isAdmin={user.role === "admin"} />;
}
