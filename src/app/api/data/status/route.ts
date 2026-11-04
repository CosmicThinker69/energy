import { authorize } from "@/lib/server/auth";
import { dataCoverage } from "@/lib/server/energy-repository";

export const runtime = "nodejs";
export async function GET() {
  const { error } = await authorize("overview");
  if (error) return error;
  return Response.json(await dataCoverage(), {
    headers: { "Cache-Control": "no-store" },
  });
}
