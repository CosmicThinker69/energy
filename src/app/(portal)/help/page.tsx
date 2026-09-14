import Link from "next/link";
import { Badge, Icon, Panel } from "@/components/ui";
const faqs = [
  [
    "How do I explore a different subscription tier?",
    "Open Settings to compare plans, then contact sales to request a change. Plan updates made by TEMO apply to the next authenticated request.",
  ],
  [
    "Is this real electricity market data?",
    "All prices, generation figures, flows, market events, and research are simulated. Historical records are deterministic and include daily demand shapes, solar production curves, and occasional negative-price scenarios.",
  ],
  [
    "How does the live feed work?",
    "An authenticated server-sent event connection sends a snapshot every five seconds. The overview values and the newest point on today’s Bulgaria and Romania price charts update automatically. The connection status indicates when the stream is reconnecting.",
  ],
  [
    "How can I download data?",
    "Open a dashboard and select Export CSV to download the selected market and comparison data. In Data Explorer, Export dataset includes all records matching the text filter and the visible metric columns.",
  ],
  [
    "Why can I see a dashboard that is locked?",
    "The catalogue keeps all analytics visible so you can understand what each plan includes. Select a locked dashboard to view the required tier and contact sales.",
  ],
  [
    "What time zone do the charts use?",
    "All market interval timestamps and date filters use UTC. The header’s update clock uses your browser’s local time. Daily and monthly observations aggregate the underlying simulated hourly records.",
  ],
  [
    "Can I connect my existing Streamlit or Plotly dashboards?",
    "Administrators can add deployed Streamlit or external HTML dashboards from Dashboard admin. Enter the dashboard metadata, source URL, required plan, and enabled state; no Next.js route or card change is required.",
  ],
  [
    "How are accounts stored?",
    "Accounts, hashed passwords, and hashed session records persist in PostgreSQL. Remember me keeps the session cookie for 30 days. Without it, the cookie is scoped to the browser session and the server session expires after 24 hours.",
  ],
  [
    "How do I reset a password?",
    "Use Forgot password on the sign-in screen. Recovery links expire after 15 minutes, can only be used once, and invalidate existing sessions after a successful reset.",
  ],
];
export default function Help() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A little context goes a long way.</h1>
          <p>
            Everything you need to get comfortable in your energy workspace.
          </p>
        </div>
        <Badge tone="green">
          <Icon name="help" size={13} />
          Help & resources
        </Badge>
      </div>
      <div className="help-start">
        <Icon name="book" size={28} />
        <div>
          <h2>Start with the market overview.</h2>
          <p>
            Get the headline numbers, follow live updates, then open a dashboard
            to explore the details.
          </p>
        </div>
        <Link href="/" className="button primary">
          Open overview
          <Icon name="right" size={15} />
        </Link>
      </div>
      <Panel
        title="Your questions, answered"
        subtitle="A practical guide to the TEMO demonstration"
      >
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="plus" size={16} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </Panel>
      <div className="help-links">
        <Link href="/dashboards">
          <Icon name="chart" size={22} />
          <div>
            <strong>Find your next dashboard</strong>
            <p>Explore the complete analytics catalogue.</p>
          </div>
          <Icon name="right" />
        </Link>
        <Link href="/settings">
          <Icon name="settings" size={22} />
          <div>
            <strong>Make the workspace yours</strong>
            <p>Update your profile or explore a different plan.</p>
          </div>
          <Icon name="right" />
        </Link>
      </div>
    </>
  );
}
