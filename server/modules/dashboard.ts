import type { DashboardData, DashboardPeriod } from "../../shared/dashboard";
import { addDays, daysBetween, formatNumber, monthRange, nairobiHour, nairobiToday, shiftMonth } from "../../shared/format";
import { roundMoney } from "../../shared/tax";
import { HttpError, requireProfile, type Router } from "../http";
import { invoiceSummaries } from "../services/invoiceStatus";
import { customerCredit, openInvoices } from "../services/receivables";
import { dayState, stockForDate } from "../services/stock";
import { nextDuePayments, taxOwed } from "../services/taxOwed";
import type { Queryable } from "../db";

const STAMP_TOLERANCE = 0.005;
const CLOSE_NUDGE_HOUR = 18;

function periodRange(key: DashboardPeriod, today: string): { from: string; to: string } {
  if (key === "today") return { from: today, to: today };
  if (key === "month") return { from: monthRange(today.slice(0, 7)).from, to: today };
  return monthRange(shiftMonth(today.slice(0, 7), -1));
}

// Sales chart: last 7 days for "today", otherwise every day of the chosen month (up to today).
function chartRange(key: DashboardPeriod, today: string, period: { from: string; to: string }) {
  return key === "today" ? { from: addDays(today, -6), to: today } : period;
}

async function glance(q: Queryable, from: string, to: string): Promise<DashboardData["glance"]> {
  const [sales] = await q.query<{ invoices: number; total: number; vat: number; excise: number; bottles: number }>(
    `SELECT COUNT(*) AS invoices, COALESCE(SUM(total_incl), 0) AS total, COALESCE(SUM(vat), 0) AS vat, COALESCE(SUM(excise), 0) AS excise,
            COALESCE((SELECT SUM(il.bottles) FROM invoice_lines il JOIN invoices x ON x.id = il.invoice_id
                       WHERE x.status = 'Posted' AND x.date BETWEEN $1::date AND $2::date), 0) AS bottles
       FROM invoices WHERE status = 'Posted' AND date BETWEEN $1::date AND $2::date`,
    [from, to],
  );
  const payments = await q.query<{ method: string; total: number; count: number }>(
    "SELECT method, SUM(amount) AS total, COUNT(*) AS count FROM payments WHERE date BETWEEN $1::date AND $2::date GROUP BY method",
    [from, to],
  );
  const produced = await q.query<{ sku_id: number; bottles: number; bottles_per_box: number }>(
    `SELECT pe.sku_id, SUM(pe.bottles) AS bottles, s.bottles_per_box
       FROM production_entries pe JOIN skus s ON s.id = pe.sku_id
      WHERE pe.date BETWEEN $1::date AND $2::date GROUP BY pe.sku_id, s.bottles_per_box`,
    [from, to],
  );
  const byMethod = (method: string) => roundMoney(payments.find((p) => p.method === method)?.total ?? 0);
  return {
    sales: { total: roundMoney(sales.total), invoices: sales.invoices, bottles: sales.bottles },
    cash: {
      total: roundMoney(payments.reduce((sum, p) => sum + p.total, 0)),
      payments: payments.reduce((sum, p) => sum + p.count, 0),
      mpesa: byMethod("M-Pesa"),
      bank: byMethod("Bank"),
      cash: byMethod("Cash"),
    },
    produced: {
      boxes: produced.reduce((sum, row) => sum + Math.floor(row.bottles / row.bottles_per_box), 0),
      bottles: produced.reduce((sum, row) => sum + (row.bottles % row.bottles_per_box), 0),
      skus: produced.length,
    },
    tax: { vat: roundMoney(sales.vat), excise: roundMoney(sales.excise) },
  };
}

