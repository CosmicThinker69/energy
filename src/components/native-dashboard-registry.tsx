import type { ComponentType } from "react";
import { Analytics } from "./analytics";
import type { DashboardRecord, NativeDashboardKey } from "@/lib/dashboard";

export type NativeDashboardProps = {
  dashboard: DashboardRecord;
  nativeKey: NativeDashboardKey;
  live: boolean;
};

function nativeAnalytics(nativeKey: NativeDashboardKey, live: boolean) {
  return function NativeDashboard({
    dashboard,
  }: {
    dashboard: DashboardRecord;
  }) {
    return (
      <Analytics dashboard={dashboard} nativeKey={nativeKey} live={live} />
    );
  };
}

export const nativeDashboardComponents: Record<
  NativeDashboardKey,
  ComponentType<{ dashboard: DashboardRecord }>
> = {
  "day-ahead": nativeAnalytics("day-ahead", true),
  "energy-mix": nativeAnalytics("energy-mix", true),
  regional: nativeAnalytics("regional", true),
  balancing: nativeAnalytics("balancing", true),
  "negative-prices": nativeAnalytics("negative-prices", false),
  renewables: nativeAnalytics("renewables", true),
  "cross-border": nativeAnalytics("cross-border", true),
  historical: nativeAnalytics("historical", false),
  country: nativeAnalytics("country", true),
  intelligence: nativeAnalytics("intelligence", false),
};
