"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  countries,
  formatNumber,
  generateMarketRows,
  generationBreakdown,
  generationMix,
  marketEvents,
  type LiveSnapshot,
} from "@/lib/market";
import { Badge, Flag, Icon, Panel } from "./ui";
import {
  ChartLegend,
  countrySeries,
  FlowNetwork,
  MarketChart,
  MixChart,
  Sparkline,
} from "./charts";
import { usePortal } from "./portal-provider";
import { dashboards } from "@/lib/config";
export function Overview() {
  const { user, live, status, feed, toast } = usePortal();
  const [country, setCountry] = useState("BG"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [hidden, setHidden] = useState<string[]>([]),
    [chartRange, setChartRange] = useState("24h"),
    [tab, setTab] = useState("overview");
  const selected = countries.find((c) => c.code === country)!;
  const isToday = date === new Date().toISOString().slice(0, 10);
  const activeLive = isToday ? live : null;
  const rows = useMemo(
    () =>
      generateMarketRows({
        country,
        date,
        days: chartRange === "7d" ? 7 : 1,
        resolution: chartRange === "7d" ? "daily" : "hourly",
      }),
    [country, date, chartRange],
  );
  const chartData = useMemo(() => {
    const sets = countries.slice(0, 5).map((c) =>
      generateMarketRows({
        country: c.code,
        date,
        days: chartRange === "7d" ? 7 : 1,
        resolution: chartRange === "7d" ? "daily" : "hourly",
      }),
    );
    return sets[0].map((row, i) => ({
      label: row.label,
      ...Object.fromEntries(
        sets.map((set, j) => [
          countries[j].code,
          i === sets[0].length - 1 && activeLive && chartRange === "24h"
            ? j === 0
              ? activeLive.price
              : j === 1
                ? activeLive.roPrice
                : set[i].price
            : set[i].price,
        ]),
      ),
    }));
  }, [date, chartRange, activeLive]);
  const price =
    (country === "BG" || country === "RO") && activeLive
      ? country === "BG"
        ? activeLive.price
        : activeLive.roPrice
      : isToday
        ? selected.price
        : rows.reduce((sum, r) => sum + r.price, 0) / rows.length;
  const gen =
    country === "BG" && activeLive
      ? activeLive.generation
      : isToday
        ? selected.generation / 1000
        : rows.reduce((sum, r) => sum + r.generation, 0) / rows.length / 1000;
  const renew =
    country === "BG" && activeLive
      ? activeLive.renewable
      : isToday
        ? selected.renewable
        : rows.reduce((sum, r) => sum + r.renewable, 0) / rows.length;
  const regionalHistory = useMemo(
    () =>
      countries.map((c) => {
        const values = generateMarketRows({ country: c.code, date });
        return values.reduce((sum, r) => sum + r.price, 0) / values.length;
      }),
    [date],
  );
  const regionalAverage = isToday
    ? countries.reduce(
        (sum, c) =>
          sum +
          (activeLive && c.code === "BG"
            ? activeLive.price
            : activeLive && c.code === "RO"
              ? activeLive.roPrice
              : c.price),
        0,
      ) / countries.length
    : regionalHistory.reduce((sum, p) => sum + p, 0) / regionalHistory.length;
  const mix = generationBreakdown(Math.round(gen * 1000), renew, 0.92, country);
  const mixShares = generationMix.map((m) => ({
    ...m,
    value:
      (mix[m.name.toLowerCase() as keyof typeof mix] / Math.round(gen * 1000)) *
      100,
  }));
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">
            <span className="status-dot" />
            THE ENERGY PERSPECTIVE
          </div>
          <h1>
            {greeting}, {user.firstName}
            <span className="greeting-dot">.</span>
          </h1>
          <p>Here is what’s happening across European electricity markets.</p>
        </div>
        <div className="heading-controls">
          <div className="select-with-icon">
            <Icon name="globe" size={15} />
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Overview market"
            >
              {countries.map((c) => (
                <option value={c.code} key={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input
            className="date-input"
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            aria-label="Overview date"
          />
        </div>
      </div>
      <div className="overview-tabs">
        <div role="tablist" aria-label="Overview views">
          <button
            role="tab"
            aria-selected={tab === "overview"}
            className={tab === "overview" ? "active" : ""}
            onClick={() => setTab("overview")}
          >
            Market overview
          </button>
          <button
            role="tab"
            aria-selected={tab === "activity"}
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            Market activity
            <span className="tab-count">{marketEvents.length}</span>
          </button>
        </div>
        <span>
          <Icon name="clock" size={13} />
          {new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          <Badge tone="subtle">Demo data</Badge>
        </span>
      </div>
      {tab === "overview" ? (
        <>
          <div className="kpi-grid">
            <Kpi
              title={`${selected.name} day-ahead`}
              value={price}
              prefix="€"
              unit="/ MWh"
              change={selected.change}
              note="vs. previous day"
              icon="activity"
              values={rows.map((r) => r.price)}
              live={!!activeLive}
            />
            <Kpi
              title="Regional average"
              value={regionalAverage}
              prefix="€"
              unit="/ MWh"
              change={2.1}
              note="across 8 markets"
              icon="globe"
              values={rows.map((r, i) => r.price + Math.sin(i) * 5 + 4)}
            />
            <Kpi
              title="Renewable share"
              value={renew}
              unit="%"
              digits={1}
              change={4.2}
              positive
              note="of total generation"
              icon="leaf"
              values={rows.map((r) => r.renewable)}
              live={!!activeLive}
            />
            <Kpi
              title="Total generation"
              value={gen}
              unit="GW"
              change={1.6}
              positive
              note="vs. previous day"
              icon="zap"
              values={rows.map((r) => r.generation)}
              live={!!activeLive}
            />
          </div>
          <div className="metric-rail">
            <div>
              <span>
                <Icon name="down" size={14} />
                Negative price hours
              </span>
              <strong>
                {rows.filter((r) => r.price < 0).length}
                <small> hrs</small>
                <Badge tone="subtle">Today</Badge>
              </strong>
            </div>
            <div>
              <span>
                <Icon name="arrows" size={14} />
                Balancing price
              </span>
              <strong>
                €{formatNumber(rows[rows.length - 1].balancing)}
                <small> / MWh</small>
              </strong>
            </div>
            <div>
              <span>
                <Icon name="globe" size={14} />
                Net cross-border exports
              </span>
              <strong>
                {activeLive?.flow || 684}
                <small> MW</small>
                <Icon name="up" className="mint" size={15} />
              </strong>
            </div>
            <div>
              <span>
                <Icon name="chart" size={14} />
                Daily market change
              </span>
              <strong className="mint">
                −1.8%<small> vs. yesterday</small>
              </strong>
            </div>
          </div>
          <div className="overview-primary">
            <Panel
              title="Day-ahead electricity prices"
              subtitle="An hourly perspective on connected markets"
              action={
                <div className="segmented">
                  {["24h", "7d"].map((r) => (
                    <button
                      key={r}
                      className={chartRange === r ? "active" : ""}
                      onClick={() => setChartRange(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="chart-unit-row">
                <span>EUR / MWh</span>
                <Badge
                  dot
                  tone={isToday && status === "live" ? "green" : "subtle"}
                >
                  {isToday ? "Live simulation" : "Historical"}
                </Badge>
              </div>
              <MarketChart
                data={chartData}
                series={countrySeries.filter((s) => !hidden.includes(s.key))}
                height={250}
              />
              <div className="chart-bottom">
                <ChartLegend
                  series={countrySeries}
                  hidden={hidden}
                  onToggle={(key) =>
                    setHidden((old) =>
                      old.includes(key)
                        ? old.filter((k) => k !== key)
                        : old.length < 4
                          ? [...old, key]
                          : old,
                    )
                  }
                />
                <Link
                  href="/dashboards/day-ahead"
                  aria-label="Open day-ahead dashboard"
                >
                  <Icon name="external" size={14} />
                </Link>
              </div>
            </Panel>
            <Panel
              title="Generation mix"
              subtitle={`${selected.name} · Actual generation`}
              action={
                <Link
                  href="/dashboards/energy-mix"
                  className="icon-button"
                  aria-label="Open energy mix"
                >
                  <Icon name="external" size={15} />
                </Link>
              }
            >
              <MixChart generation={gen} mix={mixShares} />
              <div className="panel-insight">
                <Icon name="leaf" size={15} />
                <span>
                  <strong>{renew.toFixed(1)}%</strong> of generation from
                  renewable sources
                </span>
              </div>
            </Panel>
          </div>
          <div className="overview-secondary">
            <Panel
              title="Regional market comparison"
              subtitle="Day-ahead prices across European bidding zones"
              action={
                <Link href="/dashboards/regional" className="text-button">
                  View markets
                  <Icon name="right" size={14} />
                </Link>
              }
            >
              <RegionalTable live={activeLive} date={date} />
              <div className="table-foot">
                <span>
                  <span className="status-dot" />8 markets connected
                </span>
                <span>Prices in EUR / MWh</span>
              </div>
            </Panel>
            <Panel
              title="Cross-border flows"
              subtitle="A connected European energy system"
              action={
                <Link
                  href="/dashboards/cross-border"
                  className="icon-button"
                  aria-label="Open cross-border flows"
                >
                  <Icon name="external" size={15} />
                </Link>
              }
            >
              <div className="flow-top">
                <div>
                  <span>BG net export</span>
                  <strong>
                    {activeLive?.flow || 684}
                    <small> MW</small>
                  </strong>
                </div>
                <Badge tone="green">
                  <Icon name="up" size={12} />
                  Net exporter
                </Badge>
              </div>
              <FlowNetwork flow={activeLive?.flow || 684} />
            </Panel>
          </div>
        </>
      ) : null}
      <div className="overview-bottom">
        <Panel
          title="Market signals"
          subtitle="What’s moving the market"
          action={<Badge tone="subtle">3 updates</Badge>}
        >
          {marketEvents.map((e, i) => (
            <Link
              href={
                i === 0
                  ? "/dashboards/day-ahead"
                  : i === 1
                    ? "/dashboards/renewables"
                    : "/dashboards/cross-border"
              }
              className="market-event"
              key={e.title}
            >
              <span className={`event-icon ${e.level}`}>
                <Icon
                  name={i === 0 ? "activity" : i === 1 ? "sun" : "arrows"}
                />
              </span>
              <div>
                <strong>{e.title}</strong>
                <p>{e.detail}</p>
                <small>{e.time}</small>
              </div>
              <Icon name="next" size={14} />
            </Link>
          ))}
        </Panel>
        <Panel
          title="Live data feed"
          subtitle="Updates arrive automatically, every 5 seconds"
          action={
            <Badge dot tone={status === "live" ? "green" : "amber"}>
              {status === "live"
                ? "Connected"
                : status === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </Badge>
          }
        >
          <div className="live-feed">
            {feed.length ? (
              feed.slice(0, 5).map((entry, i) => (
                <div className={i === 0 ? "latest-feed" : ""} key={entry.id}>
                  <time>
                    {new Date(entry.time).toLocaleTimeString("en-GB", {
                      timeZone: "UTC",
                    })}
                  </time>
                  <span className="feed-dot" />
                  <span>{entry.text}</span>
                  {i === 0 && <span className="feed-new">NEW</span>}
                </div>
              ))
            ) : (
              <div className="feed-connecting">
                <span className="status-dot" />
                Establishing the simulated market stream…
              </div>
            )}
          </div>
          <div className="feed-footer">
            <Icon name="activity" size={14} />
            <span>Server-sent events · Simulated market feed</span>
            <button
              className="text-button"
              onClick={() =>
                toast(
                  "The feed reconnects automatically. Updates arrive every five seconds while your session is active.",
                )
              }
              aria-label="About the live feed"
            >
              <Icon name="help" size={14} />
            </button>
          </div>
        </Panel>
      </div>
      <div className="explore-banner">
        <span className="explore-icon">
          <Icon name="chart" size={23} />
        </span>
        <div>
          <strong>There’s more to the market.</strong>
          <p>
            Explore {dashboards.length} purpose-built dashboards for your next
            energy decision.
          </p>
        </div>
        <Link href="/dashboards" className="button">
          Explore dashboards
          <Icon name="right" size={15} />
        </Link>
      </div>
    </>
  );
}
export function Kpi({
  title,
  value,
  prefix = "",
  unit,
  change,
  note,
  icon,
  values,
  positive = false,
  live = false,
  digits = 2,
}: {
  title: string;
  value: number;
  prefix?: string;
  unit: string;
  change: number;
  note: string;
  icon: string;
  values: number[];
  positive?: boolean;
  live?: boolean;
  digits?: number;
}) {
  const good = positive ? change >= 0 : change < 0;
  return (
    <section className="kpi">
      <div className="kpi-title">
        <span>{title}</span>
        <Icon name={icon} size={16} />
      </div>
      <div className="kpi-middle">
        <div className="kpi-value" key={live ? value : "static"}>
          {prefix}
          {formatNumber(value, digits)}
          <small>{unit}</small>
        </div>
        <Sparkline
          values={values}
          color={good ? "var(--mint)" : "var(--cyan)"}
        />
      </div>
      <div className="kpi-bottom">
        <span className={good ? "mint" : "rose"}>
          <Icon name={change < 0 ? "down" : "up"} size={13} />
          {change > 0 ? "+" : ""}
          {change}%
        </span>
        <span>{note}</span>
        {live && (
          <span className="kpi-live" title="Updated by the simulated live feed">
            LIVE
          </span>
        )}
      </div>
    </section>
  );
}
export function RegionalTable({
  live,
  date,
}: {
  live: LiveSnapshot | null;
  date?: string;
}) {
  const historical = date && date !== new Date().toISOString().slice(0, 10);
  const history = useMemo(
    () =>
      Object.fromEntries(
        countries.map((c) => [
          c.code,
          generateMarketRows({ country: c.code, date }),
        ]),
      ),
    [date],
  );
  return (
    <div className="table-scroll">
      <table className="regional-table">
        <thead>
          <tr>
            <th>Market</th>
            <th>Day-ahead price</th>
            <th>24h change</th>
            <th>Price trend</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((c) => (
            <tr key={c.code}>
              <td>
                <Link
                  href={`/dashboards/day-ahead?country=${c.code}${date ? `&date=${date}` : ""}`}
                >
                  <Flag code={c.code} />
                  <strong>{c.name}</strong>
                  <span className="country-code">{c.code}</span>
                </Link>
              </td>
              <td className="tabular">
                €
                {formatNumber(
                  c.code === "BG" && live
                    ? live.price
                    : c.code === "RO" && live
                      ? live.roPrice
                      : historical
                        ? history[c.code].reduce((sum, r) => sum + r.price, 0) /
                          history[c.code].length
                        : c.price,
                )}
              </td>
              <td>
                <span className={c.change < 0 ? "mint" : "rose"}>
                  {c.change > 0 ? "+" : ""}
                  {c.change.toFixed(1)}%
                </span>
              </td>
              <td>
                <Sparkline
                  values={history[c.code]
                    .filter((_, i) => i % 2 === 0)
                    .map((r) => r.price)}
                  color={c.change < 0 ? "var(--mint)" : "var(--rose)"}
                />
              </td>
              <td>
                <span className="market-status">
                  <span className="status-dot" />
                  Open
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
