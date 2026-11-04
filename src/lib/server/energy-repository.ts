import "server-only";
import { query } from "./db";
import type { MarketQuery, MarketRow } from "../market";

export const ENERGY_SOURCES = [
  "entsoe",
  "energy-charts",
  "gie-agsi",
  "gie-alsi",
  "copernicus-era5",
  "ecmwf",
];

export async function dataCoverage() {
  const [coverage, sources, failures] = await Promise.all([
    query("SELECT * FROM energy.coverage ORDER BY source,dataset,area,metric"),
    query("SELECT * FROM energy.sources ORDER BY id"),
    query(`SELECT source,dataset,area,window_start,window_end,status,row_count,message,attempted_at
      FROM energy.collection_chunks WHERE status <> 'success' ORDER BY attempted_at DESC LIMIT 100`),
  ]);
  return {
    coverage: coverage.rows,
    sources: sources.rows,
    collectionIssues: failures.rows,
  };
}

export type ObservationQuery = {
  source: string;
  dataset: string;
  area: string;
  start: string;
  end: string;
  metric?: string | null;
  forecastRun?: string | null;
  limit: number;
  offset: number;
};
export async function observationPage(args: ObservationQuery) {
  const rows = await query(
    `SELECT o.source,o.dataset,o.area,o.metric,o.dimensions,o.interval_start,o.interval_end,
    o.value,o.unit,o.quality,o.forecast_run,o.provider_published_at,o.first_seen_at,o.last_seen_at,
    s.attribution,s.licence,s.upstream
    FROM energy.observations o JOIN energy.sources s ON s.id=o.source
    WHERE o.source=$1 AND o.dataset=$2 AND o.area=$3 AND o.interval_start>=$4 AND o.interval_start<$5
      AND ($6::text IS NULL OR o.metric=$6) AND ($7::text IS NULL OR o.forecast_run=$7)
    ORDER BY o.interval_start,o.metric,o.dimension_key,o.forecast_run LIMIT $8 OFFSET $9`,
    [
      args.source,
      args.dataset,
      args.area,
      new Date(args.start),
      new Date(args.end),
      args.metric || null,
      args.forecastRun || null,
      args.limit + 1,
      args.offset,
    ],
  );
  return {
    data: rows.rows.slice(0, args.limit),
    nextOffset: rows.rows.length > args.limit ? args.offset + args.limit : null,
    timezone: "UTC",
    endExclusive: true,
  };
}
export async function collectionStatus() {
  const result = await query<{ updated_at: Date | null }>(
    "SELECT max(attempted_at) AS updated_at FROM energy.collection_chunks",
  );
  return {
    updatedAt: result.rows[0]?.updated_at?.toISOString() || null,
    source: "Stored provider data",
  };
}

