"use client";
import type { ReactNode } from "react";
import type { ViewerType } from "@/lib/config";
import { Icon } from "./ui";
/** Integration boundary: native content now; approved embed adapters can be supplied later. */
export function DashboardViewer({
  type,
  source,
  children,
}: {
  type: ViewerType;
  source?: string;
  children?: ReactNode;
}) {
  if (type === "native") return <div className="native-viewer">{children}</div>;
  return (
    <div className="viewer-integration-state">
      <Icon name="external" size={28} />
      <h3>
        {type === "streamlit"
          ? "Streamlit"
          : type === "external-html"
            ? "Generated HTML"
            : "Embedded"}{" "}
        viewer
      </h3>
      <p>
        This demo uses native charts. An approved dashboard source can be
        connected here when the integration is enabled.
      </p>
      <span className="muted small">
        {source
          ? "An external source is configured; loading is disabled in this demo."
          : "No external source is connected."}
      </span>
    </div>
  );
}
