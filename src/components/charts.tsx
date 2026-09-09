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
  values: number[];
  color?: string;
}) {
  const min = Math.min(...values),
    max = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 105},${34 - ((v - min) / (max - min || 1)) * 28}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 108 40" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function MixChart({
  generation = 5.84,
  mix = generationMix,
}: {
  generation?: number;
  mix?: typeof generationMix;
}) {
  return (
    <div className="mix-chart-wrap">
      <div
        className="donut-container"
        role="img"
        aria-label={`Generation mix: ${mix.map((m) => `${m.name} ${m.value}%`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={mix}
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
              {mix.map((item) => (
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
          <span>Total generation</span>
          <strong>
            {generation.toFixed(2)}
            <small> GW</small>
          </strong>
          <span className="mint">Seven technologies</span>
        </div>
      </div>
      <div className="mix-legend">
        {mix.map((item) => (
          <div key={item.name}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>
              {item.value.toFixed(1)}
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
  const min = Math.floor(Math.min(...rows.map((r) => r.price)) / 10) * 10;
  const max = Math.ceil(Math.max(...rows.map((r) => r.price)) / 10) * 10;
  const step = Math.max(10, Math.ceil((max - min) / 8 / 10) * 10);
  const data = Array.from(
    { length: Math.max(1, Math.ceil((max - min + 1) / step)) },
    (_, i) => ({
      label: `${min + i * step}`,
      count: rows.filter(
        (r) => r.price >= min + i * step && r.price < min + (i + 1) * step,
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
const nodes = [
  { code: "CZ", x: 75, y: 39 },
  { code: "PL", x: 232, y: 30 },
  { code: "SK", x: 161, y: 87 },
  { code: "HU", x: 130, y: 151 },
  { code: "RO", x: 290, y: 146 },
  { code: "RS", x: 127, y: 226 },
  { code: "BG", x: 272, y: 239 },
  { code: "GR", x: 202, y: 309 },
];
const edges = [
  ["CZ", "SK", 240],
  ["PL", "SK", 186],
  ["SK", "HU", 420],
  ["HU", "RO", 376],
  ["HU", "RS", 284],
  ["RO", "BG", 412],
  ["BG", "RS", 318],
  ["BG", "GR", 684],
  ["RS", "GR", 173],
] as const;
export function FlowNetwork({ flow = 684 }: { flow?: number }) {
  return (
    <div className="flow-network">
      <svg
        viewBox="0 0 380 350"
        role="img"
        aria-label="Simulated regional interconnector network. Bulgaria exports electricity toward Greece and Serbia."
      >
        <defs>
          <pattern
            id="network-dots"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".7" fill="var(--border-strong)" />
          </pattern>
          <marker
            id="arrow-mint"
            markerWidth="5"
            markerHeight="5"
            refX="4"
            refY="2.5"
            orient="auto"
          >
            <path d="M0 0L5 2.5L0 5" fill="var(--mint)" />
          </marker>
        </defs>
        <rect x="0" y="0" width="380" height="350" fill="url(#network-dots)" />
        {edges.map(([a, b, mw]) => {
          const from = nodes.find((n) => n.code === a)!,
            to = nodes.find((n) => n.code === b)!,
            active = a === "BG" || b === "BG";
          const dx = to.x - from.x,
            dy = to.y - from.y,
            len = Math.hypot(dx, dy);
          return (
            <g key={a + b}>
              <line
                x1={from.x + (dx / len) * 19}
                y1={from.y + (dy / len) * 19}
                x2={to.x - (dx / len) * 22}
                y2={to.y - (dy / len) * 22}
                stroke={active ? "var(--mint)" : "var(--slate)"}
                strokeWidth={active ? 1.6 : 1}
                strokeDasharray={active ? undefined : "4 4"}
                markerEnd={active ? "url(#arrow-mint)" : undefined}
              />
              <rect
                x={(from.x + to.x) / 2 - 19}
                y={(from.y + to.y) / 2 - 8}
                width="38"
                height="16"
                rx="3"
                fill="var(--panel)"
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 + 3}
                textAnchor="middle"
                fill={active ? "var(--mint)" : "var(--muted)"}
                fontSize="14"
                fontFamily="inherit"
              >
                {a === "BG" && b === "GR" ? flow + 94 : mw}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.code}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.code === "BG" ? 22 : 18}
              fill={n.code === "BG" ? "var(--mint-dim)" : "var(--raised)"}
              stroke={n.code === "BG" ? "var(--mint)" : "var(--border-strong)"}
            />
            <text
              x={n.x}
              y={n.y + 4}
              fill={n.code === "BG" ? "var(--mint)" : "var(--text)"}
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fontFamily="inherit"
            >
              {n.code}
            </text>
          </g>
        ))}
      </svg>
      <div className="network-caption">
        <span>
          <span className="legend-line" style={{ background: "var(--mint)" }} />
          BG interconnections
        </span>
        <span>Scheduled flow · MW</span>
      </div>
    </div>
  );
}
export const countrySeries = countries
  .slice(0, 5)
  .map((c) => ({ key: c.code, label: c.name, color: c.color }));
