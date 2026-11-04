-- Dashboard windows must find overlapping native intervals without scanning history.
CREATE INDEX IF NOT EXISTS energy_observations_market_intervals
ON energy.observations USING gist (tstzrange(interval_start,interval_end,'[)'))
WHERE forecast_run='' AND source IN ('entsoe','energy-charts')
  AND dataset IN ('day_ahead_price','generation','load','scheduled_flow');
