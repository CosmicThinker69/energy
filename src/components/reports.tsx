"use client";
import { useState } from "react";
import { canAccess } from "@/lib/config";
import type { Report } from "@/lib/reports";
import { Badge, EmptyState, Icon, Modal } from "./ui";
import { usePortal } from "./portal-provider";
import { downloadFile } from "./use-market";
export function Reports({ reports }: { reports: Omit<Report, "sections">[] }) {
  const { user, requestUpgrade, toast } = usePortal();
  const [filter, setFilter] = useState("All research"),
    [selected, setSelected] = useState<Report | null>(null),
    [loading, setLoading] = useState("");
  const allowed = canAccess(user.plan, "reports");
  const openReport = async (id: string) => {
    if (!allowed) {
      requestUpgrade("premium", "Advanced reports");
      return;
    }
    setLoading(id);
    try {
      const response = await fetch("/api/reports/" + id);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSelected(result);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setLoading("");
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">THE BIGGER PICTURE</div>
          <h1>Research & reports</h1>
          <p>Context for the numbers. Perspectives for your next decision.</p>
        </div>
        <Badge tone="violet">
          <Icon name="sparkles" size={13} />
          Premium intelligence
        </Badge>
      </div>
      <div className="research-feature">
        <div className="research-feature-copy">
          <Badge tone="green">Latest perspective</Badge>
          <h2>
            The forces shaping
            <br />
            Europe’s electricity markets.
          </h2>
          <p>
            Explore regional spreads, the renewable transition, and a more
            interconnected energy system.
          </p>
          <button
            className="button primary"
            disabled={loading === reports[0].id}
            onClick={() => openReport(reports[0].id)}
          >
            Read the weekly outlook
            <Icon name="right" size={15} />
          </button>
        </div>
        <div className="research-visual" aria-hidden="true">
          <div className="research-bars">
            {[
              34, 40, 52, 44, 58, 69, 54, 48, 62, 73, 65, 79, 68, 85, 74, 90,
              82, 96,
            ].map((n, i) => (
              <span key={i} style={{ height: n + "%" }} />
            ))}
          </div>
          <span>SUPPLY · DEMAND · PERSPECTIVE</span>
        </div>
      </div>
      <div className="overview-tabs">
        <div>
          {[
            "All research",
            "Market outlook",
            "Renewables research",
            "Deep dive",
            "Regional intelligence",
          ].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span>
          {
            reports.filter(
              (r) => filter === "All research" || r.type === filter,
            ).length
          }{" "}
          reports
        </span>
      </div>
      <div className="report-list">
        {reports
          .filter((r) => filter === "All research" || r.type === filter)
          .map((r, i) => (
            <article className="report-row" key={r.id}>
              <div className={`report-cover cover-${i}`}>
                <Icon
                  name={["globe", "leaf", "activity", "arrows"][i]}
                  size={34}
                />
                <span>
                  TEMO
                  <br />
                  RESEARCH
                </span>
              </div>
              <div>
                <Badge tone="subtle">{r.type}</Badge>
                <h2>{r.title}</h2>
                <p>{r.description}</p>
                <span className="muted small">
                  {new Date(r.date + "T12:00:00Z").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {r.read} · Demo research
                </span>
              </div>
              <button
                className="button"
                disabled={loading === r.id}
                onClick={() => openReport(r.id)}
              >
                {!allowed ? (
                  <Icon name="lock" size={14} />
                ) : (
                  <Icon name="book" size={14} />
                )}{" "}
                {loading === r.id
                  ? "Loading…"
                  : allowed
                    ? "Read report"
                    : "Premium access"}
              </button>
            </article>
          ))}
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="TEMO Research"
        wide
      >
        {selected && (
          <article className="report-reader">
            <Badge tone="green">{selected.type}</Badge>
            <h1>{selected.title}</h1>
            <p className="muted small">
              {selected.date} · {selected.read} · Simulated demonstration
              research
            </p>
            {selected.sections.map(([title, text]) => (
              <section key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await downloadFile(
                    `/api/reports/${selected.id}?download=1`,
                    `temo-${selected.id}.txt`,
                  );
                  toast("Report downloaded.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <Icon name="download" size={15} />
              Download report
            </button>
          </article>
        )}
      </Modal>
    </>
  );
}
