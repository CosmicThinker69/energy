import "server-only";
import {
  dataCoverage,
  storedMarketRows,
  observationPage,
  collectionStatus,
  type ObservationQuery,
} from "./energy-repository";
import { energyQuality } from "./energy-quality";
import { requestLocalData } from "./local-data-bridge";
import type { MarketQuery } from "../market";

const remote = () => process.env.DATA_BACKEND === "local-agent";
export async function readMarketRows(args: MarketQuery) {
  return remote()
    ? requestLocalData<Awaited<ReturnType<typeof storedMarketRows>>>(
        "market",
        args,
      )
    : storedMarketRows(args);
}
export async function readCoverage() {
  if (!remote()) return dataCoverage();
  const result =
    await requestLocalData<Awaited<ReturnType<typeof dataCoverage>>>(
      "coverage",
    );
  for (const row of result.coverage)
    for (const key of [
      "available_from",
      "available_until",
      "last_collected_at",
    ])
      if (row[key]) row[key] = new Date(row[key]);
  for (const row of result.collectionIssues)
    for (const key of ["window_start", "window_end", "attempted_at"])
      if (row[key]) row[key] = new Date(row[key]);
  return result;
}
export async function readObservations(args: ObservationQuery) {
  return remote()
    ? requestLocalData<Awaited<ReturnType<typeof observationPage>>>(
        "observations",
        args,
      )
    : observationPage(args);
}
export async function readQuality() {
  return remote()
    ? requestLocalData<Awaited<ReturnType<typeof energyQuality>>>("quality")
    : energyQuality();
}
export async function readCollectionStatus() {
  return remote()
    ? requestLocalData<Awaited<ReturnType<typeof collectionStatus>>>(
        "collection",
      )
    : collectionStatus();
}
