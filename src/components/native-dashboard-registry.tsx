import type { ComponentType } from "react";
import { Analytics } from "./analytics";
import type { DashboardRecord, NativeDashboardKey } from "@/lib/dashboard";

export type NativeDashboardProps = {
  dashboard: DashboardRecord;
  nativeKey: NativeDashboardKey;
};

function nativeAnalytics(nativeKey: NativeDashboardKey) {
  return function NativeDashboard({
    dashboard,
  }: {
    dashboard: DashboardRecord;
  }) {
    return <Analytics dashboard={dashboard} nativeKey={nativeKey} />;
  };
}

export const nativeDashboardComponents: Record<
  NativeDashboardKey,
  ComponentType<{ dashboard: DashboardRecord }>
> = {
  "day-ahead": nativeAnalytics("day-ahead"),
  "energy-mix": nativeAnalytics("energy-mix"),
  regional: nativeAnalytics("regional"),
  balancing: nativeAnalytics("balancing"),
  "negative-prices": nativeAnalytics("negative-prices"),
  renewables: nativeAnalytics("renewables"),
  "cross-border": nativeAnalytics("cross-border"),
  historical: nativeAnalytics("historical"),
  country: nativeAnalytics("country"),
  intelligence: nativeAnalytics("intelligence"),
};
