"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { type Plan, type PublicUser, planName } from "@/lib/config";
import { type LiveSnapshot } from "@/lib/market";
import { Icon, Modal } from "./ui";
type FeedEntry = { time: string; text: string; id: number };
type PortalContext = {
  user: PublicUser;
  live: LiveSnapshot | null;
  status: "connecting" | "live" | "reconnecting";
  feed: FeedEntry[];
  updateUser: (u: PublicUser) => void;
  toast: (text: string) => void;
  requestUpgrade: (plan: Plan, title?: string) => void;
};
const Context = createContext<PortalContext | null>(null);
export function usePortal() {
  const context = useContext(Context);
  if (!context) throw new Error("Portal context is required");
  return context;
}
export function PortalProvider({
  initialUser,
  children,
}: {
  initialUser: PublicUser;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [status, setStatus] = useState<PortalContext["status"]>("connecting");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [message, setMessage] = useState("");
  const [upgrade, setUpgrade] = useState<{ plan: Plan; title: string } | null>(
    null,
  );
  useEffect(() => setUser(initialUser), [initialUser]);
  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onmessage = (event) => {
      const data: LiveSnapshot & { recent?: LiveSnapshot[] } = JSON.parse(
        event.data,
      );
      setLive(data);
      setStatus("live");
      const entry = (snapshot: LiveSnapshot): FeedEntry => ({
        time: snapshot.timestamp,
        id: snapshot.sequence,
        text: [
          `BG price updated to €${snapshot.price.toFixed(2)}`,
          `Solar generation updated to ${snapshot.solar.toLocaleString("en-GB")} MW`,
          `RO price updated to €${snapshot.roPrice.toFixed(2)}`,
          `Net exports updated to ${snapshot.flow} MW`,
        ][snapshot.sequence % 4],
      });
      setFeed((old) =>
        [entry(data), ...(old.length ? old : (data.recent || []).map(entry))]
          .filter(
            (item, index, items) =>
              items.findIndex((v) => v.id === item.id) === index,
          )
          .slice(0, 8),
      );
    };
    source.onerror = () => {
      setStatus("reconnecting");
      fetch("/api/auth/session")
        .then((response) => {
          if (response.status === 401) {
            source.close();
            router.replace("/login");
            router.refresh();
          }
        })
        .catch(() => {});
    };
    return () => source.close();
  }, [router]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    const sync = () => {
      fetch("/api/auth/session")
        .then(async (r) => {
          if (r.status === 401) {
            router.replace("/login");
            router.refresh();
            return;
          }
          const data = await r.json();
          if (data.user) setUser(data.user);
        })
        .catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisibility);
    const channel = new BroadcastChannel("temo-account");
    channel.onmessage = sync;
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      channel.close();
    };
  }, [router]);
  const updateUser = useCallback(
    (u: PublicUser) => {
      setUser(u);
      const channel = new BroadcastChannel("temo-account");
      channel.postMessage("changed");
      channel.close();
      router.refresh();
    },
    [router],
  );
  return (
    <Context.Provider
      value={{
        user,
        live,
        status,
        feed,
        updateUser,
        toast: setMessage,
        requestUpgrade: (plan, title = "This dashboard") => {
          setUpgrade({ plan, title });
        },
      }}
    >
      {children}
      <Modal
        open={!!upgrade}
        onClose={() => setUpgrade(null)}
        title="Access required"
      >
        <div className="upgrade-content">
          <span className="large-icon">
            <Icon name="lock" size={26} />
          </span>
          <h3>
            {upgrade?.title} requires{" "}
            {planName(upgrade?.plan || "professional")}
          </h3>
          <p>
            This dashboard requires {planName(upgrade?.plan || "professional")}{" "}
            access. Contact sales to discuss the right plan for your workspace.
          </p>
          <div className="upgrade-detail">
            <Icon name="check" />
            <span>Your current access stays unchanged.</span>
          </div>
          <button
            className="button primary full"
            onClick={() =>
              setMessage("Contact sales to request an access upgrade.")
            }
          >
            Contact sales
            <Icon name="right" />
          </button>
          <button
            className="button ghost full"
            onClick={() => setUpgrade(null)}
          >
            Keep exploring
          </button>
        </div>
      </Modal>
      {message && (
        <div className="toast" role="status">
          <Icon name="check" />
          {message}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
