"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { canAccessPlan, planName } from "@/lib/config";
import { dashboardIcon, type DashboardRecord } from "@/lib/dashboard";
import { generateMarketRows } from "@/lib/market";
import { usePortal } from "./portal-provider";
import { Badge, EmptyState, Icon } from "./ui";
import { Sparkline } from "./charts";
export function DashboardLibrary({
  dashboards,
}: {
  dashboards: DashboardRecord[];
}) {
  const { user, live, requestUpgrade } = usePortal();
  const [category, setCategory] = useState("All dashboards"),
    [query, setQuery] = useState(""),
    [available, setAvailable] = useState(false);
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
          <p>Browse live and simulated dashboards available for your plan.</p>
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
        {filtered.map((d, i) => {
          const locked = !canAccessPlan(user.plan, d.minimumPlan);
          const rows = generateMarketRows({
            country: ["BG", "RO", "HU"][i % 3],
          });
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
                {d.category === "Generation" ? (
                  <div className="preview-bars">
                    {rows.slice(0, 18).map((r, j) => (
                      <span
                        key={j}
                        style={{
                          height: `${20 + r.renewable * 1.1}%`,
                          background:
                            j % 3 === 0
                              ? "var(--cyan)"
                              : j % 3 === 1
                                ? "var(--mint)"
                                : "var(--blue)",
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <Sparkline
                      values={rows.map((r) =>
                        d.nativeKey === "cross-border" ? r.netFlow : r.price,
                      )}
                      color={locked ? "var(--slate)" : "var(--mint)"}
                    />
                    <Sparkline
                      values={rows.map(
                        (r, j) => r.price + Math.sin(j / 3) * 19,
                      )}
                      color={locked ? "var(--slate)" : "var(--cyan)"}
                    />
                  </>
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
                    ? "Simulated market data"
                    : d.viewerType === "streamlit"
                      ? "Streamlit dashboard"
                      : "External HTML dashboard"}
                </span>
                <span>
                  <Icon name="clock" size={11} />
                  {d.viewerType !== "native"
                    ? "Hosted source"
                    : live
                      ? `Updated ${new Date(live.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`
                      : "Updated 00:00 UTC"}
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
          Native dashboards use simulated data; live sources are clearly marked.
          Access follows your current account plan.
        </span>
        <Link href="/settings">
          Compare plans
          <Icon name="right" size={13} />
        </Link>
      </div>
    </>
  );
}
