"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { canAccess, planName, type DashboardConfig } from "@/lib/config";
import {
  countries,
  formatNumber,
  generationMix,
  withLiveSnapshot,
  type MarketRow,
} from "@/lib/market";
import {
  ChartLegend,
  FlowNetwork,
  MarketChart,
  MixChart,
  PriceDistribution,
  type ChartSeries,
} from "./charts";
import { Badge, EmptyState, Flag, Icon, Panel, Skeleton } from "./ui";
import { usePortal } from "./portal-provider";
import { DashboardViewer } from "./dashboard-viewer";
import { downloadFile, useMarket } from "./use-market";
const green = "var(--mint)",
  cyan = "var(--cyan)",
  violet = "var(--violet)",
  amber = "var(--amber)";
export function AccessGate({
  plan,
  title,
}: {
  plan: "professional" | "premium";
  title: string;
}) {
  const { requestUpgrade } = usePortal();
  return (
    <div className="access-gate">
      <span className="large-icon">
        <Icon name="lock" size={27} />
      </span>
      <Badge tone="cyan">{planName(plan)} access</Badge>
      <h2>A wider perspective is one switch away.</h2>
      <p>
        {title} is included in the {planName(plan)} plan. Explore it with a free
        demo plan change, available instantly.
      </p>
      <button
        className="button primary"
        onClick={() => requestUpgrade(plan, title)}
      >
        Explore {planName(plan)}
        <Icon name="right" size={16} />
      </button>
      <Link href="/dashboards" className="text-button">
        Back to dashboard library
      </Link>
    </div>
  );
}
function analyticsConfig(id: string): {
  series: ChartSeries[];
  kind: "line" | "area" | "bar";
  unit: string;
  title: string;
  primary: string;
  columns: [string, string, string][];
} {
  const priceColumns: [string, string, string][] = [
    ["price", "Day-ahead", "€/MWh"],
    ["balancing", "Balancing", "€/MWh"],
    ["generation", "Generation", "MW"],
    ["renewable", "Renewables", "%"],
  ];
  if (id === "energy-mix" || id === "renewables")
    return {
      series: (id === "renewables"
        ? generationMix.filter((m) =>
            ["Solar", "Wind", "Hydro", "Biomass"].includes(m.name),
          )
        : generationMix
      ).map((m) => ({
        key: m.name.toLowerCase(),
        label: m.name,
        color: m.color,
      })),
      kind: "area",
      unit: "MW",
      title:
        id === "renewables"
          ? "Renewable generation by technology"
          : "Generation by technology",
      primary: id === "renewables" ? "renewableGeneration" : "generation",
      columns: [
        ["solar", "Solar", "MW"],
        ["wind", "Wind", "MW"],
        ["hydro", "Hydro", "MW"],
        ["nuclear", "Nuclear", "MW"],
        ["generation", "Total", "MW"],
      ],
    };
  if (id === "balancing")
    return {
      series: [
        { key: "upward", label: "Upward activation", color: green },
        { key: "downward", label: "Downward activation", color: cyan },
        { key: "balancing", label: "Settlement price", color: violet },
      ],
      kind: "line",
      unit: "€/MWh",
      title: "Balancing energy prices",
      primary: "balancing",
      columns: [
        ["upward", "Upward", "€/MWh"],
        ["downward", "Downward", "€/MWh"],
        ["balancing", "Settlement", "€/MWh"],
        ["volume", "Activated volume", "MWh"],
      ],
    };
  if (id === "cross-border")
    return {
      series: [
        { key: "export", label: "Exports", color: green },
        { key: "import", label: "Imports", color: cyan },
        { key: "netFlow", label: "Net exports", color: violet },
      ],
      kind: "line",
      unit: "MW",
      title: "Scheduled cross-border electricity flows",
      primary: "netFlow",
      columns: [
        ["export", "Exports", "MW"],
        ["import", "Imports", "MW"],
        ["netFlow", "Net exports", "MW"],
        ["price", "Market price", "€/MWh"],
      ],
    };
  if (id === "intelligence")
    return {
      series: [
        { key: "price", label: "Market price", color: green },
        { key: "capture", label: "Renewable capture price", color: cyan },
      ],
      kind: "line",
      unit: "€/MWh",
      title: "Market price and renewable capture",
      primary: "capture",
      columns: [
        ["price", "Market price", "€/MWh"],
        ["capture", "Capture price", "€/MWh"],
        ["volatility", "Volatility", "%"],
        ["renewable", "Renewables", "%"],
      ],
    };
  return {
    series: [{ key: "price", label: "Day-ahead price", color: green }],
    kind: id === "negative-prices" ? "bar" : "line",
    unit: "€/MWh",
    title:
      id === "historical"
        ? "Historical electricity prices"
        : id === "negative-prices"
          ? "Price intervals and negative events"
          : id === "regional"
            ? "Prices across connected markets"
            : "Day-ahead electricity prices",
    primary: "price",
    columns: priceColumns,
  };
}
export function Analytics({ dashboard }: { dashboard: DashboardConfig }) {
  const { user, live, status, toast } = usePortal(),
    search = useSearchParams();
  const [country, setCountry] = useState(
    dashboard.id === "country"
      ? "BG"
      : countries.some((c) => c.code === search.get("country"))
        ? search.get("country")!
        : "BG",
  );
  const [days, setDays] = useState(
    dashboard.id === "historical"
      ? "365"
      : dashboard.id === "negative-prices"
        ? "30"
        : "1",
  );
  const [resolution, setResolution] = useState(
    dashboard.id === "historical" ? "daily" : "hourly",
  );
  const [date, setDate] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(search.get("date") || "")
      ? search.get("date")!
      : new Date().toISOString().slice(0, 10),
  );
  const [compare, setCompare] = useState(
    dashboard.id === "regional" ? "RO" : "",
  );
  const [tablePage, setTablePage] = useState(0),
    [exporting, setExporting] = useState(false),
    [section, setSection] = useState("analytics");
  const viewerRef = useRef<HTMLDivElement>(null);
  const allowed = canAccess(user.plan, dashboard.id);
  const config = analyticsConfig(dashboard.id);
  const { data, loading, error, refresh, csvUrl } = useMarket(
    { dashboard: dashboard.id, country, days, resolution, date, compare },
    allowed,
  );
  const rows = data?.rows || [];
  const liveEnabled =
    dashboard.live &&
    (country === "BG" || country === "RO") &&
    days === "1" &&
    date === new Date().toISOString().slice(0, 10) &&
    resolution !== "daily" &&
    resolution !== "monthly";
  const latest =
    rows.length && liveEnabled && live
      ? withLiveSnapshot(rows.at(-1)!, live)
      : rows.at(-1);
  const metric = rows.map((r) => Number(r[config.primary]));
  const avg = metric.length
    ? metric.reduce((a, b) => a + b, 0) / metric.length
    : 0;
  const min = metric.length ? Math.min(...metric) : 0,
    max = metric.length ? Math.max(...metric) : 0;
  const negatives = rows.filter((r) => r.price < 0);
  const negativeHours =
    rows.reduce((sum, r) => sum + r.negative, 0) *
    (resolution === "quarter-hourly" ? 0.25 : 1);
  const maxRow = rows.find((r) => Number(r[config.primary]) === max),
    minRow = rows.find((r) => Number(r[config.primary]) === min);
  const primaryLabel =
    dashboard.id === "energy-mix"
      ? "Total generation"
      : dashboard.id === "renewables"
        ? "Renewable output"
        : dashboard.id === "balancing"
          ? "Settlement price"
          : dashboard.id === "cross-border"
            ? "Net exports"
            : dashboard.id === "intelligence"
              ? "Capture price"
              : "Latest interval";
  const chartData = useMemo(
    () =>
      rows.map((r, i) => {
        const item: Record<string, unknown> = {
          ...(liveEnabled && live && i === rows.length - 1
            ? withLiveSnapshot(r, live)
            : r),
        };
        Object.entries(data?.comparisons || {}).forEach(([code, values]) => {
          item[code] = values[i]?.price;
        });
        return item;
      }),
    [rows, data?.comparisons, live, liveEnabled, country, config.primary],
  );
  const series = [
    ...config.series,
    ...(config.primary === "price" && compare
      ? [
          {
            key: compare,
            label: countries.find((c) => c.code === compare)?.name || compare,
            color: cyan,
          },
        ]
      : []),
  ];
  const activeCurrent = latest ? Number(latest[config.primary]) : 0;
  const unit = config.unit;
  const change =
    metric.length > 1
      ? ((metric.at(-1)! - metric[0]) / Math.max(Math.abs(metric[0]), 1)) * 100
      : 0;
  const controlsChanged = () => setTablePage(0);
  return (
    <>
      <Link className="back-link dashboard-back" href="/dashboards">
        <Icon name="left" size={13} />
        Market dashboards<span>/</span>
        {dashboard.shortTitle}
      </Link>
      <div className="page-heading analytics-heading">
        <div>
          <div className="title-with-badge">
            <h1>{dashboard.title}</h1>
            <Badge tone="subtle">{planName(dashboard.plan)}</Badge>
          </div>
          <p>{dashboard.description}</p>
        </div>
        <div className="heading-controls">
          <button
            className="button"
            disabled={!allowed || loading || exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadFile(
                  csvUrl,
                  `temo-${dashboard.id}-${country}.csv`,
                );
                toast("Your market data CSV is ready.");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Icon name="download" size={15} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button
            className="icon-button outlined"
            title="View analytics fullscreen"
            aria-label="View analytics fullscreen"
            disabled={!allowed}
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await viewerRef.current?.requestFullscreen();
              } catch {
                toast("Fullscreen is unavailable in this browser.");
              }
            }}
          >
            <Icon name="fullscreen" size={17} />
          </button>
        </div>
      </div>
      {!allowed ? (
        <AccessGate
          plan={dashboard.plan as "professional" | "premium"}
          title={dashboard.shortTitle}
        />
      ) : (
        <>
          <div className="analytics-controls">
            <label>
              Market
              <select
                value={country}
                disabled={dashboard.id === "country"}
                onChange={(e) => {
                  setCountry(e.target.value);
                  if (compare === e.target.value) setCompare("");
                  controlsChanged();
                }}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date range
              <select
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  if (Number(e.target.value) >= 90) setResolution("daily");
                  else if (
                    (resolution === "monthly" && Number(e.target.value) < 30) ||
                    (resolution === "quarter-hourly" &&
                      Number(e.target.value) > 7)
                  )
                    setResolution("hourly");
                  controlsChanged();
                }}
              >
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="730">Last 2 years</option>
              </select>
            </label>
            <label>
              Ending on
              <input
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    controlsChanged();
                  }
                }}
              />
            </label>
            <label>
              Resolution
              <select
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  controlsChanged();
                }}
              >
                {Number(days) <= 7 && (
                  <option value="quarter-hourly">15 minutes</option>
                )}
                {Number(days) <= 30 && <option value="hourly">Hourly</option>}
                <option value="daily">Daily</option>
                {Number(days) >= 30 && <option value="monthly">Monthly</option>}
              </select>
            </label>
            {config.primary === "price" && (
              <label>
                Compare market
                <select
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                >
                  <option value="">No comparison</option>
                  {countries
                    .filter((c) => c.code !== country)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button
              className="button refresh-button"
              disabled={loading}
              onClick={() => {
                refresh();
                toast("Market data refreshed.");
              }}
            >
              <Icon
                name="refresh"
                size={15}
                className={loading ? "spinning" : ""}
              />
              Refresh
            </button>
          </div>
          <div className="data-context">
            <span>
              <Flag code={country} />
              {countries.find((c) => c.code === country)?.name} bidding zone
              <span>·</span>UTC<span>·</span>Simulated market data
            </span>
            <span>
              <Badge
                tone={liveEnabled && status === "live" ? "green" : "subtle"}
                dot
              >
                {liveEnabled ? "Live simulation" : "Historical"}
              </Badge>
              {data &&
                `Updated ${new Date(liveEnabled && live ? live.timestamp : data.updatedAt).toLocaleTimeString("en-GB", { timeZone: "UTC" })}`}
            </span>
          </div>
          {error ? (
            <EmptyState
              title="Market data is temporarily unavailable"
              description={error}
              action={
                <button className="button primary" onClick={refresh}>
                  Retry loading data
                </button>
              }
            />
          ) : loading ? (
            <div className="analytics-loading">
              <div className="analytics-kpis">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton className="kpi-skeleton" key={i} />
                ))}
              </div>
              <Skeleton className="chart-skeleton" />
            </div>
          ) : (
            <>
              <div className="analytics-kpis">
                {[
                  [primaryLabel, activeCurrent, unit],
                  ["Period average", avg, unit],
                  ["Minimum", min, unit],
                  ["Maximum", max, unit],
                  ["Period change", change, "%"],
                  ["Negative intervals", negatives.length, "intervals"],
                ].map(([label, value, suffix]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <strong className={label === "Period change" ? "mint" : ""}>
                      {suffix === "€/MWh" ? "€" : ""}
                      {formatNumber(
                        Number(value),
                        suffix === "MW" || suffix === "intervals" ? 0 : 2,
                      )}
                      <small>{suffix === "€/MWh" ? "/ MWh" : suffix}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="overview-tabs analytics-tabs">
                <div role="tablist" aria-label="Dashboard view">
                  {["analytics", "data"].map((s) => (
                    <button
                      role="tab"
                      aria-selected={s === section}
                      key={s}
                      className={s === section ? "active" : ""}
                      onClick={() => setSection(s)}
                    >
                      {s === "analytics"
                        ? "Analytics overview"
                        : "Underlying data"}
                      {s === "data" && (
                        <span className="tab-count">{rows.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <span>
                  <Icon name="database" size={13} />
                  {rows.length.toLocaleString()} intervals
                </span>
              </div>
              <div ref={viewerRef} className="fullscreen-viewer">
                <DashboardViewer
                  type={dashboard.viewerType}
                  source={dashboard.source}
                >
                  {section === "analytics" && (
                    <>
                      <Panel
                        title={config.title}
                        subtitle={`${countries.find((c) => c.code === country)?.name} · ${resolution.replace("-", " ")} resolution`}
                        action={<Badge tone="subtle">{unit}</Badge>}
                      >
                        <div className="detail-chart">
                          <MarketChart
                            data={chartData}
                            series={series}
                            kind={config.kind}
                            unit={unit}
                            height={350}
                          />
                        </div>
                        <div className="chart-bottom">
                          <ChartLegend series={series} />
                          <span className="muted small">{date} · UTC</span>
                        </div>
                      </Panel>
                      <div className="analytics-secondary">
                        <Panel
                          title={
                            dashboard.id === "cross-border"
                              ? "Regional interconnections"
                              : dashboard.id === "energy-mix" ||
                                  dashboard.id === "renewables"
                                ? "Technology share"
                                : "Price distribution"
                          }
                          subtitle={
                            dashboard.id === "cross-border"
                              ? "Scheduled power exchange · MW"
                              : dashboard.id === "energy-mix" ||
                                  dashboard.id === "renewables"
                                ? "Latest selected interval"
                                : "Number of intervals by price band"
                          }
                        >
                          {dashboard.id === "cross-border" ? (
                            <FlowNetwork
                              flow={country === "BG" ? latest?.netFlow : 684}
                            />
                          ) : dashboard.id === "energy-mix" ||
                            dashboard.id === "renewables" ? (
                            <MixChart
                              generation={(latest?.generation || 5840) / 1000}
                              mix={generationMix.map((m) => ({
                                ...m,
                                value: latest
                                  ? (Number(latest[m.name.toLowerCase()]) /
                                      latest.generation) *
                                    100
                                  : m.value,
                              }))}
                            />
                          ) : (
                            <PriceDistribution rows={rows} />
                          )}
                        </Panel>
                        <Panel
                          title="Period intelligence"
                          subtitle="Key observations from the selected dataset"
                        >
                          <div className="insight-list">
                            <div>
                              <span className="event-icon success">
                                <Icon name="down" />
                              </span>
                              <div>
                                <span>
                                  Lowest{" "}
                                  {config.primary === "generation"
                                    ? "generation"
                                    : "value"}
                                </span>
                                <strong>
                                  {formatNumber(min)} {unit}
                                </strong>
                                <small>
                                  {minRow
                                    ? new Date(minRow.timestamp).toLocaleString(
                                        "en-GB",
                                        { timeZone: "UTC" },
                                      )
                                    : "No interval"}
                                </small>
                              </div>
                            </div>
                            <div>
                              <span className="event-icon warning">
                                <Icon name="up" />
                              </span>
                              <div>
                                <span>
                                  Highest{" "}
                                  {config.primary === "generation"
                                    ? "generation"
                                    : "value"}
                                </span>
                                <strong>
                                  {formatNumber(max)} {unit}
                                </strong>
                                <small>
                                  {maxRow
                                    ? new Date(maxRow.timestamp).toLocaleString(
                                        "en-GB",
                                        { timeZone: "UTC" },
                                      )
                                    : "No interval"}
                                </small>
                              </div>
                            </div>
                            <div>
                              <span className="event-icon info">
                                <Icon name="activity" />
                              </span>
                              <div>
                                <span>
                                  {dashboard.id === "negative-prices"
                                    ? "Negative-price duration"
                                    : "Period spread"}
                                </span>
                                <strong>
                                  {dashboard.id === "negative-prices"
                                    ? `${formatNumber(negativeHours, 1)} hours`
                                    : `${formatNumber(max - min)} ${unit}`}
                                </strong>
                                <small>
                                  {dashboard.id === "negative-prices"
                                    ? `${negatives.length} of ${rows.length} intervals below zero`
                                    : "Difference between the high and low"}
                                </small>
                              </div>
                            </div>
                          </div>
                        </Panel>
                        <Panel
                          title="Market statistics"
                          subtitle="Selected period · simulated values"
                        >
                          <dl className="statistics-list">
                            <div>
                              <dt>Average generation</dt>
                              <dd>
                                {formatNumber(
                                  rows.reduce((s, r) => s + r.generation, 0) /
                                    rows.length,
                                  0,
                                )}{" "}
                                MW
                              </dd>
                            </div>
                            <div>
                              <dt>Renewable share</dt>
                              <dd>
                                {formatNumber(
                                  rows.reduce((s, r) => s + r.renewable, 0) /
                                    rows.length,
                                  1,
                                )}
                                %
                              </dd>
                            </div>
                            <div>
                              <dt>Average imports</dt>
                              <dd>
                                {formatNumber(
                                  rows.reduce((s, r) => s + r.import, 0) /
                                    rows.length,
                                  0,
                                )}{" "}
                                MW
                              </dd>
                            </div>
                            <div>
                              <dt>Average exports</dt>
                              <dd>
                                {formatNumber(
                                  rows.reduce((s, r) => s + r.export, 0) /
                                    rows.length,
                                  0,
                                )}{" "}
                                MW
                              </dd>
                            </div>
                            <div>
                              <dt>Negative-price intervals</dt>
                              <dd>{negatives.length}</dd>
                            </div>
                            <div>
                              <dt>Data completeness</dt>
                              <dd className="mint">
                                100% <Icon name="check" size={13} />
                              </dd>
                            </div>
                          </dl>
                        </Panel>
                      </div>
                    </>
                  )}
                  <Panel
                    title={
                      section === "data"
                        ? "Underlying market data"
                        : "Interval data"
                    }
                    subtitle={`${resolution.replace("-", " ")} observations · ${rows.length} records`}
                    action={
                      <button
                        className="text-button"
                        onClick={() =>
                          setSection(section === "data" ? "analytics" : "data")
                        }
                      >
                        {section === "data"
                          ? "Back to analytics"
                          : "View all data"}
                        <Icon name="right" size={14} />
                      </button>
                    }
                  >
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Timestamp (UTC)</th>
                            <th>Market</th>
                            {config.columns.map(([key, label, suffix]) => (
                              <th key={key}>
                                {label}
                                <small>{suffix}</small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows
                            .slice(tablePage * 12, tablePage * 12 + 12)
                            .map((r) => (
                              <tr key={r.timestamp}>
                                <td>
                                  {new Date(r.timestamp).toLocaleString(
                                    "en-GB",
                                    {
                                      timeZone: "UTC",
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </td>
                                <td>
                                  <span className="inline-market">
                                    <Flag code={country} />
                                    {country}
                                  </span>
                                </td>
                                {config.columns.map(([key, , suffix]) => (
                                  <td
                                    key={key}
                                    className={key === "price" ? "mint" : ""}
                                  >
                                    {formatNumber(
                                      Number(r[key]),
                                      suffix === "MW" || suffix === "MWh"
                                        ? 0
                                        : 2,
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={tablePage}
                      setPage={setTablePage}
                      total={rows.length}
                      pageSize={12}
                    />
                  </Panel>
                </DashboardViewer>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
export function Pagination({
  page,
  setPage,
  total,
  pageSize,
}: {
  page: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)}`
          : "0"}{" "}
        of {total.toLocaleString()} records
      </span>
      <div>
        <button
          className="icon-button outlined"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <Icon name="left" size={14} />
        </button>
        <span>
          Page <strong>{page + 1}</strong> of {pages}
        </span>
        <button
          className="icon-button outlined"
          aria-label="Next page"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          <Icon name="next" size={14} />
        </button>
      </div>
    </div>
  );
}
