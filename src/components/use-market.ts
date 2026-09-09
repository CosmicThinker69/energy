"use client";
import { useCallback, useEffect, useState } from "react";
import type { MarketRow } from "@/lib/market";
export type MarketData = {
  rows: MarketRow[];
  comparisons: Record<string, MarketRow[]>;
  updatedAt: string;
  source: string;
};
export function useMarket(params: Record<string, string>, enabled = true) {
  const query = new URLSearchParams(params).toString();
  const [data, setData] = useState<MarketData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/market?" + query, { signal: abort.signal })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message || "Unable to load market data.");
          setData(null);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [query, enabled, revision]);
  return {
    data,
    loading,
    error,
    refresh: useCallback(() => setRevision((v) => v + 1), []),
    csvUrl: "/api/market?" + query + "&format=csv",
  };
}
export async function downloadFile(url: string, filename: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const data = await r.json();
    throw new Error(data.error || "The export could not be created.");
  }
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
