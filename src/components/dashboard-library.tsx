"use client";
import Link from "next/link";
import { useState } from "react";
import { canAccess, dashboards, planName } from "@/lib/config";
import { generateMarketRows } from "@/lib/market";
import { usePortal } from "./portal-provider";
import { Badge, EmptyState, Icon } from "./ui";
import { Sparkline } from "./charts";
export function DashboardLibrary() {
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
      (!available || canAccess(user.plan, d.id)),
  );
  return (
    <>
      <div className="page-heading">
        <div className="library-heading">
          <div className="page-eyebrow">YOUR MARKET TOOLKIT</div>
          <h1>Every angle of the energy market.</h1>
          <p>
            Purpose-built analytics. Connected markets. A more complete
            perspective.
          </p>
        </div>
        <Badge tone="green">
          <Icon name="sparkles" size={13} />
          {planName(user.plan)} access
        </Badge>
      </div>
      <div className="library-intro">
        <div>
          <Icon name="chart" size={24} />
          <span>
            <strong>10 dashboards</strong>
            <small>One connected workspace</small>
          </span>
        </div>
        <div>
          <Icon name="globe" size={24} />
          <span>
            <strong>8 European markets</strong>
            <small>From local detail to regional context</small>
          </span>
        </div>
        <div>
          <Icon name="activity" size={24} />
          <span>
            <strong>Continuously updating</strong>
            <small>Simulated live market intelligence</small>
          </span>
        </div>
        <Link href="/settings" className="text-button">
          Compare access plans
          <Icon name="right" size={15} />
        </Link>
      </div>
      <div className="library-toolbar">
        <div
          className="category-tabs"
          role="tablist"
          aria-label="Dashboard category"
        >
          {[
            "All dashboards",
            "Prices",
            "Generation",
            "Regional",
            "Balancing",
            "Research",
          ].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
              {c === "All dashboards" && <span>10</span>}
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
          const locked = !canAccess(user.plan, d.id);
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
                  <Icon name={d.icon} size={22} />
                </span>
                <Badge
                  tone={
                    d.plan === "premium"
                      ? "violet"
                      : d.plan === "professional"
                        ? "cyan"
                        : "subtle"
                  }
                >
                  {planName(d.plan)}
                </Badge>
              </div>
              <div
                className={`dashboard-preview preview-${d.category.toLowerCase()}`}
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
                        d.id === "cross-border" ? r.netFlow : r.price,
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
              <h2>{d.shortTitle}</h2>
              <p>{d.description}</p>
              <div className="dashboard-card-meta">
                <span>
                  <span className={`status-dot ${d.live ? "" : "static"}`} />
                  {d.live ? "Live simulation" : "Historical dataset"}
                </span>
                <span>
                  <Icon name="clock" size={11} />
                  {d.live && live
                    ? `Updated ${new Date(live.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`
                    : "Updated 00:00 UTC"}
                </span>
              </div>
              {locked ? (
                <button
                  className="card-open locked-action"
                  onClick={() => requestUpgrade(d.plan, d.shortTitle)}
                >
                  <Icon name="lock" size={14} />
                  Requires {planName(d.plan)}
                  <Icon name="right" size={15} />
                </button>
              ) : (
                <Link className="card-open" href={`/dashboards/${d.id}`}>
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
          All dashboards use realistic simulated data. Access is determined by
          your current account plan.
        </span>
        <Link href="/settings">
          Compare plans
          <Icon name="right" size={13} />
        </Link>
      </div>
    </>
  );
}
