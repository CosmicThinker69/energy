"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { planName, plans } from "@/lib/config";
import {
  viewerTypes,
  type DashboardInput,
  type DashboardRecord,
  type NativeDashboardKey,
  type ViewerType,
} from "@/lib/dashboard";
import { Badge, Icon, Modal } from "./ui";

type Draft = DashboardInput & { id?: string };

function newDraft(sortOrder: number): Draft {
  return {
    title: "",
    slug: "",
    description: "",
    category: "",
    viewerType: "streamlit",
    nativeKey: null,
    sourceUrl: "",
    minimumPlan: "basic",
    badge: "LIVE DATA",
    enabled: true,
    sortOrder,
  };
}

function editDraft(dashboard: DashboardRecord): Draft {
  return {
    id: dashboard.id,
    title: dashboard.title,
    slug: dashboard.slug,
    description: dashboard.description,
    category: dashboard.category,
    viewerType: dashboard.viewerType,
    nativeKey: dashboard.nativeKey,
    sourceUrl: dashboard.sourceUrl,
    minimumPlan: dashboard.minimumPlan,
    badge: dashboard.badge,
    enabled: dashboard.enabled,
    sortOrder: dashboard.sortOrder,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function responseJson(response: Response) {
  if (response.status === 204) return {};
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request failed.");
  return data;
}

export function AdminDashboardManager({
  initialDashboards,
  nativeKeys,
}: {
  initialDashboards: DashboardRecord[];
  nativeKeys: NativeDashboardKey[];
}) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState(initialDashboards);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    const data = await responseJson(await fetch("/api/admin/dashboards"));
    setDashboards(data.dashboards);
    router.refresh();
  };

  const mutate = async (
    operation: () => Promise<Response>,
    message: string,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await responseJson(await operation());
      await refresh();
      setNotice(message);
      return true;
    } catch (caught) {
      setError((caught as Error).message || "The change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const saved = await mutate(
      () =>
        fetch(
          draft.id
            ? `/api/admin/dashboards/${draft.id}`
            : "/api/admin/dashboards",
          {
            method: draft.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          },
        ),
      draft.id ? "Dashboard updated." : "Dashboard added.",
    );
    if (saved) setDraft(null);
  };

  const toggle = (dashboard: DashboardRecord) =>
    mutate(
      () =>
        fetch(`/api/admin/dashboards/${dashboard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "enabled",
            enabled: !dashboard.enabled,
          }),
        }),
      dashboard.enabled ? "Dashboard disabled." : "Dashboard enabled.",
    );

  const remove = async (dashboard: DashboardRecord) => {
    if (
      !window.confirm(
        `Delete “${dashboard.title}” from the registry? This removes metadata only and does not delete market data or the external application.`,
      )
    )
      return;
    await mutate(
      () =>
        fetch(`/api/admin/dashboards/${dashboard.id}`, { method: "DELETE" }),
      "Dashboard metadata deleted.",
    );
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= dashboards.length) return;
    const reordered = [...dashboards];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    await mutate(
      () =>
        fetch("/api/admin/dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reorder",
            ids: reordered.map((item) => item.id),
          }),
        }),
      "Dashboard order updated.",
    );
  };

  return (
    <>
      <div className="page-heading admin-heading">
        <div>
          <h1>Dashboard registry</h1>
          <p>Manage native and hosted dashboards available in the portal.</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            setDraft(newDraft((dashboards.at(-1)?.sortOrder || 0) + 10))
          }
        >
          <Icon name="plus" size={15} />
          Add dashboard
        </button>
      </div>

      <div className="admin-summary">
        <span>{dashboards.length} registered</span>
        <span>
          {dashboards.filter((dashboard) => dashboard.enabled).length} enabled
        </span>
        <span>
          {
            dashboards.filter(
              (dashboard) => dashboard.viewerType === "streamlit",
            ).length
          }{" "}
          Streamlit
        </span>
      </div>

      {error && (
        <div className="form-error" role="alert">
          <Icon name="warning" size={16} />
          {error}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          <Icon name="check" size={15} />
          {notice}
        </p>
      )}

      <section className="panel admin-dashboard-panel">
        <div className="table-scroll">
          <table className="data-table admin-dashboard-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Type</th>
                <th>Category</th>
                <th>Minimum plan</th>
                <th>Badge</th>
                <th>Enabled</th>
                <th>Order</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboards.map((dashboard, index) => (
                <tr key={dashboard.id}>
                  <td>
                    <strong>{dashboard.title}</strong>
                  </td>
                  <td>
                    <code>{dashboard.slug}</code>
                  </td>
                  <td>{dashboard.viewerType}</td>
                  <td>{dashboard.category}</td>
                  <td>
                    <Badge
                      tone={
                        dashboard.minimumPlan === "premium"
                          ? "violet"
                          : dashboard.minimumPlan === "professional"
                            ? "cyan"
                            : "subtle"
                      }
                    >
                      {planName(dashboard.minimumPlan)}
                    </Badge>
                  </td>
                  <td>{dashboard.badge || "—"}</td>
                  <td>
                    <Badge tone={dashboard.enabled ? "green" : "subtle"} dot>
                      {dashboard.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </td>
                  <td>{dashboard.sortOrder}</td>
                  <td>
                    {new Date(dashboard.updatedAt).toLocaleDateString("en-GB")}
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        className="icon-button outlined"
                        aria-label={`Move ${dashboard.title} up`}
                        title="Move up"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <Icon name="up" size={14} />
                      </button>
                      <button
                        className="icon-button outlined"
                        aria-label={`Move ${dashboard.title} down`}
                        title="Move down"
                        disabled={busy || index === dashboards.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <Icon name="down" size={14} />
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setDraft(editDraft(dashboard))}
                      >
                        Edit
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => toggle(dashboard)}
                      >
                        {dashboard.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => remove(dashboard)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!draft}
        onClose={() => !busy && setDraft(null)}
        title={draft?.id ? "Edit dashboard" : "Add dashboard"}
        wide
      >
        {draft && (
          <form className="admin-dashboard-form" onSubmit={save}>
            <div className="form-row">
              <label>
                Title
                <input
                  value={draft.title}
                  maxLength={120}
                  required
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            title: event.target.value,
                            slug:
                              current.id ||
                              (current.slug &&
                                current.slug !== slugify(current.title))
                                ? current.slug
                                : slugify(event.target.value),
                          }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                Slug
                <input
                  value={draft.slug}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  minLength={2}
                  maxLength={80}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, slug: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={draft.description}
                maxLength={1000}
                rows={3}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Category
                <input
                  value={draft.category}
                  maxLength={80}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                />
              </label>
              <label>
                Dashboard type
                <select
                  value={draft.viewerType}
                  onChange={(event) => {
                    const viewerType = event.target.value as ViewerType;
                    setDraft({
                      ...draft,
                      viewerType,
                      nativeKey:
                        viewerType === "native"
                          ? draft.nativeKey || nativeKeys[0]
                          : null,
                      sourceUrl:
                        viewerType === "native" ? null : draft.sourceUrl,
                    });
                  }}
                >
                  {viewerTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "streamlit"
                        ? "Streamlit"
                        : type === "external-html"
                          ? "External HTML"
                          : "Native"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {draft.viewerType === "native" ? (
              <label>
                Native component
                <select
                  value={draft.nativeKey || nativeKeys[0]}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      nativeKey: event.target.value as NativeDashboardKey,
                    })
                  }
                >
                  {nativeKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
                <span className="field-help">
                  Only developer-registered React dashboards can be selected.
                </span>
              </label>
            ) : (
              <label>
                Source URL
                <input
                  type="url"
                  value={draft.sourceUrl || ""}
                  maxLength={2048}
                  placeholder="https://dashboard.example.com/"
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, sourceUrl: event.target.value })
                  }
                />
              </label>
            )}
            <div className="form-row">
              <label>
                Minimum access
                <select
                  value={draft.minimumPlan}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      minimumPlan: event.target
                        .value as DashboardInput["minimumPlan"],
                    })
                  }
                >
                  {plans.map((plan) => (
                    <option key={plan} value={plan}>
                      {planName(plan)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Badge
                <input
                  value={draft.badge || ""}
                  maxLength={40}
                  placeholder="LIVE DATA"
                  onChange={(event) =>
                    setDraft({ ...draft, badge: event.target.value })
                  }
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={draft.sortOrder}
                  min={-100000}
                  max={100000}
                  step={1}
                  required
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sortOrder: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="checkbox-label admin-enabled-field">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft({ ...draft, enabled: event.target.checked })
                }
              />
              Enabled in the customer portal
            </label>
            {error && (
              <div className="form-error" role="alert">
                <Icon name="warning" size={16} />
                {error}
              </div>
            )}
            <div className="admin-form-actions">
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save dashboard"}
                <Icon name="check" size={15} />
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
