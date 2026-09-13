"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ViewerType } from "@/lib/config";
import { Icon } from "./ui";

function configuredEmbedUrl(source?: string) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.searchParams.set("embed", "true");
    return url.toString();
  } catch {
    return null;
  }
}

function StreamlitViewer({
  source,
  title,
}: {
  source?: string;
  title: string;
}) {
  const embedUrl = useMemo(() => configuredEmbedUrl(source), [source]);
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
            ? "The live ENTSO-E dashboard did not respond. Try loading it again."
            : "The Streamlit dashboard source is not configured."}
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
          <span>Loading live ENTSO-E dashboard</span>
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
        tabIndex={state === "loaded" ? 0 : -1}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}

/** Integration boundary for native dashboards and approved external viewers. */
export function DashboardViewer({
  type,
  source,
  title = "Embedded dashboard",
  children,
}: {
  type: ViewerType;
  source?: string;
  title?: string;
  children?: ReactNode;
}) {
  if (type === "native") return <div className="native-viewer">{children}</div>;
  if (type === "streamlit") {
    return <StreamlitViewer source={source} title={title} />;
  }
  return (
    <div className="viewer-integration-state">
      <Icon name="external" size={28} />
      <h3>{type === "external-html" ? "Generated HTML" : "Embedded"} viewer</h3>
      <p>
        An approved dashboard source can be connected here when this viewer is
        enabled.
      </p>
      <span className="muted small">
        {source
          ? "An external source is configured; loading is disabled in this demo."
          : "No external source is connected."}
      </span>
    </div>
  );
}