async function alerts(q: Queryable, today: string, credit: Awaited<ReturnType<typeof customerCredit>>, dayStatus: string, notDispatched: number): Promise<DashboardData["alerts"]> {
  const list: DashboardData["alerts"] = [];

  for (const customer of credit.filter((c) => c.status === "Blocked" && c.credit_allowed)) {
    list.push({ tone: "red", text: `${customer.name} blocked: ${customer.reason}`, link: `/customers/${customer.customer_id}` });
  }

  const [stamps] = await q.query<{ applied: number; produced: number }>(
    `SELECT (SELECT COALESCE(SUM(quantity), 0) FROM stamp_register WHERE type = 'Applied' AND date BETWEEN $1::date AND $2::date) AS applied,
            (SELECT COALESCE(SUM(bottles), 0) FROM production_entries WHERE date BETWEEN $1::date AND $2::date) AS produced`,
    [monthRange(today.slice(0, 7)).from, today],
  );
  if (stamps.produced > 0 || stamps.applied > 0) {
    const diff = stamps.produced > 0 ? Math.abs(stamps.applied - stamps.produced) / stamps.produced : 1;
    const pct = `${(diff * 100).toFixed(1)}%`;
    list.push(diff > STAMP_TOLERANCE
      ? { tone: "red", text: `Stamps don't reconcile: ${formatNumber(stamps.applied)} applied vs ${formatNumber(stamps.produced)} bottles produced (difference ${pct}, limit 0.5%)`, link: "/stamps" }
      : { tone: "green", text: `Stamps reconcile: difference ${pct} (limit 0.5%)`, link: "/stamps" });
  }

  if (dayStatus !== "Closed" && nairobiHour() >= CLOSE_NUDGE_HOUR) {
    list.push({ tone: "amber", text: "Close today's stock", link: "/stock" });
  }

  const low = await q.query<{ name: string; unit: string; on_hand: number; reorder_level: number }>(
    `SELECT rm.name, rm.unit, rm.reorder_level, COALESCE(SUM(mm.quantity), 0) AS on_hand
       FROM raw_materials rm LEFT JOIN material_movements mm ON mm.raw_material_id = rm.id
      WHERE NOT rm.hidden GROUP BY rm.id HAVING COALESCE(SUM(mm.quantity), 0) < rm.reorder_level
      ORDER BY COALESCE(SUM(mm.quantity), 0) / NULLIF(rm.reorder_level, 0), rm.code`,
  );
  for (const item of low.slice(0, 2)) {
    list.push({ tone: "amber", text: `${item.name} low: ${formatNumber(item.on_hand)} ${item.unit} left (reorder at ${formatNumber(item.reorder_level)} ${item.unit})`, link: "/materials" });
  }
  if (low.length > 2) list.push({ tone: "amber", text: `${low.length - 2} more raw materials below reorder level`, link: "/materials" });

  const [pending] = await q.query<{ credit_notes: number; overrides: number }>(
    `SELECT (SELECT COUNT(*) FROM credit_notes WHERE status = 'Pending') AS credit_notes,
            (SELECT COUNT(*) FROM invoices WHERE status = 'Draft' AND override_requested) AS overrides`,
  );
  if (pending.credit_notes > 0) list.push({ tone: "amber", text: `${pending.credit_notes} credit ${pending.credit_notes === 1 ? "note" : "notes"} waiting for Owner approval`, link: "/invoices" });
  if (pending.overrides > 0) list.push({ tone: "amber", text: `${pending.overrides} draft ${pending.overrides === 1 ? "invoice needs" : "invoices need"} an Owner override`, link: "/invoices" });

  if (notDispatched > 0) list.push({ tone: "grey", text: `${notDispatched} ${notDispatched === 1 ? "invoice" : "invoices"} waiting for goods-out confirmation`, link: "/dispatch" });

  const order = { red: 0, amber: 1, grey: 2, green: 3 };
  return list.sort((a, b) => order[a.tone] - order[b.tone]);
}

