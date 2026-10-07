// Loads the front-end brief's mock data into a LOCAL database for demos and screenshots: the one
// `netlify dev` runs (while it is running), otherwise the PGlite store in .data/.
// Refuses any non-local database. Usage: npm run seed:demo
import { existsSync, readFileSync } from "node:fs";
import { addDays, nairobiToday } from "../shared/format";
import { lineTax } from "../shared/tax";

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
const configured = [process.env.NETLIFY_DB_URL, process.env.NETLIFY_DATABASE_URL, process.env.DATABASE_URL].find(Boolean);
if (configured && !isLocal(configured)) {
  console.error("Refusing to seed demo data into a non-local database.");
  process.exit(1);
}
if (!configured && existsSync(".netlify/state.json")) {
  const local = (JSON.parse(readFileSync(".netlify/state.json", "utf8")) as { dbConnectionString?: string }).dbConnectionString;
  if (local && isLocal(local)) process.env.DATABASE_URL = local;
}

const { getDb } = await import("../server/db");
const { hashPin } = await import("../server/auth");
const db = await getDb();

const [{ count }] = await db.query<{ count: number }>("SELECT COUNT(*) AS count FROM invoices");
if (count > 0) {
  console.error("This database already has invoices; demo data was not loaded.");
  process.exit(1);
}

const today = nairobiToday();
const monthStart = `${today.slice(0, 7)}-01`;
const inMonth = (days: number) => (addDays(today, -days) >= monthStart ? addDays(today, -days) : today);

const skus = new Map((await db.query<{ code: string; id: number; size_ml: number }>("SELECT code, id, size_ml FROM skus")).map((s) => [s.code, s]));
const price = { 100: 200, 200: 220, 750: 1000 } as Record<number, number>;

for (const [name, phone, profile] of [
  ["Grace Wanjiru", "0700000002", "Accountant"],
  ["Brian Otieno", "0700000003", "Sales"],
  ["Peter Kiprop", "0700000004", "Store"],
  ["Faith Achieng", "0700000005", "Dispatch"],
]) {
  await db.query("INSERT INTO users (name, phone, pin_hash, profiles, must_change_pin) VALUES ($1, $2, $3, $4, false) ON CONFLICT (phone) DO NOTHING", [name, phone, hashPin("1234"), [profile]]);
}

const customers: Record<string, number> = {};
for (const [name, pin, phone, address, credit] of [
  ["Kilima Wines & Spirits", "P051234567A", "0712 345 678", "Thika Road, Nairobi", true],
  ["Mombasa Road Distributors", "P052345678B", "0722 456 789", "Mombasa Road, Nairobi", true],
  ["Rift Valley Liquor Mart", "P053456789C", "0733 567 890", "Kenyatta Avenue, Nakuru", true],
  ["Upper Hill Bar & Grill", "P054567890D", "0744 678 901", "Upper Hill, Nairobi", false],
  ["Lakeside Wholesalers", "P055678901E", "0755 789 012", "Oginga Odinga Street, Kisumu", false],
] as const) {
  customers[name] = (await db.query<{ id: number }>(
    "INSERT INTO customers (name, kra_pin, phone, address, credit_allowed, credit_limit, terms_days) VALUES ($1, $2, $3, $4, $5, $6, 90) RETURNING id",
    [name, pin, phone, address, credit, credit ? 1_000_000 : 0],
  ))[0].id;
}

// Opening stock 40 days ago, generous enough for all the history below.
const opening: Record<string, number> = { "011": 16000, "012": 1440, "013": 2200, "021": 720, "022": 3500, "041": 2200 };
for (const [code, bottles] of Object.entries(opening)) {
  await db.query("INSERT INTO stock_adjustments (date, sku_id, bottles, reason) VALUES ($1, $2, $3, 'Opening balance')", [addDays(today, -40), skus.get(code)!.id, bottles]);
}

