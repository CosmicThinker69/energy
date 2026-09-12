import { requireUser } from "@/lib/server/auth";
import { PortalProvider } from "@/components/portal-provider";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <PortalProvider initialUser={user}>
      <Shell>{children}</Shell>
    </PortalProvider>
  );
}
