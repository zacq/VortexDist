import { useState, type ReactNode } from "react";
import { formatCompactMoney, formatMoney } from "../../shared/format";
import { formatQty, toBoxes } from "../../shared/qty";
import type { InvoiceTotals } from "../../shared/tax";
import { Icon } from "./Icon";

// Component names follow the brief's "Shared components" table.

export function MoneyText({ value, short = false, className = "" }: { value: number; short?: boolean; className?: string }) {
  const [showFull, setShowFull] = useState(false);
  const full = formatMoney(value);
  if (short && !showFull) {
    return (
      <button type="button" title={`${full} · Tap to show full amount`} onClick={() => setShowFull(true)} className={`tap-target tabular-nums text-left ${className}`}>
        {formatCompactMoney(value)}
      </button>
    );
  }
  return <span title={full} className={`tabular-nums ${className}`}>{full}</span>;
}

export function QtyText({ bottles, perBox, showTotal = true, className = "" }: { bottles: number; perBox: number; showTotal?: boolean; className?: string }) {
  return (
    <span className={className}>
      <span className="font-medium tabular-nums">{formatQty(toBoxes(bottles, perBox))}</span>
      {showTotal && <span className="block text-xs font-normal text-stone-500">{bottles.toLocaleString("en-US")} bottles</span>}
    </span>
  );
}

export function SkuChip({ code, label, className = "" }: { code: string; label?: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span className="shrink-0 rounded-sm bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-stone-700">{code}</span>
      {label && <span className="truncate text-sm font-medium text-stone-900">{label}</span>}
    </span>
  );
}

export type StatusKind =
  | "Paid" | "Part paid" | "Unpaid" | "Overdue" | "Draft" | "Posted" | "Discarded" | "Not dispatched" | "Dispatched" | "Part dispatched"
  | "eTIMS" | "No eTIMS" | "Warning" | "Blocked" | "OK" | "Pending" | "Approved" | "Rejected" | "Cash only" | "Near limit";

const statusClasses: Record<StatusKind, string> = {
  Paid: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  "Part paid": "bg-amber-50 text-amber-800 ring-amber-700/15",
  Unpaid: "bg-stone-100 text-stone-700 ring-stone-500/15",
  Overdue: "bg-red-50 text-red-800 ring-red-700/15",
  Draft: "bg-stone-100 text-stone-600 ring-stone-500/15",
  Posted: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  Discarded: "bg-stone-100 text-stone-500 ring-stone-500/15",
  "Not dispatched": "bg-stone-100 text-stone-700 ring-stone-500/15",
  Dispatched: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  "Part dispatched": "bg-amber-50 text-amber-800 ring-amber-700/15",
  eTIMS: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  "No eTIMS": "bg-amber-50 text-amber-800 ring-amber-700/15",
  Warning: "bg-amber-50 text-amber-800 ring-amber-700/15",
  Blocked: "bg-red-50 text-red-800 ring-red-700/15",
  OK: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  Pending: "bg-amber-50 text-amber-800 ring-amber-700/15",
  Approved: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  Rejected: "bg-red-50 text-red-800 ring-red-700/15",
  "Cash only": "bg-stone-100 text-stone-700 ring-stone-500/15",
  "Near limit": "bg-amber-50 text-amber-800 ring-amber-700/15",
};

export function StatusPill({ status, className = "" }: { status: StatusKind; className?: string }) {
  const label = status === "eTIMS" ? "eTIMS ✓" : status === "No eTIMS" ? "No eTIMS number" : status;
  return <span className={`inline-flex min-h-6 items-center rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusClasses[status]} ${className}`}>{label}</span>;
}

