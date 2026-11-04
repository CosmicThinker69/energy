import "server-only";
import { query } from "./db";

export async function energyQuality() {
  const [gaps, disagreements, freshness] = await Promise.all([
    query(`WITH ordered AS (
      SELECT source,dataset,area,metric,interval_start,interval_end,
        lag(interval_end) OVER(PARTITION BY source,dataset,area,metric,dimension_key,forecast_run ORDER BY interval_start) AS previous_end
      FROM energy.observations WHERE forecast_run=''
    ) SELECT source,dataset,area,metric,count(*) AS gaps,
       sum(EXTRACT(epoch FROM interval_start-previous_end)) AS missing_seconds,
       max(interval_start) AS latest_gap_end
      FROM ordered WHERE interval_start>previous_end GROUP BY 1,2,3,4
      ORDER BY missing_seconds DESC LIMIT 100`),
    query(`WITH hours AS (
      SELECT source,area,date_trunc('hour',interval_start AT TIME ZONE 'UTC') AS hour,
        sum(value*EXTRACT(epoch FROM interval_end-interval_start))/nullif(sum(EXTRACT(epoch FROM interval_end-interval_start)),0) AS price,
        sum(EXTRACT(epoch FROM interval_end-interval_start)) AS seconds
      FROM energy.observations WHERE dataset='day_ahead_price' AND forecast_run='' AND value IS NOT NULL
        AND source IN ('entsoe','energy-charts') AND interval_start>=now()-interval '30 days'
      GROUP BY 1,2,3
    ) SELECT a.area,a.hour,a.price AS entsoe_price,b.price AS energy_charts_price,
       abs(a.price-b.price) AS difference_eur_mwh
      FROM hours a JOIN hours b ON a.area=b.area AND a.hour=b.hour
      WHERE a.source='entsoe' AND b.source='energy-charts' AND a.seconds=3600 AND b.seconds=3600
        AND abs(a.price-b.price)>0.05 ORDER BY a.hour DESC LIMIT 100`),
    query(`SELECT source,dataset,area,max(interval_end) AS latest_interval_end,max(last_seen_at) AS last_collected_at,
      CASE WHEN dataset IN ('gas_storage','lng') THEN interval '4 days'
           WHEN dataset='weather' THEN interval '7 days' ELSE interval '2 days' END AS allowed_delay,
      max(interval_end)<now()-CASE WHEN dataset IN ('gas_storage','lng') THEN interval '4 days'
           WHEN dataset='weather' THEN interval '7 days' ELSE interval '2 days' END AS stale
      FROM energy.observations WHERE forecast_run='' GROUP BY source,dataset,area ORDER BY 1,2,3`),
  ]);
  return {
    gaps: gaps.rows,
    priceDisagreements: disagreements.rows,
    freshness: freshness.rows,
    comparisonNote:
      "Energy-Charts and ENTSO-E may share upstream data. Agreement is a processing cross-check, not independent corroboration.",
    gapsNote:
      "Internal gaps only. Consult collection windows and requested dates for missing leading or trailing history.",
  };
}
