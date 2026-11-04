import { authorize } from "@/lib/server/auth";
import { readCoverage } from "@/lib/server/energy-service";
import {
  LocalDataUnavailable,
  localAgentStatus,
} from "@/lib/server/local-data-bridge";

export const runtime = "nodejs";
export async function GET() {
  const { error } = await authorize("overview");
  if (error) return error;
  try {
    const result = await readCoverage();
    return Response.json(
      {
        ...result,
        ...(process.env.DATA_BACKEND === "local-agent"
          ? { connection: await localAgentStatus(), backend: "local-agent" }
          : { backend: "postgres" }),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof LocalDataUnavailable)
      return Response.json(
        {
          error: error.message,
          backend: "local-agent",
          connection: await localAgentStatus(),
        },
        { status: 503 },
      );
    throw error;
  }
}
