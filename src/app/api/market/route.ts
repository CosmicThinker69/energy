import { authorize } from "@/lib/server/auth";
import { dashboards } from "@/lib/config";
import { countries, generateMarketRows, toCsv } from "@/lib/market";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const id = p.get("dashboard") || "day-ahead";
  const config = dashboards.find((d) => d.id === id);
  if (!config && id !== "explorer")
    return Response.json({ error: "Dashboard not found." }, { status: 404 });
  const { error } = await authorize(
    id === "explorer" ? "explorer" : config!.id,
  );
  if (error) return error;
  const days = Number(p.get("days") || 1),
    resolution = p.get("resolution") || "hourly",
    country = p.get("country") || "BG",
    date = p.get("date") || undefined;
  if (
    !Number.isFinite(days) ||
    days < 1 ||
    days > 730 ||
    !["hourly", "daily", "monthly", "quarter-hourly"].includes(resolution) ||
    !countries.some((c) => c.code === country) ||
    (date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))))
  )
    return Response.json(
      { error: "Choose a valid market, date range, and resolution." },
      { status: 400 },
    );
  if (
    !Number.isInteger(days) ||
    (resolution === "hourly" && days > 30) ||
    (resolution === "quarter-hourly" && days > 7)
  )
    return Response.json(
      { error: "Use daily or monthly aggregation for longer date ranges." },
      { status: 400 },
    );
  if (date && new Date(date).toISOString().slice(0, 10) !== date)
    return Response.json(
      { error: "Choose a valid calendar date." },
      { status: 400 },
    );
  if (id === "country" && country !== "BG")
    return Response.json(
      {
        error:
          "This country overview covers Bulgaria. Use regional comparison for other markets.",
      },
      { status: 400 },
    );
  const compare = (p.get("compare") || "")
    .split(",")
    .filter((c) => countries.some((m) => m.code === c) && c !== country)
    .slice(0, 7);
  const rows = generateMarketRows({ country, days, resolution, date });
  const comparisons = Object.fromEntries(
    compare.map((c) => [
      c,
      generateMarketRows({ country: c, days, resolution, date }),
    ]),
  );
  if (p.get("format") === "csv")
    return new Response(
      toCsv([...rows, ...Object.values(comparisons).flat()]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="temo-${id}-${country}.csv"`,
          "Cache-Control": "no-store",
        },
      },
    );
  return Response.json(
    {
      rows,
      comparisons,
      updatedAt: new Date().toISOString(),
      source: "Simulated market data",
      timezone: "UTC",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
