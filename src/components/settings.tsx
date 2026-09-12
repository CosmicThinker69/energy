"use client";
import { useState, type FormEvent } from "react";
import { planDetails, planName, plans } from "@/lib/config";
import { usePortal } from "./portal-provider";
import { Badge, Icon, Panel } from "./ui";
export function Settings() {
  const { user, updateUser, requestUpgrade, toast } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      updateUser(result.user);
      toast("Your account details have been saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Account & settings</h1>
          <p>Your profile, workspace, and market access.</p>
        </div>
        <Badge tone="green">
          <Icon name="shield" size={13} />
          Active account
        </Badge>
      </div>
      <div className="settings-grid">
        <Panel
          title="Profile details"
          subtitle="The person behind the market perspective"
        >
          <div className="profile-summary">
            <span className="avatar large">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <div>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <p>{user.company}</p>
            </div>
            <Badge tone="green">{planName(user.plan)}</Badge>
          </div>
          <form className="settings-form" onSubmit={save} key={user.id}>
            <div className="form-row">
              <label>
                First name
                <input
                  name="firstName"
                  defaultValue={user.firstName}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  defaultValue={user.lastName}
                  maxLength={100}
                  required
                />
              </label>
            </div>
            <label>
              Company
              <input
                name="company"
                defaultValue={user.company}
                maxLength={100}
                required
              />
            </label>
            <label>
              Email address
              <input type="email" value={user.email} disabled readOnly />
            </label>
            <p className="field-help">
              This email identifies your account and cannot be changed.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-footer">
              <span>
                Member since{" "}
                {new Date(user.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
                <Icon name="check" size={15} />
              </button>
            </div>
          </form>
        </Panel>
        <Panel title="Your workspace" subtitle="Everything in one place">
          <dl className="statistics-list">
            <div>
              <dt>Workspace</dt>
              <dd>Energy Intelligence</dd>
            </div>
            <div>
              <dt>Current plan</dt>
              <dd>
                <Badge tone="green">{planName(user.plan)}</Badge>
              </dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Customer portal</dd>
            </div>
            <div>
              <dt>Market coverage</dt>
              <dd>8 bidding zones</dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>Simulated</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>UTC</dd>
            </div>
          </dl>
          <div className="workspace-note">
            <Icon name="shield" size={20} />
            <div>
              <strong>Plan managed by TEMO.</strong>
              <p>
                Your plan is read-only here. Contact sales if your team needs
                broader market access.
              </p>
            </div>
          </div>
        </Panel>
      </div>
      <div className="section-heading">
        <div>
          <h2>Compare market access</h2>
          <p>
            Review what each tier includes. Plan changes are handled by TEMO.
          </p>
        </div>
        <Badge tone="subtle">Contact sales to upgrade</Badge>
      </div>
      <div className="plan-grid">
        {plans.map((p) => (
          <section
            key={p}
            className={`plan-card ${user.plan === p ? "current-plan" : ""}`}
          >
            <div className="plan-card-top">
              <Icon
                name={
                  p === "basic"
                    ? "chart"
                    : p === "professional"
                      ? "globe"
                      : "sparkles"
                }
                size={23}
              />
              {user.plan === p && (
                <Badge tone="green">
                  <Icon name="check" size={12} />
                  Current plan
                </Badge>
              )}
            </div>
            <h3>{planName(p)}</h3>
            <p>{planDetails[p].description}</p>
            <ul>
              {planDetails[p].features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={15} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`button full ${p === "professional" ? "primary" : ""}`}
              disabled={user.plan === p}
              onClick={() => requestUpgrade(p, `${planName(p)} plan`)}
            >
              {user.plan === p ? "Your current plan" : "Contact sales"}
              {user.plan !== p && <Icon name="right" size={15} />}
            </button>
          </section>
        ))}
      </div>
      <div className="settings-foot">
        <Icon name="activity" size={16} />
        <span>
          Access changes made by TEMO apply to your next request and every open
          workspace tab.
        </span>
      </div>
    </>
  );
}
