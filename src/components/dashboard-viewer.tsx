"use client";
import { useEffect, useMemo, useState } from "react";
import type { DashboardRecord } from "@/lib/dashboard";
import { Icon } from "./ui";
import { nativeDashboardComponents } from "./native-dashboard-registry";

function configuredEmbedUrl(source: string | null, streamlit: boolean) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (streamlit) url.searchParams.set("embed", "true");
    return url.toString();
  } catch {
    return null;
  }
}

function ExternalDashboard({
  source,
  title,
  streamlit,
}: {
  source: string | null;
  title: string;
  streamlit: boolean;
}) {
  const embedUrl = useMemo(
    () => configuredEmbedUrl(source, streamlit),
    [source, streamlit],
  );
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setState(embedUrl ? "loading" : "error");
    if (!embedUrl) return;
    const timeout = window.setTimeout(
      () => setState((current) => (current === "loading" ? "error" : current)),
      30_000,
    );
    return () => window.clearTimeout(timeout);
  }, [attempt, embedUrl]);

  if (!embedUrl || state === "error") {
    return (
      <div className="viewer-integration-state streamlit-error" role="alert">
        <Icon name="warning" size={28} />
        <h3>Dashboard unavailable</h3>
        <p>
          {embedUrl
            ? `${title} did not respond. Try loading it again.`
            : "The external dashboard source is not configured."}
        </p>
        {embedUrl && (
          <button
            className="button primary"
            onClick={() => {
              setState("loading");
              setAttempt((value) => value + 1);
            }}
          >
            <Icon name="refresh" size={15} />
            Reload dashboard
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="streamlit-viewer">
      {state === "loading" && (
        <div className="streamlit-loading" role="status" aria-live="polite">
          <span>Loading {title}</span>
          <div className="streamlit-loading-layout" aria-hidden="true">
            <div className="skeleton streamlit-loading-sidebar" />
            <div>
              <div className="skeleton streamlit-loading-title" />
              <div className="skeleton streamlit-loading-chart" />
            </div>
          </div>
        </div>
      )}
      <iframe
        key={attempt}
        className={state === "loaded" ? "loaded" : ""}
        src={embedUrl}
        title={title}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen; clipboard-read; clipboard-write"
        sandbox={
          streamlit
            ? "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals"
            : "allow-scripts allow-forms allow-downloads allow-popups"
        }
        tabIndex={state === "loaded" ? 0 : -1}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}

/** Integration boundary for native dashboards and approved external viewers. */
export function DashboardViewer({ dashboard }: { dashboard: DashboardRecord }) {
  if (dashboard.viewerType === "native") {
    const NativeDashboard = dashboard.nativeKey
      ? nativeDashboardComponents[dashboard.nativeKey]
      : null;
    if (!NativeDashboard) {
      return (
        <div className="viewer-integration-state" role="alert">
          <Icon name="warning" size={28} />
          <h3>Native dashboard unavailable</h3>
          <p>The configured native component could not be resolved.</p>
        </div>
      );
    }
    return <NativeDashboard dashboard={dashboard} />;
  }
  return (
    <ExternalDashboard
      source={dashboard.sourceUrl}
      title={dashboard.title}
      streamlit={dashboard.viewerType === "streamlit"}
    />
  );
}