// Stored intervals are never overwritten with live simulations. Bucket values are
// weighted by their actual overlap in seconds, and partial series remain missing.
export async function storedMarketRows({
  country = "BG",
  days = 1,
  resolution = "hourly",
  date,
}: MarketQuery) {
  const last = new Date(
    `${date || new Date().toISOString().slice(0, 10)}T00:00:00Z`,
  );
  const end = new Date(last.getTime() + 86400000);
  const start = new Date(end.getTime() - days * 86400000);
  const step =
    resolution === "monthly"
      ? "1 month"
      : resolution === "daily"
        ? "1 day"
        : resolution === "quarter-hourly"
          ? "15 minutes"
          : "1 hour";
  const trunc = resolution === "monthly" ? "month" : "day";
  const result = await query<{
    bucket: Date;
    dataset: string;
    metric: string;
    source: string;
    dimensions: Record<string, string>;
    value: number | null;
    updated_at: Date;
    negative_hours: number;
    negative_intervals: number;
    bucket_hours: number;
  }>(
    `
    WITH observed AS MATERIALIZED (
      SELECT o.* FROM energy.observations o
      WHERE area=$1 AND interval_start < $3 AND interval_end > $2 AND forecast_run=''
        AND tstzrange(interval_start,interval_end,'[)') && tstzrange($2,$3,'[)')
        AND dataset IN ('day_ahead_price','generation','load','scheduled_flow')
        AND source IN ('entsoe','energy-charts')
    ), entsoe_datasets AS MATERIALIZED (
      SELECT DISTINCT dataset FROM observed WHERE source='entsoe'
    ), selected AS MATERIALIZED (
      SELECT o.* FROM observed o
      WHERE (dataset<>'generation' OR source='energy-charts' OR dimensions->>'measurement'='generation')
        AND (source<>'energy-charts' OR dataset='scheduled_flow' OR NOT EXISTS (
          SELECT 1 FROM entsoe_datasets p WHERE p.dataset=o.dataset))
    )
    SELECT b.start AS bucket,o.dataset,o.metric,o.source,o.dimensions,EXTRACT(epoch FROM b.stop-b.start)/3600 AS bucket_hours,
      CASE WHEN sum(EXTRACT(epoch FROM least(o.interval_end,b.stop)-greatest(o.interval_start,b.start)))
          FILTER(WHERE o.value IS NOT NULL) BETWEEN EXTRACT(epoch FROM b.stop-b.start)-0.001 AND EXTRACT(epoch FROM b.stop-b.start)+0.001
        THEN sum(o.value * EXTRACT(epoch FROM least(o.interval_end,b.stop)-greatest(o.interval_start,b.start)))
          /nullif(sum(EXTRACT(epoch FROM least(o.interval_end,b.stop)-greatest(o.interval_start,b.start))) FILTER(WHERE o.value IS NOT NULL),0)
        ELSE NULL END AS value,max(o.last_seen_at) AS updated_at,
        coalesce(sum(EXTRACT(epoch FROM least(o.interval_end,b.stop)-greatest(o.interval_start,b.start))) FILTER(WHERE o.value<0),0)/3600 AS negative_hours,
        count(*) FILTER(WHERE o.value<0 AND o.interval_start>=b.start AND o.interval_start<b.stop) AS negative_intervals
    FROM selected o
    CROSS JOIN LATERAL generate_series(
      CASE WHEN $5='month'
        THEN date_trunc('month',greatest(o.interval_start,$2::timestamptz) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        ELSE date_bin($4::interval,greatest(o.interval_start,$2::timestamptz),'1970-01-01 00:00:00+00'::timestamptz)
      END,
      least(o.interval_end,$3::timestamptz)-interval '1 microsecond',$4::interval
    ) t
    CROSS JOIN LATERAL (
      SELECT greatest(t,$2::timestamptz) AS start,least(t+$4::interval,$3::timestamptz) AS stop
    ) b
    GROUP BY b.start,b.stop,o.dataset,o.metric,o.source,o.dimensions ORDER BY b.start,o.dataset,o.metric
  `,
    [country, start, end, step, trunc],
  );
  const byTime = new Map<string, Record<string, unknown>>();
  const sources = new Set<string>();
  let updatedAt: Date | null = null;
  const categories: Record<string, string> = {
    solar: "solar",
    wind_onshore: "wind",
    wind_offshore: "wind",
    nuclear: "nuclear",
    biomass: "biomass",
    hydro_run_of_river_and_poundage: "hydro",
    hydro_run_of_river: "hydro",
    hydro_water_reservoir: "hydro",
    hydro_pumped_storage: "storage",
    energy_storage: "storage",
    battery: "storage",
    fossil_brown_coal_lignite: "coal",
    fossil_hard_coal: "coal",
    fossil_gas: "gas",
  };
  const excluded = new Set([
    "load",
    "residual_load",
    "renewable_share_of_load",
    "renewable_share_of_generation",
    "cross_border_electricity_trading",
  ]);
  const seriesCoverage = new Map<
    string,
    { key: string; flow: boolean; times: Set<string> }
  >();
  for (const point of result.rows) {
    const time = point.bucket.toISOString();
    const row = byTime.get(time) || {
      timestamp: time,
      label:
        time.slice(0, 10) +
        (resolution === "daily" || resolution === "monthly"
          ? ""
          : ` ${time.slice(11, 16)}`),
      country,
      durationHours: Number(point.bucket_hours),
    };
    byTime.set(time, row);
    sources.add(point.source);
    if (!updatedAt || point.updated_at > updatedAt)
      updatedAt = point.updated_at;
    const v = point.value === null ? null : Number(point.value);
    if (point.dataset === "day_ahead_price") {
      row.price = v;
      row.negativeHours = Number(point.negative_hours);
      row.negativeIntervals = Number(point.negative_intervals);
    }
    if (point.dataset === "load") row.load = v;
    // Settlement categories and directions are kept separately in /api/data.
    // Do not collapse long/short imbalance prices into a fabricated settlement value.
    if (
      point.dataset === "generation" &&
      !excluded.has(point.metric) &&
      !point.metric.includes("consumption")
    ) {
      const key = categories[point.metric] || "other";
      const identity = JSON.stringify([
        point.source,
        point.dataset,
        point.metric,
        point.dimensions,
      ]);
      const observed = seriesCoverage.get(identity) || {
        key,
        flow: false,
        times: new Set<string>(),
      };
      observed.times.add(time);
      seriesCoverage.set(identity, observed);
      const bad = (row._missing as Set<string>) || new Set<string>();
      row._missing = bad;
      if (v === null) bad.add(key);
      else row[key] = Number(row[key] || 0) + v;
    }
    if (
      point.dataset === "scheduled_flow" &&
      point.source === "energy-charts"
    ) {
      const identity = JSON.stringify([
        point.source,
        point.dataset,
        point.metric,
        point.dimensions,
      ]);
      const observed = seriesCoverage.get(identity) || {
        key: "flow",
        flow: true,
        times: new Set<string>(),
      };
      observed.times.add(time);
      seriesCoverage.set(identity, observed);
      const bad = (row._missing as Set<string>) || new Set<string>();
      row._missing = bad;
      if (v === null) {
        bad.add("import");
        bad.add("export");
      } else {
        row.import = Number(row.import || 0) + Math.max(0, v);
        row.export = Number(row.export || 0) + Math.max(0, -v);
      }
    }
  }
  // Entire missing technology/border buckets produce no SQL group. Detect these
  // internal gaps before summing the remaining technologies or neighbours.
  for (const series of seriesCoverage.values()) {
    const times = [...series.times].sort();
    const first = times[0],
      last = times.at(-1)!;
    for (const [time, row] of byTime)
      if (time >= first && time <= last && !series.times.has(time)) {
        const bad = (row._missing as Set<string>) || new Set<string>();
        row._missing = bad;
        if (series.flow) {
          bad.add("import");
          bad.add("export");
        } else bad.add(series.key);
      }
  }
  for (const row of byTime.values()) {
    const bad = row._missing as Set<string> | undefined;
    if (bad) for (const key of bad) row[key] = null;
    delete row._missing;
    const technologies = [
      "solar",
      "wind",
      "hydro",
      "storage",
      "nuclear",
      "coal",
      "gas",
      "biomass",
      "other",
    ];
    const present = technologies.filter((k) => typeof row[k] === "number");
    if (present.length && !technologies.some((k) => row[k] === null))
      row.generation = present.reduce((s, k) => s + Number(row[k]), 0);
    // Renewable share cannot be inferred from incomplete technology reporting, or waste's unknown biogenic fraction.
    if (
      ["solar", "wind", "hydro", "biomass"].every(
        (k) => typeof row[k] === "number",
      ) &&
      typeof row.generation === "number" &&
      row.generation > 0
    ) {
      row.renewableGeneration = ["solar", "wind", "hydro", "biomass"].reduce(
        (s, k) => s + Number(row[k]),
        0,
      );
      row.renewable = (Number(row.renewableGeneration) / row.generation) * 100;
    }
    if (typeof row.import === "number" && typeof row.export === "number")
      row.netFlow = row.export - row.import;
  }
  return {
    // Unknown metrics are omitted; consumers must show gaps, never coerce them to zero.
    rows: [...byTime.values()] as MarketRow[],
    updatedAt: updatedAt?.toISOString() || null,
    source: [...sources].join(", ") || "No stored observations",
    timezone: "UTC",
    mode: "stored",
    missingDataPolicy:
      "Unavailable fields are omitted and reported gaps are preserved.",
  };
}
