import { useState, type ReactNode } from "react";
import type { DashboardData, DashboardPeriod } from "../../../shared/dashboard";
import { formatCompactMoney, formatKenyanDate, formatMoney, formatMonth, formatNumber, formatShortDate, formatTime } from "../../../shared/format";
import { formatBottlesAsQty } from "../../../shared/qty";
import { DayLockBadge, InlineMessage, MoneyText, PageHeader, SkuChip, StatusPill, buttonClass } from "../../components/common";
import { Icon } from "../../components/Icon";
import { useDashboard } from "../../hooks/useDashboard";
import { Link, navigate } from "../../router";

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

// Ageing ramp validated (dataviz validator): ordinal grey for 0–90 days, red only for over 90.
const AGEING = [
  { key: "d0_30", label: "0–30 days", color: "#a8a29e" },
  { key: "d31_60", label: "31–60 days", color: "#78716c" },
  { key: "d61_90", label: "61–90 days", color: "#44403c" },
  { key: "over90", label: "Over 90 days", color: "#dc2626" },
] as const;

function monthName(month: string): string {
  return formatMonth(month).split(" ")[0];
}

function periodCaption(data: DashboardData): string {
  const { key, from, to } = data.period;
  if (key === "today") return `Today · ${formatKenyanDate(to)}`;
  if (key === "month") return `${monthName(from.slice(0, 7))} to date (${formatShortDate(from)}–${formatShortDate(to)})`;
  return formatMonth(from.slice(0, 7));
}

function periodWord(key: DashboardPeriod): string {
  return key === "today" ? "today" : key === "month" ? "this month" : "last month";
}

