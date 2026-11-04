CREATE SCHEMA IF NOT EXISTS energy;

CREATE TABLE energy.sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  documentation_url text NOT NULL,
  attribution text NOT NULL,
  licence text NOT NULL,
  upstream text NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO energy.sources VALUES
 ('entsoe','ENTSO-E Transparency Platform','https://transparencyplatform.zendesk.com/hc/en-us/articles/15692855254548-Synchronous-RESTful-API','ENTSO-E Transparency Platform and original data providers','ENTSO-E reuse terms; dataset-specific original-owner rights apply','European TSOs and exchanges',true),
 ('energy-charts','Energy-Charts / Fraunhofer ISE','https://api.energy-charts.info/','Energy-Charts.info, Fraunhofer ISE; prices: Bundesnetzagentur | SMARD.de','CC BY 4.0 except restricted price zones (excluded)','ENTSO-E / European TSOs / SMARD; not an independent measurement',true),
 ('gie-agsi','GIE AGSI','https://www.gie.eu/transparency-platform/GIE_API_documentation_v005.pdf','Gas Infrastructure Europe, AGSI','GIE transparency platform terms','European storage system operators',true),
 ('gie-alsi','GIE ALSI','https://www.gie.eu/transparency-platform/GIE_API_documentation_v005.pdf','Gas Infrastructure Europe, ALSI','GIE transparency platform terms','European LNG system operators',true),
 ('copernicus-era5','Copernicus ERA5','https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels','Generated using Copernicus Climate Change Service information; ECMWF','Dataset licence accepted through CDS account; retain attribution','ECMWF reanalysis; latest ERA5T is provisional',true),
 ('ecmwf','ECMWF Open Data','https://www.ecmwf.int/en/forecasts/datasets/open-data','ECMWF Open Data','CC BY 4.0 and ECMWF Terms of Use','ECMWF IFS forecasts',true);

CREATE TABLE energy.raw_responses (
  id bigserial PRIMARY KEY,
  source text NOT NULL REFERENCES energy.sources(id),
  request jsonb NOT NULL,
  sha256 text NOT NULL,
  content_type text NOT NULL,
  payload_gzip bytea NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source,sha256)
);

CREATE TABLE energy.observations (
  source text NOT NULL REFERENCES energy.sources(id),
  dataset text NOT NULL,
  area text NOT NULL,
  metric text NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}',
  dimension_key text NOT NULL,
  interval_start timestamptz NOT NULL,
  interval_end timestamptz NOT NULL,
  forecast_run text NOT NULL DEFAULT '',
  value double precision,
  unit text NOT NULL,
  quality text NOT NULL DEFAULT 'reported',
  provider_published_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw_id bigint NOT NULL REFERENCES energy.raw_responses(id),
  PRIMARY KEY(source,dataset,area,metric,dimension_key,interval_start,forecast_run),
  CHECK(interval_end > interval_start),
  CHECK(value IS NULL OR (value > '-Infinity'::float8 AND value < 'Infinity'::float8)),
  CHECK(quality IN ('reported','missing','provisional','forecast'))
);
CREATE INDEX energy_observations_query ON energy.observations(area,dataset,interval_start);
CREATE INDEX energy_observations_metric ON energy.observations(dataset,metric,interval_start);

CREATE TABLE energy.observation_revisions (
  id bigserial PRIMARY KEY,
  superseded_at timestamptz NOT NULL DEFAULT now(),
  previous_record jsonb NOT NULL
);
CREATE FUNCTION energy.archive_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.value,OLD.interval_end,OLD.unit,OLD.quality,OLD.provider_published_at)
     IS DISTINCT FROM (NEW.value,NEW.interval_end,NEW.unit,NEW.quality,NEW.provider_published_at) THEN
   INSERT INTO energy.observation_revisions(previous_record) VALUES(to_jsonb(OLD));
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER energy_observation_revision BEFORE UPDATE ON energy.observations
 FOR EACH ROW EXECUTE FUNCTION energy.archive_revision();

CREATE TABLE energy.collection_chunks (
  source text NOT NULL,
  dataset text NOT NULL,
  area text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('success','empty','failed')),
  row_count integer NOT NULL,
  message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source,dataset,area,window_start,window_end)
);

CREATE VIEW energy.coverage AS
 SELECT source,dataset,area,metric,unit,count(*) AS observations,
        min(interval_start) AS available_from,max(interval_end) AS available_until,
        max(last_seen_at) AS last_collected_at,
        count(*) FILTER(WHERE value IS NULL) AS missing_values
 FROM energy.observations GROUP BY source,dataset,area,metric,unit;