for (const [days, code, bottles, batch] of [[5, "022", 1490, "B-2614"], [2, "011", 4800, "B-2617"], [0, "011", 2400, "B-2620"], [0, "013", 120, "B-2621"], [0, "022", 600, "B-2622"], [0, "041", 480, "B-2623"]] as const) {
  await db.query("INSERT INTO production_entries (date, sku_id, bottles, batch_number) VALUES ($1, $2, $3, $4)", [days === 0 ? today : inMonth(days), skus.get(code)!.id, bottles, batch]);
}

let seq = 0;
const invoiceLines = new Map<number, number[]>();
async function invoice(customer: string, daysAgo: number, lines: [string, number][], etims: string | null) {
  const date = addDays(today, -daysAgo);
  const credit = ["Kilima Wines & Spirits", "Mombasa Road Distributors", "Rift Valley Liquor Mart"].includes(customer);
  const taxes = lines.map(([code, bottles]) => ({ code, bottles, ...lineTax({ bottles, pricePerBottle: price[skus.get(code)!.size_ml], sizeMl: skus.get(code)!.size_ml }) }));
  const sum = (key: "total" | "vat" | "excise") => Math.round(taxes.reduce((s, t) => s + t[key], 0) * 100) / 100;
  const number = `VD-INV-${date.slice(0, 4)}-${String(++seq).padStart(5, "0")}`;
  const [{ id }] = await db.query<{ id: number }>(
    `INSERT INTO invoices (number, date, customer_id, status, credit_sale, due_date, etims_number, total_incl, vat, excise, posted_at)
     VALUES ($1, $2, $3, 'Posted', $4, $5, $6, $7, $8, $9, $2::date + time '09:00' + ($10 || ' minutes')::interval) RETURNING id`,
    [number, date, customers[customer], credit, credit ? addDays(date, 90) : date, etims, sum("total"), sum("vat"), sum("excise"), seq],
  );
  const lineIds: number[] = [];
  for (const t of taxes) {
    const s = skus.get(t.code)!;
    const perBox = s.size_ml === 100 ? 24 : 12;
    const [{ id: lineId }] = await db.query<{ id: number }>(
      `INSERT INTO invoice_lines (invoice_id, sku_id, boxes, loose_bottles, bottles, price_per_bottle, line_total, vat, excise, size_ml, abv, vat_rate, excise_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0.4, 0.16, 10) RETURNING id`,
      [id, s.id, Math.floor(t.bottles / perBox), t.bottles % perBox, t.bottles, price[s.size_ml], t.total, t.vat, t.excise, s.size_ml],
    );
    lineIds.push(lineId);
  }
  invoiceLines.set(id, lineIds);
  await db.query("INSERT INTO ledger_entries (customer_id, date, doc_type, doc_id, doc_number, debit) VALUES ($1, $2, 'Invoice', $3, $4, $5)", [customers[customer], date, id, number, sum("total")]);
  return { id, number, date, total: sum("total"), lines: taxes };
}

async function dispatch(inv: Awaited<ReturnType<typeof invoice>>, daysAgo: number) {
  const [{ id }] = await db.query<{ id: number }>("INSERT INTO dispatches (invoice_id, date) VALUES ($1, $2) RETURNING id", [inv.id, addDays(today, -daysAgo)]);
  const lineIds = invoiceLines.get(inv.id)!;
  for (const [i, line] of inv.lines.entries()) {
    await db.query("INSERT INTO dispatch_lines (dispatch_id, invoice_line_id, bottles, excise) VALUES ($1, $2, $3, $4)", [id, lineIds[i], line.bottles, line.excise]);
  }
}

async function payment(customer: string, daysAgo: number, amount: number, method: string, reference: string | null, inv: { id: number }) {
  const date = addDays(today, -daysAgo);
  const [{ id }] = await db.query<{ id: number }>("INSERT INTO payments (date, customer_id, amount, method, reference) VALUES ($1, $2, $3, $4, $5) RETURNING id", [date, customers[customer], amount, method, reference]);
  await db.query("INSERT INTO allocations (payment_id, invoice_id, amount) VALUES ($1, $2, $3)", [id, inv.id, amount]);
  await db.query("INSERT INTO ledger_entries (customer_id, date, doc_type, doc_id, doc_number, credit) VALUES ($1, $2, 'Payment', $3, $4, $5)", [customers[customer], date, id, reference ?? `Cash ${id}`, amount]);
}

