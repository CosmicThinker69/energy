import { authorize, authorizeDashboardPlan } from "@/lib/server/auth";
import { dashboardRepository } from "@/lib/server/dashboard-repository";
import { countries, toCsv, type MarketRow } from "@/lib/market";
import { readMarketRows as storedMarketRows } from "@/lib/server/energy-service";
import { LocalDataUnavailable } from "@/lib/server/local-data-bridge";
export async function GET(request: Request) {
  try {
    const session = await authorize();
    if (session.error) return session.error;
    const p = new URL(request.url).searchParams;
    const id = p.get("dashboard") || "day-ahead";
    const dashboard =
      id === "explorer" || id === "overview"
        ? null
        : await dashboardRepository.getDashboardBySlug(id);
    if (!dashboard && id !== "explorer" && id !== "overview")
      return Response.json({ error: "Dashboard not found." }, { status: 404 });
    const { error } =
      id === "explorer" || id === "overview"
        ? await authorize(id)
        : await authorizeDashboardPlan(dashboard!.minimumPlan);
    if (error) return error;
    if (dashboard && dashboard.viewerType !== "native")
      return Response.json(
        { error: "This dashboard uses its configured external data source." },
        { status: 400 },
      );
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
    if (dashboard?.nativeKey === "country" && country !== "BG")
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
    const primary = await storedMarketRows({ country, days, resolution, date });
    const rows = primary.rows;
    const comparisons: Record<string, MarketRow[]> = Object.fromEntries(
      await Promise.all(
        compare.map(async (c) => [
          c,
          (await storedMarketRows({ country: c, days, resolution, date })).rows,
        ]),
      ),
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
        updatedAt: primary.updatedAt,
        source: primary.source,
        mode: "stored",
        timezone: "UTC",
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
