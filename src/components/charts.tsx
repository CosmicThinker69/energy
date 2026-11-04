"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  countries,
  formatNumber,
  generationMix,
  type MarketRow,
} from "@/lib/market";
import { useId } from "react";
export type ChartSeries = { key: string; label: string; color: string };
const axis = {
  fontSize: "var(--font-caption)",
  fill: "var(--muted)",
  fontFamily: "inherit",
};
const tooltipStyle = {
  background: "var(--raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: "var(--font-ui)",
};
export function MarketChart({
  data,
  series,
  kind = "line",
  height = 260,
  unit = "€/MWh",
}: {
  data: Record<string, unknown>[];
  series: ChartSeries[];
  kind?: "line" | "area" | "bar";
  height?: number;
  unit?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className="market-chart"
      style={{ height }}
      role="img"
      aria-label={`${series.map((s) => s.label).join(", ")} chart in ${unit}; ${data.length} intervals. Values are available in the data table.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 18, right: 20, bottom: 12, left: -8 }}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient
                key={s.key}
                id={`${id}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="1" stopColor={s.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            tick={axis}
            tickLine={false}
            axisLine={false}
            minTickGap={45}
            dy={9}
          />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            tickFormatter={(v) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
            domain={kind === "area" ? [0, "auto"] : ["auto", "auto"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ padding: "4px 0", fontSize: "var(--font-ui)" }}
            labelStyle={{ color: "var(--muted)", marginBottom: 6 }}
            formatter={(v, name) => [
              `${formatNumber(Number(v), unit === "MW" || unit === "MWh" ? 0 : 2)} ${unit}`,
              name,
            ]}
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "4 4" }}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          {series.map((s, i) =>
            kind === "bar" ? (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            ) : kind === "area" ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                fill={`url(#${id}-${i})`}
                stackId="generation"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            ) : i === 0 ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                fill={`url(#${id}-${i})`}
                strokeWidth={2.3}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.6}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Sparkline({
  values,
  color = "var(--mint)",
}: {
  values: (number | null)[];
  color?: string;
}) {
  const reported = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!reported.length) return null;
  const min = Math.min(...reported),
    max = Math.max(...reported);
  const segments: string[][] = [[]];
  values.forEach((value, i) => {
    if (value === null || !Number.isFinite(value)) {
      if (segments.at(-1)!.length) segments.push([]);
      return;
    }
    segments
      .at(-1)!
      .push(
        `${(i / Math.max(1, values.length - 1)) * 105},${34 - ((value - min) / (max - min || 1)) * 28}`,
      );
  });
  return (
    <svg className="sparkline" viewBox="0 0 108 40" aria-hidden="true">
      {segments
        .filter((segment) => segment.length)
        .map((segment, i) => (
          <polyline
            key={i}
            points={segment.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}
export function MixChart({
  generation,
  mix,
}: {
  generation: number;
  mix: { name: string; color: string; value: number | null }[];
}) {
  const reported = mix.filter(
    (item): item is typeof item & { value: number } =>
      item.value !== null && Number.isFinite(item.value),
  );
  if (!Number.isFinite(generation) || !reported.length)
    return <p>No complete generation total is available for this interval.</p>;
  return (
    <div className="mix-chart-wrap">
      <div
        className="donut-container"
        role="img"
        aria-label={`Reported generation mix: ${reported.map((m) => `${m.name} ${m.value.toFixed(1)}%`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={reported}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={87}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {reported.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => `${Number(v).toFixed(1)}%`}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>Reported generation</span>
          <strong>
            {generation.toFixed(2)}
            <small> GW</small>
          </strong>
          <span className="mint">{reported.length} reported groups</span>
        </div>
      </div>
      <div className="mix-legend">
        {mix.map((item) => (
          <div key={item.name}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>
              {formatNumber(item.value, 1)}
              <small>%</small>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ChartLegend({
  series,
  onToggle,
  hidden = [],
}: {
  series: ChartSeries[];
  onToggle?: (key: string) => void;
  hidden?: string[];
}) {
  return (
    <div className="chart-legend">
      {series.map((s) =>
        onToggle ? (
          <button
            key={s.key}
            className={hidden.includes(s.key) ? "legend-inactive" : ""}
            onClick={() => onToggle(s.key)}
            aria-pressed={!hidden.includes(s.key)}
          >
            <span className="legend-line" style={{ background: s.color }} />
            {s.label}
          </button>
        ) : (
          <span key={s.key}>
            <span className="legend-line" style={{ background: s.color }} />
            {s.label}
          </span>
        ),
      )}
    </div>
  );
}
export function PriceDistribution({ rows }: { rows: MarketRow[] }) {
  const prices = rows
    .map((row) => row.price)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  if (!prices.length) return <p>No reported prices in this window.</p>;
  const min = Math.floor(Math.min(...prices) / 10) * 10;
  const max = Math.ceil(Math.max(...prices) / 10) * 10;
  const step = Math.max(10, Math.ceil((max - min) / 8 / 10) * 10);
  const data = Array.from(
    { length: Math.max(1, Math.ceil((max - min + 1) / step)) },
    (_, i) => ({
      label: `${min + i * step}`,
      count: prices.filter(
        (price) => price >= min + i * step && price < min + (i + 1) * step,
      ).length,
    }),
  );
  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -30, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            tick={axis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={axis}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [v, "Intervals"]}
            labelFormatter={(v) => `€${v}–${Number(v) + step}/MWh`}
          />
          <Bar
            dataKey="count"
            fill="var(--mint)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function FlowNetwork({ flow }: { flow?: number | null }) {
  if (flow == null || !Number.isFinite(flow))
    return <p>No reported flow for this interval.</p>;
  return (
    <p>
      Net exports: {formatNumber(flow, 0)} MW. Border details are available in
      the data catalogue.
    </p>
  );
}
export const countrySeries = countries
  .slice(0, 5)
  .map((c) => ({ key: c.code, label: c.name, color: c.color }));
