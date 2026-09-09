"use client";
import { useMemo, useState } from "react";
import { canAccess } from "@/lib/config";
import { countries, formatNumber, type MarketRow } from "@/lib/market";
import { usePortal } from "./portal-provider";
import { AccessGate, Pagination } from "./analytics";
import { Badge, EmptyState, Flag, Icon, Skeleton } from "./ui";
import { downloadFile, useMarket } from "./use-market";
const columns = [
  { key: "timestamp", label: "Timestamp", unit: "UTC" },
  { key: "country", label: "Market", unit: "Zone" },
  { key: "price", label: "Day-ahead price", unit: "EUR / MWh" },
  { key: "generation", label: "Generation", unit: "MW" },
  { key: "renewable", label: "Renewables", unit: "%" },
  { key: "balancing", label: "Balancing price", unit: "EUR / MWh" },
  { key: "import", label: "Import", unit: "MW" },
  { key: "export", label: "Export", unit: "MW" },
];
export function Explorer() {
  const { user, toast } = usePortal();
  const [country, setCountry] = useState("BG"),
    [metric, setMetric] = useState("all"),
    [days, setDays] = useState("30"),
    [resolution, setResolution] = useState("hourly"),
    [compare, setCompare] = useState<string[]>([]),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState({ key: "timestamp", asc: false }),
    [exporting, setExporting] = useState(false);
  const allowed = canAccess(user.plan, "explorer");
  const { data, loading, error, refresh } = useMarket(
    {
      dashboard: "explorer",
      country,
      days,
      resolution,
      date,
      compare: compare.join(","),
    },
    allowed,
  );
  const visibleColumns = columns.filter(
    (c) => metric === "all" || ["timestamp", "country", metric].includes(c.key),
  );
  const records = useMemo(() => {
    const rows = [
      ...(data?.rows || []),
      ...Object.values(data?.comparisons || {}).flat(),
    ];
    const search = filter.toLowerCase();
    return rows
      .filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(search)),
      )
      .sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y))) * (sort.asc ? 1 : -1)
        );
      });
  }, [data, filter, sort]);
  const update = () => setPage(0);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">FROM SIGNAL TO DETAIL</div>
          <h1>Data Explorer</h1>
          <p>Your markets, your metrics. Explore the underlying energy data.</p>
        </div>
        <button
          className="button primary"
          disabled={!allowed || loading || exporting || !records.length}
          onClick={async () => {
            setExporting(true);
            try {
              const { toCsv } = await import("@/lib/market");
              const csv = toCsv(
                records.map((r) =>
                  Object.fromEntries(
                    visibleColumns.map((c) => [c.key, r[c.key]]),
                  ),
                ),
              );
              const url = URL.createObjectURL(
                new Blob([csv], { type: "text/csv;charset=utf-8" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "temo-explorer-filtered.csv";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              toast(
                `Exported ${records.length.toLocaleString()} filtered records.`,
              );
            } catch {
              toast("The export could not be created. Try again.");
            } finally {
              setExporting(false);
            }
          }}
        >
          <Icon name="download" size={15} />
          {exporting ? "Exporting…" : "Export dataset"}
        </button>
      </div>
      {!allowed ? (
        <AccessGate plan="professional" title="Data Explorer" />
      ) : (
        <>
          <div className="analytics-controls explorer-controls">
            <label>
              Primary market
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCompare((v) => v.filter((c) => c !== e.target.value));
                  update();
                }}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metric
              <select
                value={metric}
                onChange={(e) => {
                  setMetric(e.target.value);
                  update();
                }}
              >
                <option value="all">All metrics</option>
                {columns.slice(2).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
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
                  if (Number(e.target.value) > 30) setResolution("daily");
                  update();
                }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
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
                    update();
                  }
                }}
              />
            </label>
            <label>
              Aggregation
              <select
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  update();
                }}
              >
                {Number(days) <= 30 && <option value="hourly">Hourly</option>}
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <button
              className="button refresh-button"
              onClick={refresh}
              disabled={loading}
            >
              <Icon name="refresh" size={15} />
              Refresh
            </button>
          </div>
          <div className="comparison-select">
            <span>
              <Icon name="plus" size={14} />
              Compare markets
            </span>
            {countries
              .filter((c) => c.code !== country)
              .map((c) => (
                <button
                  key={c.code}
                  className={`market-chip ${compare.includes(c.code) ? "selected" : ""}`}
                  aria-pressed={compare.includes(c.code)}
                  onClick={() => {
                    setCompare((v) =>
                      v.includes(c.code)
                        ? v.filter((x) => x !== c.code)
                        : [...v, c.code],
                    );
                    update();
                  }}
                >
                  <Flag code={c.code} />
                  {c.name}
                  {compare.includes(c.code) && <Icon name="check" size={12} />}
                </button>
              ))}
          </div>
          <div className="explorer-summary">
            <div>
              <Icon name="database" size={18} />
              <strong>{records.length.toLocaleString()}</strong>
              <span>records</span>
            </div>
            <div>
              <Icon name="globe" size={17} />
              <strong>{compare.length + 1}</strong>
              <span>markets</span>
            </div>
            <div>
              <Icon name="activity" size={17} />
              <strong>{metric === "all" ? "6" : "1"}</strong>
              <span>metrics</span>
            </div>
            <Badge dot tone="green">
              Complete dataset
            </Badge>
            <span className="muted small">
              Deterministic simulated history · UTC
            </span>
          </div>
          <section className="panel explorer-table-panel">
            <div className="panel-heading">
              <div>
                <h2>Market observations</h2>
                <p>Click a column heading to sort your dataset.</p>
              </div>
              <div className="search-input">
                <Icon name="search" size={15} />
                <input
                  aria-label="Filter records"
                  placeholder="Filter records…"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    update();
                  }}
                />
                {filter && (
                  <button
                    className="icon-button"
                    aria-label="Clear record filter"
                    onClick={() => {
                      setFilter("");
                      update();
                    }}
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <Skeleton className="chart-skeleton" />
            ) : error ? (
              <EmptyState
                title="The dataset could not be loaded"
                description={error}
                action={
                  <button className="button" onClick={refresh}>
                    Retry
                  </button>
                }
              />
            ) : !records.length ? (
              <EmptyState
                title="No observations match your filter"
                description="Try a country code, a date, or part of a numeric value."
                action={
                  <button
                    className="button"
                    onClick={() => {
                      setFilter("");
                      update();
                    }}
                  >
                    Clear filter
                  </button>
                }
              />
            ) : (
              <>
                <div className="table-scroll">
                  <table className="data-table explorer-table">
                    <thead>
                      <tr>
                        {visibleColumns.map((c) => (
                          <th
                            key={c.key}
                            aria-sort={
                              sort.key === c.key
                                ? sort.asc
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button
                              onClick={() => {
                                setSort((v) => ({
                                  key: c.key,
                                  asc: v.key === c.key ? !v.asc : true,
                                }));
                                update();
                              }}
                            >
                              {c.label}
                              <Icon
                                name={
                                  sort.key === c.key
                                    ? sort.asc
                                      ? "up"
                                      : "down"
                                    : "chevron"
                                }
                                size={12}
                              />
                            </button>
                            <small>{c.unit}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records
                        .slice(page * 20, (page + 1) * 20)
                        .map((r: MarketRow) => (
                          <tr key={r.timestamp + r.country}>
                            {visibleColumns.map((c) => (
                              <td
                                key={c.key}
                                className={c.key === "price" ? "mint" : ""}
                              >
                                {c.key === "timestamp" ? (
                                  new Date(r.timestamp).toLocaleString(
                                    "en-GB",
                                    {
                                      timeZone: "UTC",
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                ) : c.key === "country" ? (
                                  <span className="inline-market">
                                    <Flag code={r.country} />
                                    {r.country}
                                  </span>
                                ) : (
                                  formatNumber(
                                    Number(r[c.key]),
                                    c.unit === "MW"
                                      ? 0
                                      : c.key === "renewable"
                                        ? 1
                                        : 2,
                                  )
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  setPage={setPage}
                  total={records.length}
                  pageSize={20}
                />
              </>
            )}
          </section>
          <p className="data-note">
            <Icon name="help" size={14} />
            CSV exports include all filtered records and the currently selected
            metric columns.
          </p>
        </>
      )}
    </>
  );
}