function Card({ title, caption, action, className = "", children }: { title: string; caption?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-md border border-stone-200 bg-[#fffefa] ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {caption && <p className="mt-0.5 text-xs text-stone-500">{caption}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function CardLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="tap-target -my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[#7b460f] hover:underline">
      {label}<Icon name="chevron" size={13} className="-rotate-90" />
    </Link>
  );
}

function OwedToKra({ data }: { data: DashboardData }) {
  const o = data.owedToKra;
  const row = (label: string, value: number, strong = false, negative = false) => (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "font-semibold text-stone-950" : "text-stone-700"}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{negative && value !== 0 ? `− ${formatMoney(value)}` : formatMoney(value)}</span>
    </div>
  );
  return (
    <section className="col-span-12 min-w-0 rounded-md border border-stone-300 bg-[#fffefa] lg:col-span-7">
      <button type="button" onClick={() => navigate("/tax")} className="block w-full text-left">
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#925515]">Owed to KRA</h2>
            <p className="mt-1 text-xs text-stone-500">{periodCaption(data)}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7b460f]">Tax summary<Icon name="chevron" size={13} className="-rotate-90" /></span>
        </header>
        <p className="px-4 pt-3 text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-stone-950">{formatMoney(o.total)}</p>
        <div className="mt-3 divide-y divide-stone-100 border-t border-stone-200 px-4 pb-2 pt-1">
          {row("VAT on sales", o.outputVat)}
          {row("Less VAT on purchases", o.inputVat, false, true)}
          {row("VAT payable", o.vatPayable, true)}
          {row("Excise on goods dispatched", o.excise)}
          {row("Total owed to KRA", o.total, true)}
        </div>
        {o.ethanolExcisePaid > 0 && (
          <p className="px-4 pb-2 text-[11px] text-stone-500">Ethanol excise already paid to suppliers: {formatMoney(o.ethanolExcisePaid)} · offset to confirm with tax adviser</p>
        )}
      </button>
      <div className="border-t border-stone-200">
        {data.nextPayments.map((due, index) => {
          const tone = due.daysLeft <= 2 ? "red" : due.daysLeft <= 7 ? "amber" : "plain";
          const days = due.daysLeft < 0 ? `${-due.daysLeft} days overdue` : due.daysLeft === 0 ? "due today" : `${due.daysLeft} ${due.daysLeft === 1 ? "day" : "days"}`;
          const styles = tone === "red" ? "bg-red-50 text-red-900" : tone === "amber" ? "bg-amber-50 text-amber-950" : "bg-stone-50 text-stone-700";
          return (
            <div key={due.kind} className={`flex items-start gap-2 px-4 py-2.5 text-xs leading-5 ${styles} ${index > 0 ? "border-t border-stone-200" : ""} ${index === data.nextPayments.length - 1 ? "rounded-b-md" : ""}`}>
              <Icon name={tone === "plain" ? "calendar" : "alert"} size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">{monthName(due.month)} {due.kind === "VAT" ? "VAT" : "excise"}</span>
                {" · "}<span className="tabular-nums">{formatMoney(due.amount)}</span>
                {" · due "}{formatKenyanDate(due.due)}{" · "}<span className="font-semibold">{days}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Glance({ data }: { data: DashboardData }) {
  const g = data.glance;
  const word = periodWord(data.period.key);
  const methods = [
    g.cash.mpesa > 0 && `M-Pesa ${formatCompactMoney(g.cash.mpesa)}`,
    g.cash.bank > 0 && `bank ${formatCompactMoney(g.cash.bank)}`,
    g.cash.cash > 0 && `cash ${formatCompactMoney(g.cash.cash)}`,
  ].filter(Boolean).join(", ");
  const tile = (label: string, value: ReactNode, small: ReactNode, to?: string) => {
    const body = (
      <>
        <span className="block text-xs font-medium text-stone-500">{label}</span>
        <span className="mt-1 block text-lg font-semibold tracking-tight tabular-nums text-stone-950">{value}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-stone-500">{small}</span>
      </>
    );
    return to
      ? <Link to={to} className="block min-h-[96px] rounded-md border border-stone-200 bg-[#fffefa] p-3 hover:border-stone-300">{body}</Link>
      : <div className="min-h-[96px] rounded-md border border-stone-200 bg-[#fffefa] p-3">{body}</div>;
  };
  return (
    <section aria-label={`At a glance ${word}`} className="col-span-12 grid grid-cols-2 gap-2.5 lg:col-span-5">
      {tile(`Sales ${word}`, <MoneyText value={g.sales.total} short />, `${g.sales.invoices} ${g.sales.invoices === 1 ? "invoice" : "invoices"} · ${formatNumber(g.sales.bottles)} bottles`, "/invoices")}
      {tile("Cash collected", <MoneyText value={g.cash.total} short />, g.cash.payments === 0 ? "No payments" : `${g.cash.payments} ${g.cash.payments === 1 ? "payment" : "payments"}${methods ? ` (${methods})` : ""}`, "/payments")}
      {tile(`Produced ${word}`, g.produced.bottles > 0 ? `${formatNumber(g.produced.boxes)} bx + ${g.produced.bottles} btl` : `${formatNumber(g.produced.boxes)} boxes`, `${g.produced.skus} ${g.produced.skus === 1 ? "SKU" : "SKUs"}`, "/production")}
      {tile("Tax in sales", <MoneyText value={g.tax.vat + g.tax.excise} short />, `VAT ${formatAmountShort(g.tax.vat)} + excise ${formatAmountShort(g.tax.excise)}`)}
    </section>
  );
}

function formatAmountShort(value: number): string {
  return formatMoney(value).replace("KSh ", "");
}

function StockToday({ data }: { data: DashboardData }) {
  const s = data.stock;
  return (
    <Card
      title="Stock today"
      caption={formatKenyanDate(data.today)}
      className="col-span-12 lg:col-span-7"
      action={<DayLockBadge status={s.dayStatus} />}
    >
      {s.closeNudge && (
        <div className="mb-3">
          <InlineMessage tone="warning" action={<Link to="/stock" className="font-semibold underline">Open register</Link>}>
            <span className="font-semibold">Close today's stock</span> — the day is still open after 18:00.
          </InlineMessage>
        </div>
      )}
      {s.rows.length === 0 ? (
        <div className="py-3">
          <p className="text-sm text-stone-700">No stock recorded yet.</p>
          <p className="mt-1 text-xs text-stone-500">Opening stock and production appear here once Store records them.</p>
        </div>
      ) : (
        <>
          <table className="hidden w-full text-left text-xs sm:table">
            <thead>
              <tr className="border-b border-stone-200 text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                <th className="py-1.5 pr-2">Product</th>
                <th className="py-1.5 pr-2 text-right">Opening</th>
                <th className="py-1.5 pr-2 text-right">Made</th>
                <th className="py-1.5 pr-2 text-right">Sold</th>
                <th className="py-1.5 text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row) => (
                <tr key={row.sku_id} onClick={() => navigate("/stock")} className="cursor-pointer border-b border-stone-100 hover:bg-stone-50">
                  <td className="py-2 pr-2"><SkuChip code={row.code} label={row.label} /></td>
                  <td className="py-2 pr-2 text-right tabular-nums text-stone-600">{formatBottlesAsQty(row.opening, row.perBox)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-stone-600">{formatBottlesAsQty(row.produced, row.perBox)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-stone-600">{formatBottlesAsQty(row.sold, row.perBox)}</td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${row.closing < 0 ? "text-red-700" : "text-stone-950"}`}>{formatBottlesAsQty(row.closing, row.perBox)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-stone-100 sm:hidden">
            {s.rows.map((row) => (
              <li key={row.sku_id}>
                <Link to="/stock" className="block py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <SkuChip code={row.code} label={row.label} />
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${row.closing < 0 ? "text-red-700" : "text-stone-950"}`}>{formatBottlesAsQty(row.closing, row.perBox)}</span>
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-stone-500">
                    Opening {formatBottlesAsQty(row.opening, row.perBox)} · Made {formatBottlesAsQty(row.produced, row.perBox)} · Sold {formatBottlesAsQty(row.sold, row.perBox)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {s.hiddenEmpty > 0 && <p className="mt-2 text-[11px] text-stone-500">{s.hiddenEmpty} other SKUs have no stock.</p>}
        </>
      )}
    </Card>
  );
}

function CreditWatch({ data }: { data: DashboardData }) {
  const c = data.creditWatch;
  return (
    <Card title="Credit watch" caption="Customers on credit, by risk" className="col-span-12 lg:col-span-5" action={<CardLink to="/customers" label="Customers" />}>
      {c.rows.length === 0 ? (
        <p className="py-3 text-sm text-stone-700">No customers on credit yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {c.rows.map((row) => {
            const pct = Math.min(100, Math.max(0, row.pctUsed));
            const bar = row.status === "Blocked" ? "bg-red-700" : row.status === "Near limit" ? "bg-amber-600" : "bg-emerald-700";
            const pill = row.status === "Blocked" ? "Blocked" : row.status === "Near limit" ? "Warning" : "OK";
            return (
              <li key={row.customer_id}>
                <Link to={`/customers/${row.customer_id}`} className="block py-2.5 hover:bg-stone-50">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-stone-900">{row.name}</span>
                    <MoneyText value={row.balance} className="shrink-0 text-sm font-semibold text-stone-900" />
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.name}: credit limit used`}>
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px]">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <StatusPill status={pill} className="shrink-0" />
                      {row.reason && <span className="pt-0.5 text-stone-600">{row.reason}</span>}
                    </span>
                    <span className="shrink-0 pt-0.5 tabular-nums text-stone-500">{row.pctUsed.toFixed(0)}% of {formatCompactMoney(row.limit)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 border-t border-stone-200 pt-2.5 text-xs leading-5 text-stone-600">
        Unpaid <span className="font-semibold tabular-nums text-stone-900">{formatMoney(c.unpaidTotal)}</span>
        {c.unpaidTotal > 0 && <> · includes about <span className="font-semibold tabular-nums text-stone-900">{formatMoney(c.unpaidTax)}</span> VAT and excise already owed to KRA</>}
      </p>
    </Card>
  );
}

function Ageing({ data }: { data: DashboardData }) {
  const total = AGEING.reduce((sum, a) => sum + data.ageing[a.key], 0);
  return (
    <Card title="Unpaid invoices by age" caption={total > 0 ? `${formatMoney(total)} unpaid` : undefined} className="col-span-12 lg:col-span-5">
      {total === 0 ? (
        <p className="py-3 text-sm text-stone-700">No unpaid invoices.</p>
      ) : (
        <>
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={AGEING.map((a) => `${a.label} ${formatMoney(data.ageing[a.key])}`).join(", ")}>
            {AGEING.filter((a) => data.ageing[a.key] > 0).map((a) => (
              <div key={a.key} title={`${a.label}: ${formatMoney(data.ageing[a.key])}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(data.ageing[a.key] / total) * 100}%`, background: a.color, minWidth: 4 }} />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {AGEING.map((a) => (
              <div key={a.key} className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
                <div className="min-w-0">
                  <dt className={`text-[11px] ${a.key === "over90" && data.ageing.over90 > 0 ? "font-semibold text-red-800" : "text-stone-500"}`}>{a.label}</dt>
                  <dd className={`text-sm font-semibold tabular-nums ${a.key === "over90" && data.ageing.over90 > 0 ? "text-red-800" : "text-stone-900"}`}>{formatMoney(data.ageing[a.key])}</dd>
                </div>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}

function SalesChart({ data }: { data: DashboardData }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.sales.map((d) => d.total), 1);
  const total = data.sales.reduce((sum, d) => sum + d.total, 0);
  const sevenDay = data.period.key === "today";
  const title = sevenDay ? "Sales, last 7 days" : `Sales, ${formatMonth(data.period.from.slice(0, 7))}`;
  const shown = hover !== null ? data.sales[hover] : null;
  return (
    <Card title={title} caption={shown ? `${formatKenyanDate(shown.date)} · ${formatMoney(shown.total)}` : `KSh incl. VAT · total ${formatMoney(total)}`} className="col-span-12 lg:col-span-7">
      <div className="flex h-[150px] items-end gap-[2px] border-b border-stone-300" onMouseLeave={() => setHover(null)}>
        {data.sales.map((day, index) => {
          const isToday = day.date === data.today;
          // Bars top out at 85% so the value label above the tallest bar stays inside the plot.
          const height = day.total > 0 ? Math.max(3, (day.total / max) * 85) : 0;
          return (
            <button
              type="button"
              key={day.date}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(index)}
              aria-label={`${formatKenyanDate(day.date)}: ${formatMoney(day.total)}`}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end px-[1px] focus-visible:outline-none"
            >
              {sevenDay && day.total > 0 && (
                <span className="pointer-events-none mb-0.5 block truncate text-center text-[9px] leading-3 tabular-nums text-stone-500">
                  {formatCompactMoney(day.total).replace("KSh ", "")}
                </span>
              )}
              <span
                className={`block w-full rounded-t-[4px] ${isToday ? "bg-[#925515]" : hover === index ? "bg-stone-500" : "bg-stone-300"} group-focus-visible:ring-2 group-focus-visible:ring-[#925515]/40`}
                style={{ height: `${height}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.sales.map((day, index) => {
          const label = sevenDay ? formatKenyanDate(day.date).split(" ").slice(0, 2).join(" ") : day.date.slice(8, 10).replace(/^0/, "");
          const showLabel = sevenDay || index === 0 || index === data.sales.length - 1 || Number(day.date.slice(8, 10)) % 5 === 0;
          return (
            <span key={day.date} className={`min-w-0 flex-1 truncate text-center text-[9px] leading-3 ${day.date === data.today ? "font-semibold text-[#7b460f]" : "text-stone-500"}`}>
              {showLabel ? label : ""}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function Alerts({ data }: { data: DashboardData }) {
  const dot = { red: "bg-red-600", amber: "bg-amber-500", grey: "bg-stone-400", green: "bg-emerald-600" };
  const word = { red: "Urgent", amber: "Warning", grey: "Note", green: "OK" };
  return (
    <Card title="Alerts" className="col-span-12 lg:col-span-5">
      {data.alerts.length === 0 ? (
        <p className="py-3 text-sm text-stone-700">Nothing needs attention.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {data.alerts.map((alert, index) => {
            const body = (
              <span className="flex items-start gap-2.5 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[alert.tone]}`} aria-hidden="true" />
                <span className="sr-only">{word[alert.tone]}: </span>
                <span className="text-sm leading-5 text-stone-800">{alert.text}</span>
              </span>
            );
            return <li key={index}>{alert.link ? <Link to={alert.link} className="block hover:bg-stone-50">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentInvoices({ data }: { data: DashboardData }) {
  return (
    <Card title="Recent invoices" className="col-span-12 lg:col-span-7" action={<CardLink to="/invoices" label="All invoices" />}>
      {data.recentInvoices.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-3">
          <p className="text-sm text-stone-700">No invoices yet.</p>
          <Link to="/invoices/new" className={buttonClass.primary}><Icon name="plus" size={16} />New invoice</Link>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {data.recentInvoices.map((inv) => (
            <li key={inv.id}>
              <Link to={`/invoices/${inv.id}`} className="block py-2.5 hover:bg-stone-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold text-stone-600">{inv.number}</p>
                    <p className="truncate text-sm font-medium text-stone-900">{inv.customer}</p>
                  </div>
                  <MoneyText value={inv.total} className="shrink-0 text-sm font-semibold text-stone-900" />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusPill status={inv.payment} />
                  <StatusPill status={inv.dispatch} />
                  <StatusPill status={inv.etims ? "eTIMS" : "No eTIMS"} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" className="grid grid-cols-12 gap-4">
      <div className="skeleton-block col-span-12 h-[300px] lg:col-span-7" />
      <div className="col-span-12 grid grid-cols-2 gap-2.5 lg:col-span-5">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-block h-[96px]" />)}
      </div>
      <div className="skeleton-block col-span-12 h-[240px] lg:col-span-7" />
      <div className="skeleton-block col-span-12 h-[240px] lg:col-span-5" />
    </div>
  );
}

export function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const { data, error, loading, savedAt, reload } = useDashboard(period);

  return (
    <div className="screen-enter mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <PageHeader
        title="Dashboard"
        supporting="What we owe KRA, what happened, and who owes us."
        actions={
          <div role="tablist" aria-label="Period" className="hidden rounded-md border border-stone-300 bg-white p-0.5 sm:flex">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)} className={`tap-target min-h-10 rounded px-3 text-xs font-semibold ${period === p.key ? "bg-[#f3e8d7] text-[#73400e]" : "text-stone-600 hover:bg-stone-50"}`}>{p.label}</button>
            ))}
          </div>
        }
      />
      <div role="tablist" aria-label="Period" className="-mt-2 mb-4 grid grid-cols-3 rounded-md border border-stone-300 bg-white p-0.5 sm:hidden">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)} className={`tap-target min-h-10 rounded px-2 text-xs font-semibold ${period === p.key ? "bg-[#f3e8d7] text-[#73400e]" : "text-stone-600"}`}>{p.label}</button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <InlineMessage tone="warning" action={<button type="button" onClick={reload} className="tap-target -my-1 min-h-9 shrink-0 rounded px-2 font-semibold underline">Retry</button>}>
            {savedAt ? <>Showing figures saved on this phone at {formatTime(savedAt)}. {error}</> : error}
          </InlineMessage>
        </div>
      )}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <div className={`grid grid-cols-12 gap-4 ${loading ? "opacity-60 transition-opacity" : ""}`}>
          <OwedToKra data={data} />
          <Glance data={data} />
          <StockToday data={data} />
          <CreditWatch data={data} />
          <Ageing data={data} />
          <SalesChart data={data} />
          <Alerts data={data} />
          <RecentInvoices data={data} />
        </div>
      ) : null}
    </div>
  );
}
