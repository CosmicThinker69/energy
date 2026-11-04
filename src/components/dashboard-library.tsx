"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { canAccessPlan, planName } from "@/lib/config";
import { dashboardIcon, type DashboardRecord } from "@/lib/dashboard";
import { useMarket } from "./use-market";
import { usePortal } from "./portal-provider";
import { Badge, EmptyState, Icon } from "./ui";
import { Sparkline } from "./charts";
export function DashboardLibrary({
  dashboards,
}: {
  dashboards: DashboardRecord[];
}) {
  const { user, requestUpgrade } = usePortal();
  const [category, setCategory] = useState("All dashboards"),
    [query, setQuery] = useState(""),
    [available, setAvailable] = useState(false);
  const { data, loading } = useMarket(
    {
      dashboard: "overview",
      country: "BG",
      days: "1",
      resolution: "hourly",
      date: new Date().toISOString().slice(0, 10),
    },
    dashboards.some((d) => d.viewerType === "native"),
  );
  const filtered = dashboards.filter(
    (d) =>
      (category === "All dashboards" || d.category === category) &&
      (d.title + " " + d.description)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!available || canAccessPlan(user.plan, d.minimumPlan)),
  );
  const categories = useMemo(
    () => ["All dashboards", ...new Set(dashboards.map((d) => d.category))],
    [dashboards],
  );
  return (
    <>
      <div className="page-heading">
        <div className="library-heading">
          <h1>Market dashboards</h1>
          <p>Explore published market data and verified source dashboards.</p>
        </div>
        <Badge tone="green">
          <Icon name="sparkles" size={13} />
          {planName(user.plan)} access
        </Badge>
      </div>
      <div className="library-toolbar">
        <div
          className="category-tabs"
          role="tablist"
          aria-label="Dashboard category"
        >
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
              {c === "All dashboards" && <span>{dashboards.length}</span>}
            </button>
          ))}
        </div>
        <div className="library-filters">
          <div className="search-input">
            <Icon name="search" size={15} />
            <input
              placeholder="Find a dashboard…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find a dashboard"
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available to me
          </label>
        </div>
      </div>
      <div className="catalogue-grid">
        {filtered.map((d) => {
          const locked = !canAccessPlan(user.plan, d.minimumPlan);
          const rows = data?.rows || [];
          const key =
            d.nativeKey === "energy-mix"
              ? "generation"
              : d.nativeKey === "renewables"
                ? "renewableGeneration"
                : d.nativeKey === "cross-border"
                  ? "netFlow"
                  : "price";
          const values = rows.map((row) =>
            typeof row[key] === "number" ? Number(row[key]) : null,
          );
          const hasPreview =
            d.viewerType === "native" && values.some((v) => v !== null);
          return (
            <article
              className={`dashboard-card ${locked ? "locked" : ""}`}
              key={d.id}
            >
              <div className="dashboard-card-top">
                <span className="dashboard-icon">
                  <Icon name={dashboardIcon(d)} size={22} />
                </span>
                <span className="dashboard-card-badges">
                  {d.badge && (
                    <Badge tone="green" dot={d.badge === "LIVE DATA"}>
                      {d.badge}
                    </Badge>
                  )}
                  <Badge
                    tone={
                      d.minimumPlan === "premium"
                        ? "violet"
                        : d.minimumPlan === "professional"
                          ? "cyan"
                          : "subtle"
                    }
                  >
                    {planName(d.minimumPlan)}
                  </Badge>
                </span>
              </div>
              <div
                className={`dashboard-preview ${d.category === "Generation" ? "preview-generation" : ""}`}
                aria-hidden="true"
              >
                {hasPreview ? (
                  <Sparkline
                    values={values}
                    color={locked ? "var(--slate)" : "var(--mint)"}
                  />
                ) : (
                  <span>
                    {d.viewerType === "native"
                      ? loading
                        ? "Loading observations…"
                        : "No preview available"
                      : "Opens the source dashboard"}
                  </span>
                )}
              </div>
              <span className="card-category">{d.category}</span>
              <h2>{d.title}</h2>
              <p>{d.description}</p>
              <div className="dashboard-card-meta">
                <span>
                  <span
                    className={`status-dot ${d.viewerType === "native" ? "static" : ""}`}
                  />
                  {d.viewerType === "native"
                    ? "Published provider data"
                    : d.viewerType === "streamlit"
                      ? "Streamlit dashboard"
                      : "External HTML dashboard"}
                </span>
                <span>
                  <Icon name="clock" size={11} />
                  {d.viewerType !== "native"
                    ? "Source dashboard"
                    : data?.updatedAt
                      ? `BG · collected ${new Date(data.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
                      : "Awaiting observations"}
                </span>
              </div>
              {locked ? (
                <button
                  className="card-open locked-action"
                  onClick={() => requestUpgrade(d.minimumPlan, d.title)}
                >
                  <Icon name="lock" size={14} />
                  Requires {planName(d.minimumPlan)}
                  <Icon name="right" size={15} />
                </button>
              ) : (
                <Link className="card-open" href={`/dashboards/${d.slug}`}>
                  Open dashboard
                  <Icon name="right" size={15} />
                </Link>
              )}
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <EmptyState
          title="No dashboards match these filters"
          description="Try another topic or include dashboards outside your current plan."
          action={
            <button
              className="button"
              onClick={() => {
                setQuery("");
                setCategory("All dashboards");
                setAvailable(false);
              }}
            >
              Clear filters
            </button>
          }
        />
      )}
      <div className="catalogue-foot">
        <Icon name="shield" size={15} />
        <span>
          Previews use collected Bulgarian observations. Data gaps remain
          visible. Access follows your current account plan.
        </span>
        <Link href="/settings">
          Compare plans
          <Icon name="right" size={13} />
        </Link>
      </div>
    </>
  );
}
