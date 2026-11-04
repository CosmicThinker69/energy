import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
export default async function Page() {
  await requireUser();
  notFound();
}
