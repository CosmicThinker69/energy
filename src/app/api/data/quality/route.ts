import { authorize } from "@/lib/server/auth";
import { energyQuality } from "@/lib/server/energy-quality";

export const runtime = "nodejs";
export async function GET() {
  const { error } = await authorize("explorer");
  if (error) return error;
  return Response.json(await energyQuality(), {
    headers: { "Cache-Control": "no-store" },
  });
}
