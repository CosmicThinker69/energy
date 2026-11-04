import { authorize } from "@/lib/server/auth";
import { ENERGY_SOURCES } from "@/lib/server/energy-repository";
import { readObservations } from "@/lib/server/energy-service";
import { LocalDataUnavailable } from "@/lib/server/local-data-bridge";
import { toCsv } from "@/lib/market";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const { error } = await authorize("explorer");
  if (error) return error;
  const p = new URL(request.url).searchParams;
  const start = p.get("start"),
    end = p.get("end"),
    source = p.get("source"),
    dataset = p.get("dataset"),
    area = p.get("area");
  const limit = Number(p.get("limit") || 1000),
    offset = Number(p.get("offset") || 0);
  const from = Date.parse(start || ""),
    to = Date.parse(end || "");
  if (
    !source ||
    !ENERGY_SOURCES.includes(source) ||
    !dataset ||
    !area ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to <= from ||
    to - from > 366 * 86400000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5000 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  ) {
    return Response.json(
      {
        error:
          "Provide source, dataset, area, start and exclusive end (up to 366 days), limit 1..5000 and offset 0..1000000.",
      },
      { status: 400 },
    );
  }
  try {
    const result = await readObservations({
      source,
      dataset,
      area,
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      metric: p.get("metric"),
      forecastRun: p.get("forecast_run"),
      limit,
      offset,
    });
    const data = result.data;
    if (p.get("format") === "csv")
      return new Response(
        toCsv(
          data.map((r) => ({ ...r, dimensions: JSON.stringify(r.dimensions) })),
        ),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="temo-observations.csv"',
            "Cache-Control": "no-store",
          },
        },
      );
    return Response.json(
      {
        data,
        nextOffset: result.nextOffset,
        timezone: "UTC",
        endExclusive: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof LocalDataUnavailable)
      return Response.json(
        { error: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    throw error;
  }
}