export function TotalsPanel({ totals, showNet, children, compact = false }: { totals: InvoiceTotals; showNet: boolean; children?: ReactNode; compact?: boolean }) {
  return (
    <section aria-label="Invoice totals" className={`border border-stone-200 bg-[#fffefa] ${compact ? "rounded-t-xl px-4 pb-3 pt-3" : "rounded-md p-4"}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-stone-500">Total incl. VAT</p>
          <p className={`${compact ? "text-xl" : "text-2xl"} mt-0.5 font-semibold tracking-tight tabular-nums text-stone-950`}>{formatMoney(totals.totalIncl)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-stone-500">Total excl. VAT</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-stone-800">{formatMoney(totals.totalExVat)}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-stone-100 pt-2 text-xs">
        <span className="text-stone-500">VAT 16% <span className="ml-1 font-medium tabular-nums text-stone-800">{formatMoney(totals.vat)}</span></span>
        {showNet && <span className="text-stone-500">Net to Vortex <span className="ml-1 font-medium tabular-nums text-stone-800">{formatMoney(totals.netToVortex)}</span></span>}
      </div>
      <p className="mt-2 text-[11px] text-stone-500">Excise duty included: <span className="font-medium tabular-nums text-stone-700">{formatMoney(totals.excise)}</span></p>
      {children}
    </section>
  );
}

export function DayLockBadge({ status }: { status: "Open" | "Closed" | "Reopened" }) {
  const isClosed = status === "Closed";
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded px-2 text-xs font-medium ${isClosed ? "bg-stone-100 text-stone-700" : status === "Reopened" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
      {isClosed && <Icon name="lock" size={13} />}{status === "Open" ? "Day open" : status}
    </span>
  );
}

export function OfflineBanner({ waitingCount }: { waitingCount: number }) {
  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 md:px-6">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100"><Icon name="wifiOff" size={13} /></span>
      <div className="min-w-0 text-xs leading-5">
        <span className="font-semibold">Offline — changes saved on this phone</span>
        <span className="ml-1 text-amber-800">{waitingCount} {waitingCount === 1 ? "item" : "items"} waiting to sync.</span>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, supporting, tone = "default", onClick }: {
  label: string;
  value: ReactNode;
  supporting?: ReactNode;
  tone?: "default" | "good" | "warning" | "danger";
  onClick?: () => void;
}) {
  const toneClass = tone === "good" ? "text-emerald-800" : tone === "warning" ? "text-amber-800" : tone === "danger" ? "text-red-800" : "text-stone-950";
  const content = (
    <>
      <span className="block text-xs font-medium text-stone-500">{label}</span>
      <span className={`mt-1 block text-xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</span>
      {supporting && <span className="mt-1 block text-xs text-stone-500">{supporting}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-h-[92px] border-b border-stone-200 py-3 text-left hover:bg-stone-50">{content}</button>
  ) : (
    <div className="min-h-[92px] border-b border-stone-200 py-3">{content}</div>
  );
}

export function InlineMessage({ tone, children, action }: { tone: "warning" | "danger" | "success" | "info"; children: ReactNode; action?: ReactNode }) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    info: "border-stone-200 bg-stone-50 text-stone-700",
  };
  const iconTone = tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : tone === "success" ? "text-emerald-700" : "text-stone-500";
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs leading-5 ${styles[tone]}`}>
      <Icon name={tone === "success" ? "check" : tone === "info" ? "file" : "alert"} size={15} className={`mt-0.5 shrink-0 ${iconTone}`} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({ section, title, supporting, actions }: { section?: string; title: string; supporting?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        {section && (
          <div className="mb-1 hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 sm:flex">
            <span>{section}</span><span>/</span><span className="text-[#925515]">{title}</span>
          </div>
        )}
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.04em] text-stone-950 sm:text-[28px]">{title}</h1>
        {supporting && <p className="mt-1 text-xs leading-5 text-stone-500 sm:text-sm">{supporting}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-24 flex-col items-start justify-center gap-3 border-y border-dashed border-stone-300 py-5">
      <p className="text-sm font-medium text-stone-700">{message}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-block h-16 w-full" />)}
    </div>
  );
}

export const buttonClass = {
  primary: "tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#925515] px-4 text-sm font-semibold text-white hover:bg-[#79440f] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500",
  secondary: "tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50",
};

export const inputClass = "h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none placeholder:text-stone-400 focus:border-[#925515] focus:ring-2 focus:ring-[#925515]/15";