// Credit history that produces the brief's balances: Rift 780,000 (blocked), Kilima 920,000, Mombasa 640,000.
const rift187 = await invoice("Rift Valley Liquor Mart", 95, [["013", 240], ["022", 180]], "KRA-0039120");
await dispatch(rift187, 95);
await dispatch(await invoice("Mombasa Road Distributors", 50, [["013", 574]], "KRA-0041002"), 49);
await dispatch(await invoice("Rift Valley Liquor Mart", 40, [["013", 500], ["011", 2]], "KRA-0041544"), 39);
await dispatch(await invoice("Kilima Wines & Spirits", 20, [["013", 788]], "KRA-0043120"), 19);
const mombasa228 = await invoice("Mombasa Road Distributors", 10, [["011", 324]], "KRA-0043990");
await dispatch(mombasa228, 9);

// Cash sales for the 7-day chart.
for (const [days, bottles] of [[6, 1492], [5, 1560], [4, 2008], [3, 1330], [1, 2666]] as const) {
  const inv = await invoice(days % 2 ? "Lakeside Wholesalers" : "Upper Hill Bar & Grill", days, [["011", bottles]], `KRA-00${44000 + days}`);
  await dispatch(inv, days);
  await payment(days % 2 ? "Lakeside Wholesalers" : "Upper Hill Bar & Grill", days, inv.total, "Cash", null, inv);
}

// Today's four invoices from the brief (KSh 343,200).
const kilima241 = await invoice("Kilima Wines & Spirits", 0, [["011", 480], ["013", 36]], "KRA-0044862");
await dispatch(kilima241, 0);
const upper242 = await invoice("Upper Hill Bar & Grill", 0, [["041", 246]], "KRA-0044866");
await dispatch(upper242, 0);
await invoice("Mombasa Road Distributors", 0, [["022", 300]], null);
const lakeside244 = await invoice("Lakeside Wholesalers", 0, [["011", 480]], "KRA-0044871");

await payment("Upper Hill Bar & Grill", 0, 49200, "M-Pesa", "SJ63KQ8P2L", upper242);
await payment("Lakeside Wholesalers", 0, 96000, "M-Pesa", "SJ64LM2R7T", lakeside244);
await payment("Mombasa Road Distributors", 0, 64800, "Bank", "EQ-TRF-558213", mombasa228);

// Raw materials on hand (brief) and one carton purchase this month.
const onHand: Record<string, number> = { RM01: 180, RM02: 60, RM03: 5000, RM04: 12, RM05: 9, RM06: 7, RM07: 8400, RM08: 3100, RM09: 900, RM10: 1200, RM11: 2800, RM12: 1100, RM13: 9000, RM14: 4000, RM15: 1500, RM16: 350, RM17: 260, RM18: 90, RM19: 40 };
for (const [code, quantity] of Object.entries(onHand)) {
  await db.query("INSERT INTO material_movements (date, raw_material_id, quantity, kind, reason) SELECT $1, id, $2, 'adjustment', 'Opening balance' FROM raw_materials WHERE code = $3", [addDays(today, -40), quantity, code]);
}
const [{ id: supplier }] = await db.query<{ id: number }>("INSERT INTO suppliers (name, kra_pin, phone) VALUES ('Nairobi Cartons Ltd', 'P056789012F', '0766 890 123') RETURNING id");
await db.query("INSERT INTO purchases (date, supplier_id, supplier_etims, total, input_vat) VALUES ($1, $2, 'KRA-SUP-7781', 10000, 1379.31)", [inMonth(3), supplier]);

// Stamps this month: applied 9,860 against 9,890 bottles produced (0.3%).
for (const [type, quantity] of [["Received", 14210], ["Applied", 9860], ["Spoiled", 30]] as const) {
  await db.query("INSERT INTO stamp_register (date, type, quantity) VALUES ($1, $2, $3)", [monthStart, type, quantity]);
}

console.log(`Demo data loaded for ${today}. Users 0700000002–05 have PIN 1234.`);
