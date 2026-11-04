"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { canAccessPlan, planName } from "@/lib/config";
import { dashboardIcon, type DashboardRecord } from "@/lib/dashboard";
import { Badge, EmptyState, Icon, Logo, Modal } from "./ui";
import { usePortal } from "./portal-provider";
function navigationIsActive(pathname: string, href: string) {
  return href === "/dashboards"
    ? pathname.startsWith("/dashboards")
    : pathname === href;
}
export function Shell({
  dashboards,
  children,
}: {
  dashboards: DashboardRecord[];
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const { user, status, toast, requestUpgrade } = usePortal();
  const navigation = [
    { label: "Overview", href: "/", icon: "overview" },
    {
      label: "Market dashboards",
      href: "/dashboards",
      icon: "chart",
      count: String(dashboards.length),
    },
    { label: "Data Explorer", href: "/explorer", icon: "database" },
    { label: "Data catalogue", href: "/data", icon: "database" },
    { label: "Ask TEMO", href: "/assistant", icon: "sparkles" },
  ];
  const [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
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
                : pathname === "/assistant"
                  ? "Ask TEMO"
                  : pathname.startsWith("/admin")
                    ? "Dashboard administration"
                    : dashboards.find((d) => pathname.endsWith(d.slug))
                        ?.title || "Market intelligence";
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
        <div className="nav-label">Workspace</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => {
            const active = navigationIsActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.count && <span className="nav-count">{item.count}</span>}
              </Link>
            );
          })}
        </nav>
        {user.role === "admin" && (
          <div className="admin-navigation">
            <div className="nav-label">Administration</div>
            <nav aria-label="Administration">
              <Link
                href="/admin/dashboards"
                className={`nav-item ${pathname.startsWith("/admin") ? "active" : ""}`}
                aria-current={
                  pathname.startsWith("/admin") ? "page" : undefined
                }
              >
                <Icon name="shield" />
                <span>Dashboard registry</span>
              </Link>
            </nav>
          </div>
        )}
        <div className="sidebar-bottom">
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
          </Link>
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
              <span>Search dashboards…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <div className="header-live">
              <Badge dot tone={status === "live" ? "green" : "amber"}>
                {status === "live"
                  ? "Data connected"
                  : status === "connecting"
                    ? "Connecting"
                    : "Reconnecting"}
              </Badge>
              <small>Published provider data</small>
            </div>
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
                    {user.role === "admin" && (
                      <Link href="/admin/dashboards">
                        <Icon name="shield" />
                        Dashboard registry
                      </Link>
                    )}
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
          <span>Stored provider observations · missing values remain gaps</span>
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
              placeholder="Search dashboards…"
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
                  if (canAccessPlan(user.plan, d.minimumPlan))
                    router.push("/dashboards/" + d.slug);
                  else requestUpgrade(d.minimumPlan, d.title);
                }}
              >
                <Icon name={dashboardIcon(d)} />
                <div>
                  <strong>{d.title}</strong>
                  <small>{d.category}</small>
                </div>
                {!canAccessPlan(user.plan, d.minimumPlan) ? (
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
    </div>
  );
}
