"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { canAccess, dashboards, planName } from "@/lib/config";
import { marketEvents } from "@/lib/market";
import { Badge, EmptyState, Icon, Logo, Modal } from "./ui";
import { usePortal } from "./portal-provider";
const navigation = [
  { label: "Overview", href: "/", icon: "overview" },
  {
    label: "Market dashboards",
    href: "/dashboards",
    icon: "chart",
    count: "10",
  },
  { label: "Prices", href: "/dashboards/day-ahead", icon: "activity" },
  { label: "Generation", href: "/dashboards/energy-mix", icon: "pie" },
  { label: "Balancing", href: "/dashboards/balancing", icon: "arrows" },
  { label: "Regional markets", href: "/dashboards/regional", icon: "globe" },
  { label: "Reports", href: "/reports", icon: "report" },
  { label: "Data Explorer", href: "/explorer", icon: "database" },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  const { user, live, status, toast, requestUpgrade } = usePortal();
  const [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [read, setRead] = useState(false),
    [profile, setProfile] = useState(false);
  useEffect(() => {
    setMobile(false);
    setProfile(false);
  }, [pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setProfile(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const current =
    pathname === "/"
      ? "Workspace overview"
      : pathname === "/dashboards"
        ? "Market dashboards"
        : pathname === "/settings"
          ? "Account & settings"
          : pathname === "/help"
            ? "Help & resources"
            : pathname === "/explorer"
              ? "Data Explorer"
              : pathname === "/reports"
                ? "Research & reports"
                : dashboards.find((d) => pathname.endsWith(d.id))?.shortTitle ||
                  "Market intelligence";
  const matches = dashboards.filter((d) =>
    (d.title + " " + d.category + " " + d.description)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const logout = async () => {
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error();
      const channel = new BroadcastChannel("temo-account");
      channel.postMessage("changed");
      channel.close();
      router.replace("/login");
      router.refresh();
    } catch {
      toast("Unable to sign out. Please try again.");
    }
  };
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link href="/" className="brand-link" aria-label="TEMO overview">
          <Logo />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Icon name="zap" size={16} />
          </span>
          <div>
            <strong>Energy Intelligence</strong>
            <small>European markets</small>
          </div>
          <Badge tone="subtle">DEMO</Badge>
        </div>
        <div className="nav-label">Workspace</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.count && <span className="nav-count">{item.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-summary">
            <div className="plan-summary-top">
              <Icon name="sparkles" size={16} />
              <strong>{planName(user.plan)} plan</strong>
            </div>
            <p>
              {user.plan === "premium"
                ? "Your full market perspective."
                : "More insight. A wider perspective."}
            </p>
            <Link href="/settings">
              {user.plan === "premium"
                ? "Manage your plan"
                : "Explore access plans"}
              <Icon name="right" size={14} />
            </Link>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
          >
            <Icon name="settings" />
            Settings
          </Link>
          <Link
            href="/help"
            className={`nav-item ${pathname === "/help" ? "active" : ""}`}
          >
            <Icon name="help" />
            Help & resources
            <Icon name="external" size={13} />
          </Link>
          <div className="sidebar-foot">
            <span className="status-dot" />
            All systems operational<span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Search workspace"
              className="search-trigger"
              onClick={() => {
                setQuery("");
                setSearchOpen(true);
              }}
            >
              <Icon name="search" size={15} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <div className="header-live">
              <Badge dot tone={status === "live" ? "green" : "amber"}>
                {status === "live"
                  ? "Markets live"
                  : status === "connecting"
                    ? "Connecting"
                    : "Reconnecting"}
              </Badge>
              <small>
                {live
                  ? `Updated ${new Date(live.timestamp).toLocaleTimeString("en-GB")}`
                  : "Connecting to demo feed"}
              </small>
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Open notifications"
              onClick={() => setNotifications(true)}
            >
              <Icon name="bell" />
              {!read && <span className="notification-dot" />}
            </button>
            <div className="profile-wrap">
              <button
                className="profile-trigger"
                aria-label="Open account menu"
                aria-expanded={profile}
                onClick={() => setProfile(!profile)}
              >
                <span className="avatar">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </span>
                <Icon name="chevron" size={13} />
              </button>
              {profile && (
                <>
                  <button
                    className="dismiss-layer"
                    aria-label="Close account menu"
                    onClick={() => setProfile(false)}
                  />
                  <div className="profile-menu">
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small>{user.email}</small>
                    <span>{user.company}</span>
                    <Badge tone="green">{planName(user.plan)}</Badge>
                    <Link href="/settings">
                      <Icon name="user" />
                      Account & plan
                    </Link>
                    <button onClick={logout}>
                      <Icon name="logout" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="page-content" id="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            <Logo compact />
            Renewable Market Intelligence
          </span>
          <span>
            Demonstration environment<span className="footer-dot">·</span>All
            market data is simulated
          </span>
          <span>Times in UTC</span>
        </footer>
      </div>
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search your workspace"
        wide
      >
        <div className="search-dialog">
          <div className="search-input">
            <Icon name="search" />
            <input
              autoFocus
              placeholder="Search dashboards, markets, or analytics…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search dashboards"
            />
          </div>
          <p className="muted small">Dashboards · {matches.length} results</p>
          <div className="search-results">
            {matches.map((d) => (
              <button
                key={d.id}
                className="search-result"
                onClick={() => {
                  setSearchOpen(false);
                  if (canAccess(user.plan, d.id))
                    router.push("/dashboards/" + d.id);
                  else requestUpgrade(d.plan, d.shortTitle);
                }}
              >
                <Icon name={d.icon} />
                <div>
                  <strong>{d.shortTitle}</strong>
                  <small>{d.category}</small>
                </div>
                {!canAccess(user.plan, d.id) ? (
                  <Icon name="lock" size={14} />
                ) : (
                  <Icon name="right" size={14} />
                )}
              </button>
            ))}
            {!matches.length && (
              <EmptyState
                title="No matching dashboards"
                description="Try a market topic such as prices, renewables, or flows."
              />
            )}
          </div>
        </div>
      </Modal>
      <Modal
        open={notifications}
        onClose={() => setNotifications(false)}
        title="Market notifications"
      >
        <div className="notification-head">
          <span className="muted small">Your European market briefing</span>
          <button className="text-button" onClick={() => setRead(true)}>
            <Icon name="checks" size={14} />
            {read ? "All read" : "Mark all as read"}
          </button>
        </div>
        {marketEvents.map((event, i) => (
          <div className="notification-row" key={event.title}>
            <span className={`event-icon ${event.level}`}>
              <Icon name={i === 0 ? "activity" : i === 1 ? "sun" : "arrows"} />
            </span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
              <small>{event.time} · Demo alert</small>
            </div>
            {!read && <span className="status-dot" />}
          </div>
        ))}
      </Modal>
    </div>
  );
}
