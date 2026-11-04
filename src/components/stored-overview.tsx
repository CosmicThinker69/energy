"use client";
import Link from "next/link";
import { useState } from "react";
import {
  countries,
  formatNumber,
  generationMix,
  marketAverage,
} from "@/lib/market";
import { usePortal } from "./portal-provider";
import { useMarket } from "./use-market";
import { Badge, EmptyState, Flag, Panel, Skeleton } from "./ui";
import { MarketChart, MixChart, countrySeries } from "./charts";
import type { DashboardRecord } from "@/lib/dashboard";

export function StoredOverview({
  dashboards,
}: {
  dashboards: DashboardRecord[];
}) {
  const { user } = usePortal();
  const [country, setCountry] = useState("BG");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading, error, refresh } = useMarket({
    dashboard: "overview",
    country,
    date,
    days: "1",
    resolution: "hourly",
    compare: countries
      .filter((c) => c.code !== country)
      .map((c) => c.code)
      .join(","),
  });
  const rows = data?.rows || [];
  const sets = { ...(data?.comparisons || {}), [country]: rows };
  const actual = [...rows]
    .reverse()
    .find(
      (r) =>
        typeof r.generation === "number" &&
        Date.parse(r.timestamp) <= Date.now(),
    );
  const actualGeneration = actual?.generation ?? NaN;
  const price = marketAverage(rows, "price");
  const regional = countries
    .map((c) => marketAverage(sets[c.code] || [], "price"))
    .filter(Number.isFinite);
  const chartTimes = [
    ...new Set(Object.values(sets).flatMap((s) => s.map((r) => r.timestamp))),
  ].sort();
  const chartData = chartTimes.map((time) => ({
    label: time.slice(11, 16),
    ...Object.fromEntries(
      countries.map((c) => [
        c.code,
        sets[c.code]?.find((r) => r.timestamp === time)?.price,
      ]),
    ),
  }));
  const mix = generationMix.map((m) => ({
    ...m,
    value:
      actual && actualGeneration > 0
        ? typeof actual[m.name.toLowerCase()] === "number"
          ? (Number(actual[m.name.toLowerCase()]) / actualGeneration) * 100
          : null
        : null,
  }));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">THE ENERGY PERSPECTIVE</div>
          <h1>Market overview, {user.firstName}</h1>
          <p>Reported electricity data across European markets.</p>
        </div>
        <div className="heading-controls">
          <select
            aria-label="Overview market"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="date-input"
            aria-label="Overview date"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
          <button className="button" onClick={refresh}>
            Refresh data
          </button>
        </div>
      </div>
      <div className="data-context">
        <span>{data?.source || "Stored observations"} · UTC</span>
        <span>
          {data?.updatedAt
            ? `Collected ${new Date(data.updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Sofia" })}`
            : "Awaiting collection"}{" "}
          <Badge tone="subtle">Reported data</Badge>
        </span>
      </div>
      {error ? (
        <EmptyState
          title="Market data is unavailable"
          description={error}
          action={
            <button className="button" onClick={refresh}>
              Retry loading data
            </button>
          }
        />
      ) : loading && !data ? (
        <Skeleton className="chart-skeleton" />
      ) : (
        <>
          <div className="kpi-grid">
            {[
              ["Day average price", formatNumber(price), "EUR / MWh"],
              [
                "Regional average",
                formatNumber(
                  regional.length
                    ? regional.reduce((s, v) => s + v, 0) / regional.length
                    : NaN,
                ),
                "EUR / MWh",
              ],
              [
                "Latest generation",
                formatNumber(actual ? actualGeneration / 1000 : NaN),
                "GW",
              ],
              ["Renewable share", formatNumber(actual?.renewable, 1), "%"],
            ].map(([label, value, unit]) => (
              <section className="kpi" key={label}>
                <div className="kpi-title">{label}</div>
                <div className="kpi-middle">
                  <div className="kpi-value">
                    {value}
                    <small>{unit}</small>
                  </div>
                </div>
                <div className="kpi-bottom">
                  {label === "Regional average"
                    ? `${regional.length} markets reporting`
                    : label === "Latest generation" ||
                        label === "Renewable share"
                      ? actual
                        ? actual.timestamp.replace("T", " ").slice(0, 16) +
                          " UTC"
                        : "No interval reported"
                      : "Delivery date " + date}
                </div>
              </section>
            ))}
          </div>
          <div className="overview-primary">
            <Panel
              title="Day-ahead electricity prices"
              subtitle="Duration weighted hourly prices · gaps indicate unavailable data"
            >
              <MarketChart
                data={chartData}
                series={countrySeries}
                height={250}
              />
            </Panel>
            <Panel
              title="Generation mix"
              subtitle={`${countries.find((c) => c.code === country)?.name} · latest reported interval`}
            >
              {actual ? (
                <>
                  <MixChart generation={actualGeneration / 1000} mix={mix} />
                  <p>
                    Generation includes all reported technologies. The chart
                    shows the main technology groups.
                  </p>
                </>
              ) : (
                <p>No generation reported for this date.</p>
              )}
            </Panel>
          </div>
          <Panel
            title="Regional market comparison"
            subtitle="Daily average prices · EUR / MWh"
          >
            <div className="table-scroll">
              <table className="regional-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Price</th>
                    <th>Reported hours</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => {
                    const values = sets[c.code] || [];
                    const prices = values.filter(
                      (r) => typeof r.price === "number",
                    );
                    return (
                      <tr key={c.code}>
                        <td>
                          <Flag code={c.code} /> {c.name}
                        </td>
                        <td>{formatNumber(marketAverage(prices, "price"))}</td>
                        <td>{prices.length} / 24</td>
                        <td>
                          {prices.length === 24
                            ? "Complete"
                            : prices.length
                              ? "Partial"
                              : "Awaiting collection"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      <div className="explore-banner">
        <div>
          <strong>Explore the source data</strong>
          <p>
            Electricity, gas storage, LNG and weather coverage, with attribution
            and collection status.
          </p>
        </div>
        <Link href="/data" className="button">
          Open data catalogue
        </Link>
        <Link href="/dashboards" className="button">
          View {dashboards.length} dashboards
        </Link>
      </div>
    </>
  );
}
