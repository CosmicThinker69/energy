import { authorize } from "@/lib/server/auth";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await authorize("reports");
  if (error) return error;
  return Response.json(
    { error: "No published report is available." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
