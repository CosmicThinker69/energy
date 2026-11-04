import { authorize } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { ENERGY_SOURCES } from "@/lib/server/energy-repository";
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
  const rows = await query(
    `SELECT o.source,o.dataset,o.area,o.metric,o.dimensions,o.interval_start,o.interval_end,
    o.value,o.unit,o.quality,o.forecast_run,o.provider_published_at,o.first_seen_at,o.last_seen_at,
    s.attribution,s.licence,s.upstream
    FROM energy.observations o JOIN energy.sources s ON s.id=o.source
    WHERE o.source=$1 AND o.dataset=$2 AND o.area=$3 AND o.interval_start>=$4 AND o.interval_start<$5
      AND ($6::text IS NULL OR o.metric=$6) AND ($7::text IS NULL OR o.forecast_run=$7)
    ORDER BY o.interval_start,o.metric,o.dimension_key,o.forecast_run LIMIT $8 OFFSET $9`,
    [
      source,
      dataset,
      area,
      new Date(from),
      new Date(to),
      p.get("metric"),
      p.get("forecast_run"),
      limit + 1,
      offset,
    ],
  );
  const more = rows.rows.length > limit;
  const data = rows.rows.slice(0, limit);
  if (p.get("format") === "csv")
    return new Response(
      toCsv(
        data.map((r) => ({ ...r, dimensions: JSON.stringify(r.dimensions) })),
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="temo-observations.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  return Response.json(
    {
      data,
      nextOffset: more ? offset + limit : null,
      timezone: "UTC",
      endExclusive: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
