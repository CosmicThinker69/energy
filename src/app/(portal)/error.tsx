"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>We couldn’t load this workspace.</h1>
      <p>Your account is safe. Try loading the market data again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
