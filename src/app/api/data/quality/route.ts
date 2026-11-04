import { authorize } from "@/lib/server/auth";
import { readQuality } from "@/lib/server/energy-service";
import { LocalDataUnavailable } from "@/lib/server/local-data-bridge";

export const runtime = "nodejs";
export async function GET() {
  const { error } = await authorize("explorer");
  if (error) return error;
  try {
    return Response.json(await readQuality(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LocalDataUnavailable)
      return Response.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
