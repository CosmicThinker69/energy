export default function Loading() {
  return (
    <div className="loading-page" role="status" aria-label="Loading workspace">
      <div className="skeleton title-skeleton" />
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton kpi-skeleton" />
        ))}
      </div>
      <div className="skeleton chart-skeleton" />
    </div>
  );
}
