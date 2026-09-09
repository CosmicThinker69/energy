import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-empty" id="main-content">
      <span className="muted">404</span>
      <h1>This page is off the grid.</h1>
      <p>Return to your workspace to explore European energy markets.</p>
      <Link className="button primary" href="/">
        Go to overview
      </Link>
    </main>
  );
}
