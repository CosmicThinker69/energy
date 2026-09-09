import { authorize } from "@/lib/server/auth";
import { reports } from "@/lib/reports";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await authorize("reports");
  if (error) return error;
  const { id } = await params;
  const report = reports.find((r) => r.id === id);
  if (!report)
    return Response.json({ error: "Report not found." }, { status: 404 });
  if (new URL(request.url).searchParams.get("download") === "1")
    return new Response(
      `${report.title}\nTEMO Research | ${report.date}\nSIMULATED DEMONSTRATION RESEARCH\n\n${report.sections.map(([h, p]) => `${h}\n${p}`).join("\n\n")}`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="temo-${id}.txt"`,
        },
      },
    );
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
