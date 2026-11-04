"use client";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/market";
import { Panel } from "./ui";

type Point = {
  interval_start: string;
  interval_end: string;
  metric: string;
  value: number | null;
  unit: string;
  quality: string;
  forecast_run: string;
  dimensions: Record<string, unknown>;
};
export function SourceData({
  source,
  dataset,
  area,
}: {
  source: string;
  dataset: string;
  area: string;
}) {
  const [start, setStart] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Point[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const params = new URLSearchParams({
    source,
    dataset,
    area,
    start,
    end,
    limit: "100",
    offset: String(offset),
  }).toString();
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/data?" + params, { signal: abort.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setRows(data.data);
        setNext(data.nextOffset);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setRows([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [params]);
  return (
    <Panel
      title={`${area} · ${dataset.replaceAll("_", " ")}`}
      subtitle={`${source} · native provider intervals · UTC`}
    >
      <div className="analytics-controls">
        <label>
          Start date
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          End date (exclusive)
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <a href={"/api/data?" + params + "&format=csv"} className="button">
          Export this page
        </a>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p role="status">Loading observations…</p>
      ) : (
        <div className="table-scroll">
          <table className="regional-table">
            <thead>
              <tr>
                <th>Interval start</th>
                <th>Interval end</th>
                <th>Metric</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Quality</th>
                <th>Forecast run</th>
                <th>Location / direction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.interval_start.replace("T", " ")}</td>
                  <td>{r.interval_end.replace("T", " ")}</td>
                  <td>{r.metric.replaceAll("_", " ")}</td>
                  <td>{formatNumber(r.value, 3)}</td>
                  <td>{r.unit}</td>
                  <td>{r.quality}</td>
                  <td>{r.forecast_run || "Observation"}</td>
                  <td>
                    {String(
                      r.dimensions.reference_point ||
                        r.dimensions.neighbor ||
                        r.dimensions.direction ||
                        r.dimensions.measurement ||
                        "—",
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8}>No observations in this date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">
        <button
          className="button"
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          Previous page
        </button>
        <span>Page {Math.floor(offset / 100) + 1}</span>
        <button
          className="button"
          disabled={next === null || loading}
          onClick={() => {
            if (next !== null) setOffset(next);
          }}
        >
          Next page
        </button>
      </div>
    </Panel>
  );
}
