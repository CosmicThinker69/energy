import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { PortalProvider } from "@/components/portal-provider";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <PortalProvider initialUser={user}>
      <Shell>{children}</Shell>
    </PortalProvider>
  );
}