export function registerDashboard(router: Router) {
  router.get("/dashboard", async (ctx): Promise<DashboardData> => {
    requireProfile(ctx, "Owner", "Accountant");
    const key = (ctx.url.searchParams.get("period") ?? "today") as DashboardPeriod;
    if (!["today", "month", "lastMonth"].includes(key)) throw new HttpError(400, "Period must be today, month or lastMonth.");

    const db = ctx.db;
    const today = nairobiToday();
    const period = periodRange(key, today);
    const chart = chartRange(key, today, period);

    const [owed, dues, glanceData, stockRows, status, credit, open, salesByDay, allPosted] = await Promise.all([
      taxOwed(db, period.from, period.to),
      nextDuePayments(db, today),
      glance(db, period.from, period.to),
      stockForDate(db, today),
      dayState(db, today),
      customerCredit(db, today),
      openInvoices(db),
      db.query<{ date: string; total: number }>(
        "SELECT date, SUM(total_incl) AS total FROM invoices WHERE status = 'Posted' AND date BETWEEN $1::date AND $2::date GROUP BY date",
        [chart.from, chart.to],
      ),
      invoiceSummaries(db, "TRUE", [], 5000, today),
    ]);

    const notDispatched = allPosted.filter((inv) => inv.dispatch !== "Dispatched").length;

    const ageing = { d0_30: 0, d31_60: 0, d61_90: 0, over90: 0 };
    let unpaidTax = 0;
    for (const inv of open) {
      const age = daysBetween(inv.date, today);
      if (age <= 30) ageing.d0_30 += inv.outstanding;
      else if (age <= 60) ageing.d31_60 += inv.outstanding;
      else if (age <= 90) ageing.d61_90 += inv.outstanding;
      else ageing.over90 += inv.outstanding;
      // Share of the unpaid amount that is VAT + excise already owed to KRA.
      if (inv.total_incl > 0) unpaidTax += inv.outstanding * ((inv.vat + inv.excise) / inv.total_incl);
    }

    const salesMap = new Map(salesByDay.map((row) => [row.date, row.total]));
    const sales: DashboardData["sales"] = [];
    for (let date = chart.from; date <= chart.to; date = addDays(date, 1)) {
      sales.push({ date, total: roundMoney(salesMap.get(date) ?? 0) });
    }

    const visibleStock = stockRows.filter((row) => row.opening !== 0 || row.produced !== 0 || row.sold !== 0 || row.adjustments !== 0 || row.closing !== 0);
    const riskOrder = { Blocked: 0, "Near limit": 1, OK: 2, "Cash only": 3 };

    return {
      today,
      period: { key, ...period },
      owedToKra: {
        outputVat: owed.outputVat,
        inputVat: owed.inputVat,
        vatPayable: owed.vatPayable,
        excise: owed.excise,
        ethanolExcisePaid: owed.ethanolExcisePaid,
        total: owed.total,
      },
      nextPayments: dues.map((due) => ({ ...due, daysLeft: daysBetween(today, due.due) })),
      glance: glanceData,
      stock: {
        dayStatus: status,
        closeNudge: status !== "Closed" && nairobiHour() >= CLOSE_NUDGE_HOUR,
        rows: visibleStock.map((row) => ({
          sku_id: row.sku_id,
          code: row.code,
          label: `${row.product} ${row.size_ml}ml`,
          perBox: row.bottles_per_box,
          opening: row.opening,
          produced: row.produced,
          sold: row.sold,
          adjustments: row.adjustments,
          closing: row.closing,
        })),
        hiddenEmpty: stockRows.filter((row) => row.active).length - visibleStock.filter((row) => row.active).length,
      },
      creditWatch: {
        rows: credit
          .filter((c) => c.credit_allowed)
          .sort((a, b) => riskOrder[a.status] - riskOrder[b.status] || b.pct_used - a.pct_used)
          .map((c) => ({ customer_id: c.customer_id, name: c.name, balance: c.balance, limit: c.credit_limit, pctUsed: c.pct_used, status: c.status, reason: c.reason })),
        unpaidTotal: roundMoney(open.reduce((sum, inv) => sum + inv.outstanding, 0)),
        unpaidTax: roundMoney(unpaidTax),
      },
      ageing: {
        d0_30: roundMoney(ageing.d0_30),
        d31_60: roundMoney(ageing.d31_60),
        d61_90: roundMoney(ageing.d61_90),
        over90: roundMoney(ageing.over90),
      },
      sales,
      alerts: (await alerts(db, today, credit, status, notDispatched)).slice(0, 5),
      recentInvoices: allPosted.slice(0, 5).map((inv) => ({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        customer: inv.customer,
        total: inv.total_incl,
        payment: inv.payment,
        dispatch: inv.dispatch,
        etims: Boolean(inv.etims_number),
      })),
    };
  });
}

