"use client";
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Clock3,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  FileChartColumn,
  Globe2,
  History,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TriangleAlert,
  Wind,
  X,
  Zap,
  type LucideProps,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
const icons = {
  activity: Activity,
  arrows: ArrowLeftRight,
  right: ArrowRight,
  up: ArrowUpRight,
  down: ArrowDownRight,
  bell: Bell,
  book: BookOpen,
  chart: ChartNoAxesCombined,
  check: Check,
  checks: CheckCheck,
  chevron: ChevronDown,
  left: ChevronLeft,
  next: ChevronRight,
  help: CircleHelp,
  user: CircleUserRound,
  clock: Clock3,
  database: Database,
  download: Download,
  more: Ellipsis,
  external: ExternalLink,
  report: FileChartColumn,
  globe: Globe2,
  history: History,
  overview: LayoutDashboard,
  leaf: Leaf,
  lock: LockKeyhole,
  logout: LogOut,
  pin: MapPin,
  fullscreen: Maximize2,
  menu: Menu,
  pie: PieChart,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  settings: Settings2,
  shield: ShieldCheck,
  filter: SlidersHorizontal,
  sparkles: Sparkles,
  sun: Sun,
  warning: TriangleAlert,
  wind: Wind,
  close: X,
  zap: Zap,
};
export function Icon({ name, ...props }: LucideProps & { name: string }) {
  const Component = icons[name as keyof typeof icons] || ChartNoAxesCombined;
  return (
    <Component size={17} strokeWidth={1.7} aria-hidden="true" {...props} />
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M7 7h22l-4 7h-7L9 29l4-15H3z" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span>
          TEMO<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Badge({
  children,
  tone = "",
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}
export function Flag({ code }: { code: string }) {
  return (
    <span className={`flag flag-${code.toLowerCase()}`} aria-hidden="true" />
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el?.open) el?.showModal();
    else if (!open && el?.open) el?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} aria-label="Loading market data" />
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="search" size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
