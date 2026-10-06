import type { Queryable } from "./db";

const TABLES = [
  "company_settings", "counters", "users", "tax_rates", "products", "skus", "price_list", "customers", "suppliers",
  "raw_materials", "purchases", "purchase_lines", "material_movements", "recipes", "production_entries", "day_status",
  "stock_days", "stock_adjustments", "invoices", "invoice_lines", "dispatches", "dispatch_lines", "credit_notes",
  "credit_note_lines", "payments", "allocations", "ledger_entries", "stamp_register", "audit_log",
];

export interface BackupSnapshot {
  createdAt: string;
  schemaVersion: number;
  tables: Record<string, unknown[]>;
}

// Full logical snapshot of every business table (sessions are deliberately left out).
export async function snapshot(q: Queryable): Promise<BackupSnapshot> {
  const [{ version }] = await q.query<{ version: number }>("SELECT max(version) AS version FROM schema_migrations");
  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    tables[table] = await q.query(`SELECT * FROM ${table} ORDER BY 1`);
  }
  return { createdAt: new Date().toISOString(), schemaVersion: version, tables };
}
