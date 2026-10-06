import type { Db, Queryable } from "./db";
import { seedReferenceData } from "./seed";

// PRD v2 data model. Stock and sales quantities are always stored in bottles (rule 1).
// Records are never deleted, only hidden (rule 12), so there are no ON DELETE CASCADE rules.
const V1_SCHEMA = `
CREATE TABLE company_settings (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name            text NOT NULL,
  kra_pin         text,
  address         text,
  phone           text,
  email           text,
  bank_name       text,
  bank_account    text,
  mpesa_paybill   text,
  logo_data_url   text,
  invoice_prefix  text NOT NULL DEFAULT 'VD-INV',
  credit_note_prefix text NOT NULL DEFAULT 'VD-CN',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Gap-free document numbers, one row per prefix and year (rule 6).
CREATE TABLE counters (
  key    text PRIMARY KEY,
  value  integer NOT NULL
);

CREATE TABLE users (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  phone            text NOT NULL UNIQUE,
  pin_hash         text NOT NULL,
  profiles         text[] NOT NULL,
  must_change_pin  boolean NOT NULL DEFAULT true,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id),
  profile     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Types: VAT (fraction, 0.16), EXCISE_SPIRITS (KSh per cl pure alcohol), ETHANOL_EXCISE, STAMP_FEE.
CREATE TABLE tax_rates (
  id          serial PRIMARY KEY,
  type        text NOT NULL,
  value       numeric(12,4) NOT NULL,
  unit        text NOT NULL,
  valid_from  date NOT NULL,
  valid_to    date,
  created_by  integer REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id    serial PRIMARY KEY,
  code  text NOT NULL UNIQUE,
  name  text NOT NULL,
  abv   numeric(5,4) NOT NULL DEFAULT 0.40
);

CREATE TABLE skus (
  id               serial PRIMARY KEY,
  code             text NOT NULL UNIQUE,
  product_id       integer NOT NULL REFERENCES products(id),
  size_ml          integer NOT NULL,
  bottles_per_box  integer NOT NULL,
  active           boolean NOT NULL DEFAULT true
);

-- One price list per bottle size, VAT- and excise-inclusive.
CREATE TABLE price_list (
  id                serial PRIMARY KEY,
  size_ml           integer NOT NULL,
  price_per_bottle  numeric(12,2) NOT NULL,
  valid_from        date NOT NULL,
  valid_to          date,
  created_by        integer REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  kra_pin         text NOT NULL UNIQUE,
  address         text,
  phone           text,
  email           text,
  credit_allowed  boolean NOT NULL DEFAULT false,
  credit_limit    numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0 AND credit_limit <= 1000000),
  terms_days      integer NOT NULL DEFAULT 90,
  blocked         boolean NOT NULL DEFAULT false,
  block_reason    text,
  hidden          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id       serial PRIMARY KEY,
  name     text NOT NULL,
  kra_pin  text,
  phone    text,
  hidden   boolean NOT NULL DEFAULT false
);

CREATE TABLE raw_materials (
  id             serial PRIMARY KEY,
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  category       text NOT NULL,
  size_ml        integer,
  unit           text NOT NULL,
  reorder_level  numeric(14,3) NOT NULL DEFAULT 0,
  average_cost   numeric(14,4) NOT NULL DEFAULT 0,
  is_ethanol     boolean NOT NULL DEFAULT false,
  hidden         boolean NOT NULL DEFAULT false
);

CREATE TABLE purchases (
  id              serial PRIMARY KEY,
  date            date NOT NULL,
  supplier_id     integer NOT NULL REFERENCES suppliers(id),
  supplier_etims  text,
  total           numeric(14,2) NOT NULL,
  input_vat       numeric(14,2) NOT NULL,
  excise_paid     numeric(14,2) NOT NULL DEFAULT 0,
  notes           text,
  created_by      integer REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_lines (
  id               serial PRIMARY KEY,
  purchase_id      integer NOT NULL REFERENCES purchases(id),
  raw_material_id  integer NOT NULL REFERENCES raw_materials(id),
  quantity         numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price       numeric(14,4) NOT NULL,
  vatable          boolean NOT NULL DEFAULT true,
  line_total       numeric(14,2) NOT NULL,
  input_vat        numeric(14,2) NOT NULL,
  excise_paid      numeric(14,2) NOT NULL DEFAULT 0
);

-- Every raw-material in/out: purchase (+), production usage (-), count adjustment (+/-).
CREATE TABLE material_movements (
  id               serial PRIMARY KEY,
  date             date NOT NULL,
  raw_material_id  integer NOT NULL REFERENCES raw_materials(id),
  quantity         numeric(14,3) NOT NULL,
  kind             text NOT NULL,
  ref_id           integer,
  reason           text,
  created_by       integer REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id               serial PRIMARY KEY,
  sku_id           integer NOT NULL REFERENCES skus(id),
  raw_material_id  integer NOT NULL REFERENCES raw_materials(id),
  qty_per_box      numeric(14,4) NOT NULL,
  UNIQUE (sku_id, raw_material_id)
);

CREATE TABLE production_entries (
  id               serial PRIMARY KEY,
  date             date NOT NULL,
  sku_id           integer NOT NULL REFERENCES skus(id),
  bottles          integer NOT NULL CHECK (bottles > 0),
  batch_number     text NOT NULL,
  override_reason  text,
  entered_by       integer REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Day lock (rule 3). Per-SKU snapshot rows in stock_days are written when a day is closed.
CREATE TABLE day_status (
  date           date PRIMARY KEY,
  status         text NOT NULL CHECK (status IN ('Closed', 'Reopened')),
  closed_by      integer REFERENCES users(id),
  closed_at      timestamptz,
  reopened_by    integer REFERENCES users(id),
  reopened_at    timestamptz,
  reopen_reason  text
);

CREATE TABLE stock_days (
  date         date NOT NULL,
  sku_id       integer NOT NULL REFERENCES skus(id),
  opening      integer NOT NULL,
  produced     integer NOT NULL,
  sold         integer NOT NULL,
  adjustments  integer NOT NULL,
  closing      integer NOT NULL,
  PRIMARY KEY (date, sku_id)
);

CREATE TABLE stock_adjustments (
  id                serial PRIMARY KEY,
  date              date NOT NULL,
  sku_id            integer NOT NULL REFERENCES skus(id),
  bottles           integer NOT NULL,
  reason            text NOT NULL,
  note              text,
  counted_bottles   integer,
  expected_bottles  integer,
  entered_by        integer REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id                     serial PRIMARY KEY,
  number                 text UNIQUE,
  date                   date NOT NULL,
  customer_id            integer NOT NULL REFERENCES customers(id),
  status                 text NOT NULL CHECK (status IN ('Draft', 'Posted', 'Discarded')),
  credit_sale            boolean NOT NULL DEFAULT false,
  due_date               date,
  etims_number           text,
  etims_qr               text,
  total_incl             numeric(14,2) NOT NULL DEFAULT 0,
  vat                    numeric(14,2) NOT NULL DEFAULT 0,
  excise                 numeric(14,2) NOT NULL DEFAULT 0,
  override_reason        text,
  override_requested     boolean NOT NULL DEFAULT false,
  override_request_note  text,
  notes                  text,
  client_draft_id        text UNIQUE,
  created_by             integer REFERENCES users(id),
  posted_by              integer REFERENCES users(id),
  posted_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Rates and prices are copied onto the line when posted, so posted invoices never recalculate (rule 5).
CREATE TABLE invoice_lines (
  id                serial PRIMARY KEY,
  invoice_id        integer NOT NULL REFERENCES invoices(id),
  sku_id            integer NOT NULL REFERENCES skus(id),
  boxes             integer NOT NULL DEFAULT 0,
  loose_bottles     integer NOT NULL DEFAULT 0,
  bottles           integer NOT NULL CHECK (bottles > 0),
  price_per_bottle  numeric(12,2) NOT NULL,
  line_total        numeric(14,2) NOT NULL,
  vat               numeric(14,2) NOT NULL,
  excise            numeric(14,2) NOT NULL,
  size_ml           integer NOT NULL,
  abv               numeric(5,4) NOT NULL,
  vat_rate          numeric(8,4) NOT NULL,
  excise_rate       numeric(12,4) NOT NULL
);

-- Excise is counted when goods leave the factory (rule 9).
CREATE TABLE dispatches (
  id            serial PRIMARY KEY,
  invoice_id    integer NOT NULL REFERENCES invoices(id),
  date          date NOT NULL,
  note          text,
  confirmed_by  integer REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dispatch_lines (
  id               serial PRIMARY KEY,
  dispatch_id      integer NOT NULL REFERENCES dispatches(id),
  invoice_line_id  integer NOT NULL REFERENCES invoice_lines(id),
  bottles          integer NOT NULL CHECK (bottles > 0),
  excise           numeric(14,2) NOT NULL
);

CREATE TABLE credit_notes (
  id             serial PRIMARY KEY,
  number         text UNIQUE,
  invoice_id     integer NOT NULL REFERENCES invoices(id),
  status         text NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reason         text NOT NULL,
  date           date,
  total_incl     numeric(14,2) NOT NULL,
  vat            numeric(14,2) NOT NULL,
  excise         numeric(14,2) NOT NULL,
  raised_by      integer REFERENCES users(id),
  raised_at      timestamptz NOT NULL DEFAULT now(),
  decided_by     integer REFERENCES users(id),
  decided_at     timestamptz,
  reject_reason  text
);

CREATE TABLE credit_note_lines (
  id               serial PRIMARY KEY,
  credit_note_id   integer NOT NULL REFERENCES credit_notes(id),
  invoice_line_id  integer NOT NULL REFERENCES invoice_lines(id),
  bottles          integer NOT NULL CHECK (bottles > 0),
  line_total       numeric(14,2) NOT NULL,
  vat              numeric(14,2) NOT NULL,
  excise           numeric(14,2) NOT NULL,
  restock          boolean NOT NULL DEFAULT true
);

CREATE TABLE payments (
  id           serial PRIMARY KEY,
  date         date NOT NULL,
  customer_id  integer NOT NULL REFERENCES customers(id),
  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  method       text NOT NULL CHECK (method IN ('M-Pesa', 'Bank', 'Cash')),
  reference    text UNIQUE,
  note         text,
  recorded_by  integer REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE allocations (
  id          serial PRIMARY KEY,
  payment_id  integer NOT NULL REFERENCES payments(id),
  invoice_id  integer NOT NULL REFERENCES invoices(id),
  amount      numeric(14,2) NOT NULL CHECK (amount > 0)
);

CREATE TABLE ledger_entries (
  id           serial PRIMARY KEY,
  customer_id  integer NOT NULL REFERENCES customers(id),
  date         date NOT NULL,
  doc_type     text NOT NULL CHECK (doc_type IN ('Invoice', 'Payment', 'Credit note')),
  doc_id       integer NOT NULL,
  doc_number   text NOT NULL,
  debit        numeric(14,2) NOT NULL DEFAULT 0,
  credit       numeric(14,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stamp_register (
  id          serial PRIMARY KEY,
  date        date NOT NULL,
  type        text NOT NULL CHECK (type IN ('Received', 'Applied', 'Spoiled', 'Returned')),
  quantity    integer NOT NULL CHECK (quantity > 0),
  sku_id      integer REFERENCES skus(id),
  reference   text,
  entered_by  integer REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  table_name  text NOT NULL,
  record_id   text NOT NULL,
  action      text NOT NULL,
  before      jsonb,
  after       jsonb,
  reason      text,
  user_id     integer REFERENCES users(id),
  user_name   text,
  profile     text,
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_customer_idx ON invoices (customer_id, status);
CREATE INDEX invoices_date_idx ON invoices (date, status);
CREATE INDEX invoice_lines_invoice_idx ON invoice_lines (invoice_id);
CREATE INDEX production_date_idx ON production_entries (date, sku_id);
CREATE INDEX adjustments_date_idx ON stock_adjustments (date, sku_id);
CREATE INDEX dispatches_invoice_idx ON dispatches (invoice_id);
CREATE INDEX dispatches_date_idx ON dispatches (date);
CREATE INDEX allocations_invoice_idx ON allocations (invoice_id);
CREATE INDEX ledger_customer_idx ON ledger_entries (customer_id, date);
CREATE INDEX material_movements_idx ON material_movements (raw_material_id, date);
CREATE INDEX audit_at_idx ON audit_log (at DESC);
CREATE INDEX sessions_user_idx ON sessions (user_id);
`;

interface Migration {
  version: number;
  name: string;
  up: (q: Queryable) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "prd-v2-data-model",
    up: async (q) => {
      for (const statement of V1_SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
        await q.query(statement);
      }
    },
  },
  { version: 2, name: "reference-data", up: seedReferenceData },
];

export async function migrate(db: Db): Promise<void> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await db.query<{ version: number }>("SELECT version FROM schema_migrations")).map((row) => row.version));
  const pending = migrations.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;

  await db.tx(async (q) => {
    // Two cold-starting functions must not migrate at the same time.
    await q.query("SELECT pg_advisory_xact_lock(424242)");
    const done = new Set((await q.query<{ version: number }>("SELECT version FROM schema_migrations")).map((row) => row.version));
    for (const migration of migrations) {
      if (done.has(migration.version)) continue;
      await migration.up(q);
      await q.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [migration.version, migration.name]);
    }
  });
}
