import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { readCoverage as dataCoverage } from "@/lib/server/energy-service";
import { LocalDataUnavailable } from "@/lib/server/local-data-bridge";
import { Panel } from "@/components/ui";
import { SourceData } from "@/components/source-data";
import { canAccess } from "@/lib/config";

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  let result: Awaited<ReturnType<typeof dataCoverage>>;
  try {
    result = await dataCoverage();
  } catch (error) {
    if (error instanceof LocalDataUnavailable)
      return (
        <>
          <h1>Data catalogue</h1>
          <p role="status">
            The local data computer is disconnected. Keep the TEMO data agent
            running to load market data.
          </p>
          <Link className="button" href="/data">
            Retry connection
          </Link>
        </>
      );
    throw error;
  }
  const { coverage, sources, collectionIssues } = result;
  const grouped = new Map<
    string,
    {
      source: string;
      dataset: string;
      area: string;
      observations: number;
      available_from: Date;
      available_until: Date;
      last_collected_at: Date;
      metrics: number;
    }
  >();
  for (const r of coverage) {
    if (
      (params.source && r.source !== params.source) ||
      (params.dataset && r.dataset !== params.dataset) ||
      (params.area && r.area !== params.area)
    )
      continue;
    const key = `${r.source}:${r.dataset}:${r.area}`;
    const previous = grouped.get(key);
    if (previous) {
      previous.observations += Number(r.observations);
      previous.metrics++;
      if (r.available_from < previous.available_from)
        previous.available_from = r.available_from;
      if (r.available_until > previous.available_until)
        previous.available_until = r.available_until;
      if (r.last_collected_at > previous.last_collected_at)
        previous.last_collected_at = r.last_collected_at;
    } else
      grouped.set(key, {
        source: r.source,
        dataset: r.dataset,
        area: r.area,
        observations: Number(r.observations),
        available_from: r.available_from,
        available_until: r.available_until,
        last_collected_at: r.last_collected_at,
        metrics: 1,
      });
  }
  const page = Math.max(1, Number(params.page) || 1);
  const groups = [...grouped.values()];
  const visible = groups.slice((page - 1) * 25, page * 25);
  const pageUrl = (n: number) =>
    "/data?" +
    new URLSearchParams({
      ...(Object.fromEntries(
        Object.entries(params).filter(
          ([k, v]) => k !== "page" && v !== undefined,
        ),
      ) as Record<string, string>),
      page: String(n),
    });
  const fmt = (v: unknown) =>
    new Date(String(v)).toLocaleString("en-GB", { timeZone: "Europe/Sofia" });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">SOURCE DATA</div>
          <h1>Data catalogue</h1>
          <p>
            Available history and collection status. Display times use
            Europe/Sofia; observation intervals use UTC.
          </p>
        </div>
        <Link href="/explorer" className="button">
          Open Data Explorer
        </Link>
      </div>
      {params.source &&
        params.dataset &&
        params.area &&
        canAccess(user.plan, "explorer") && (
          <SourceData
            key={`${params.source}:${params.dataset}:${params.area}`}
            source={params.source}
            dataset={params.dataset}
            area={params.area}
          />
        )}
      <Panel
        title="Available observations"
        subtitle="Sources are stored separately. Forecasts retain each collected run."
      >
        <form className="analytics-controls" action="/data">
          <label>
            Source
            <select name="source" defaultValue={params.source || ""}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dataset
            <select name="dataset" defaultValue={params.dataset || ""}>
              <option value="">All datasets</option>
              {[...new Set(coverage.map((r) => String(r.dataset)))].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Area
            <select name="area" defaultValue={params.area || ""}>
              <option value="">All areas</option>
              {[...new Set(coverage.map((r) => String(r.area)))]
                .sort()
                .map((a) => (
                  <option key={a}>{a}</option>
                ))}
            </select>
          </label>
          <button className="button" type="submit">
            Filter catalogue
          </button>
        </form>
        <div className="table-scroll">
          <table className="regional-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Dataset / metric</th>
                <th>Area</th>
                <th>Observations</th>
                <th>Available from</th>
                <th>Available until</th>
                <th>Last collected</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={i}>
                  <td>{r.source}</td>
                  <td>
                    <Link
                      href={
                        "/data?" +
                        new URLSearchParams({
                          source: r.source,
                          dataset: r.dataset,
                          area: r.area,
                        })
                      }
                    >
                      {r.dataset} · {r.metrics} metrics
                    </Link>
                  </td>
                  <td>{r.area}</td>
                  <td>{r.observations.toLocaleString()}</td>
                  <td>{fmt(r.available_from)}</td>
                  <td>{fmt(r.available_until)}</td>
                  <td>{fmt(r.last_collected_at)}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={7}>No observations match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>
            {groups.length} datasets · Page {page}
          </span>
          {page > 1 && (
            <Link className="button" href={pageUrl(page - 1)}>
              Previous page
            </Link>
          )}
          {page * 25 < groups.length && (
            <Link className="button" href={pageUrl(page + 1)}>
              Next page
            </Link>
          )}
        </div>
      </Panel>
      <Panel
        title="Attribution and terms"
        subtitle="Weather reference points describe local conditions; they are not national averages."
      >
        {sources.map((s) => (
          <p key={String(s.id)}>
            <a
              href={String(s.documentation_url)}
              target="_blank"
              rel="noreferrer"
            >
              {String(s.name)}
            </a>
            : {String(s.attribution)}. {String(s.licence)}. Upstream:{" "}
            {String(s.upstream)}.
          </p>
        ))}
      </Panel>
      {collectionIssues.length > 0 && (
        <Panel
          title="Collection gaps"
          subtitle="Empty windows mean the provider returned no observations. Failed windows remain eligible for retry."
        >
          <div className="table-scroll">
            <table className="regional-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Dataset</th>
                  <th>Area</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {collectionIssues.map((r, i) => (
                  <tr key={i}>
                    <td>{String(r.source)}</td>
                    <td>{String(r.dataset)}</td>
                    <td>{String(r.area)}</td>
                    <td>
                      {fmt(r.window_start)} – {fmt(r.window_end)}
                    </td>
                    <td>{String(r.status)}</td>
                    <td>{String(r.message || "No observations returned")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
