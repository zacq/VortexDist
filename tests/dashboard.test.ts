import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { addDays, nairobiToday } from "../shared/format";
import type { DashboardData } from "../shared/dashboard";

delete process.env.NETLIFY_DATABASE_URL;
delete process.env.DATABASE_URL;
delete process.env.NETLIFY_DB_URL;
process.env.PGLITE_DIR = mkdtempSync(join(tmpdir(), "vortex-dash-"));

const { handle } = await import("../server/app");
const { getDb } = await import("../server/db");
const { hashPin } = await import("../server/auth");
const { lineTax } = await import("../shared/tax");

async function call<T>(path: string, token?: string, body?: unknown): Promise<{ status: number; body: T }> {
  const response = await handle(new Request(`http://localhost/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
  return { status: response.status, body: (await response.json()) as T };
}

async function login(phone: string, pin: string): Promise<string> {
  return (await call<{ token: string }>("/auth/login", undefined, { phone, pin })).body.token;
}

test("dashboard figures reconcile with the underlying records", async () => {
  const db = await getDb();
  const today = nairobiToday();
  const old = addDays(today, -95);
  const sku = async (code: string) => (await db.query<{ id: number; size_ml: number }>("SELECT id, size_ml FROM skus WHERE code = $1", [code]))[0];

  await db.query("INSERT INTO users (name, phone, pin_hash, profiles, must_change_pin) VALUES ('Sales Clerk', '0700000003', $1, '{Sales}', false)", [hashPin("1111")]);

  const customer = async (name: string, pin: string, credit: boolean) =>
    (await db.query<{ id: number }>(
      "INSERT INTO customers (name, kra_pin, credit_allowed, credit_limit, terms_days) VALUES ($1, $2, $3, $4, 90) RETURNING id",
      [name, pin, credit, credit ? 1_000_000 : 0],
    ))[0].id;
  const kilima = await customer("Kilima Wines & Spirits", "P051234567A", true);
  const rift = await customer("Rift Valley Liquor Mart", "P053456789C", true);
  const upperHill = await customer("Upper Hill Bar & Grill", "P054567890D", false);

  let seq = 0;
  const invoice = async (customerId: number, date: string, dueDate: string, code: string, bottles: number, price: number, etims: string | null) => {
    const s = await sku(code);
    const tax = lineTax({ bottles, pricePerBottle: price, sizeMl: s.size_ml });
    const number = `VD-INV-2026-${String(++seq).padStart(5, "0")}`;
    const [{ id }] = await db.query<{ id: number }>(
      `INSERT INTO invoices (number, date, customer_id, status, due_date, etims_number, total_incl, vat, excise, posted_at)
       VALUES ($1, $2, $3, 'Posted', $4, $5, $6, $7, $8, now() + ($9 || ' seconds')::interval) RETURNING id`,
      [number, date, customerId, dueDate, etims, tax.total, tax.vat, tax.excise, seq],
    );
    const [{ id: lineId }] = await db.query<{ id: number }>(
      `INSERT INTO invoice_lines (invoice_id, sku_id, bottles, price_per_bottle, line_total, vat, excise, size_ml, abv, vat_rate, excise_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.4, 0.16, 10) RETURNING id`,
      [id, s.id, bottles, price, tax.total, tax.vat, tax.excise, s.size_ml],
    );
    await db.query("INSERT INTO ledger_entries (customer_id, date, doc_type, doc_id, doc_number, debit) VALUES ($1, $2, 'Invoice', $3, $4, $5)", [customerId, date, id, number, tax.total]);
    return { id, lineId, tax };
  };

  const riftInv = await invoice(rift, old, addDays(old, 90), "013", 240, 1000, "KRA-0039120");
  const cashInv = await invoice(upperHill, today, today, "011", 480, 200, "KRA-0044871");
  await invoice(kilima, today, addDays(today, 90), "022", 300, 220, null);

  const [{ id: paymentId }] = await db.query<{ id: number }>(
    "INSERT INTO payments (date, customer_id, amount, method, reference) VALUES ($1, $2, 96000, 'M-Pesa', 'SJ63KQ8P2L') RETURNING id",
    [today, upperHill],
  );
  await db.query("INSERT INTO allocations (payment_id, invoice_id, amount) VALUES ($1, $2, 96000)", [paymentId, cashInv.id]);
  await db.query("INSERT INTO ledger_entries (customer_id, date, doc_type, doc_id, doc_number, credit) VALUES ($1, $2, 'Payment', $3, 'SJ63KQ8P2L', 96000)", [upperHill, today, paymentId]);

  const [{ id: dispatchId }] = await db.query<{ id: number }>("INSERT INTO dispatches (invoice_id, date) VALUES ($1, $2) RETURNING id", [cashInv.id, today]);
  await db.query("INSERT INTO dispatch_lines (dispatch_id, invoice_line_id, bottles, excise) VALUES ($1, $2, 480, 19200)", [dispatchId, cashInv.lineId]);
  const [{ id: riftDispatch }] = await db.query<{ id: number }>("INSERT INTO dispatches (invoice_id, date) VALUES ($1, $2) RETURNING id", [riftInv.id, old]);
  await db.query("INSERT INTO dispatch_lines (dispatch_id, invoice_line_id, bottles, excise) VALUES ($1, $2, 240, 72000)", [riftDispatch, riftInv.lineId]);

  const [{ id: supplierId }] = await db.query<{ id: number }>("INSERT INTO suppliers (name) VALUES ('Carton Co') RETURNING id");
  await db.query("INSERT INTO purchases (date, supplier_id, total, input_vat) VALUES ($1, $2, 10000, 1379.31)", [today, supplierId]);

  const s011 = await sku("011");
  await db.query("INSERT INTO stock_adjustments (date, sku_id, bottles, reason) VALUES ($1, $2, 14400, 'Opening balance')", [addDays(today, -1), s011.id]);
  await db.query("INSERT INTO production_entries (date, sku_id, bottles, batch_number) VALUES ($1, $2, 2400, 'B-001')", [today, s011.id]);

  // Owner signs in (and sets a PIN), Sales is refused.
  const owner = await login("0700000001", "1234");
  await call("/auth/pin", owner, { currentPin: "1234", newPin: "2468" });
  const sales = await login("0700000003", "1111");
  assert.equal((await call("/dashboard", sales)).status, 403);

  const { status, body: d } = await call<DashboardData>("/dashboard?period=today", owner);
  assert.equal(status, 200);

  // Widget 1: Owed to KRA (today).
  assert.deepEqual(d.owedToKra, { outputVat: 22344.83, inputVat: 1379.31, vatPayable: 20965.52, excise: 19200, ethanolExcisePaid: 0, total: 40165.52 });
  assert.equal(d.nextPayments.length, 2);

  // Widget 2: today at a glance.
  assert.deepEqual(d.glance.sales, { total: 162000, invoices: 2, bottles: 780 });
  assert.equal(d.glance.cash.total, 96000);
  assert.equal(d.glance.cash.mpesa, 96000);
  assert.deepEqual(d.glance.produced, { boxes: 100, bottles: 0, skus: 1 });
  assert.deepEqual(d.glance.tax, { vat: 22344.83, excise: 43200 });

  // Widget 3: stock today, closing calculated.
  const row011 = d.stock.rows.find((r) => r.code === "011")!;
  assert.deepEqual([row011.opening, row011.produced, row011.sold, row011.closing], [14400, 2400, 480, 16320]);
  assert.equal(d.stock.dayStatus, "Open");

  // Widget 4: credit watch, sorted by risk.
  assert.equal(d.creditWatch.rows[0].name, "Rift Valley Liquor Mart");
  assert.equal(d.creditWatch.rows[0].status, "Blocked");
  assert.match(d.creditWatch.rows[0].reason!, /95 days old, past the 90-day terms/);
  assert.equal(d.creditWatch.rows[1].status, "OK");
  assert.equal(d.creditWatch.rows[1].pctUsed, 6.6);
  assert.equal(d.creditWatch.unpaidTotal, 306000);
  assert.equal(d.creditWatch.unpaidTax, 138206.9);

  // Widget 5: ageing.
  assert.deepEqual(d.ageing, { d0_30: 66000, d31_60: 0, d61_90: 0, over90: 240000 });

  // Widget 6: 7 days of sales ending today.
  assert.equal(d.sales.length, 7);
  assert.deepEqual(d.sales.at(-1), { date: today, total: 162000 });

  // Widget 7: alerts, red first, at most 5.
  assert.equal(d.alerts[0].tone, "red");
  assert.ok(d.alerts.length <= 5);
  const rank = { red: 0, amber: 1, grey: 2, green: 3 };
  assert.deepEqual(d.alerts.map((a) => rank[a.tone]), [...d.alerts.map((a) => rank[a.tone])].sort());
  assert.ok(d.alerts.some((a) => a.text.startsWith("Ethanol 96% low: 0 L left")));

  // Widget 8: recent invoices with statuses.
  assert.equal(d.recentInvoices.length, 3);
  const kilimaInv = d.recentInvoices.find((i) => i.customer === "Kilima Wines & Spirits")!;
  assert.deepEqual([kilimaInv.payment, kilimaInv.dispatch, kilimaInv.etims], ["Unpaid", "Not dispatched", false]);
  const cash = d.recentInvoices.find((i) => i.customer === "Upper Hill Bar & Grill")!;
  assert.deepEqual([cash.payment, cash.dispatch, cash.etims], ["Paid", "Dispatched", true]);
  assert.equal(d.recentInvoices.find((i) => i.customer === "Rift Valley Liquor Mart")!.payment, "Overdue");

  // Period switch: "This month" includes today; the 95-day-old invoice is not in it.
  const month = (await call<DashboardData>("/dashboard?period=month", owner)).body;
  assert.equal(month.glance.sales.total, 162000);
  assert.equal(month.sales.at(-1)!.date, today);
});
