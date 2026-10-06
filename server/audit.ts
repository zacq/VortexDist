import type { SessionUser } from "./auth";
import type { Queryable } from "./db";

// Rule 12: every change is logged, including overrides with their reason.
export async function audit(
  q: Queryable,
  user: SessionUser | null,
  entry: { table: string; recordId: string | number; action: string; before?: unknown; after?: unknown; reason?: string | null },
): Promise<void> {
  await q.query(
    `INSERT INTO audit_log (table_name, record_id, action, before, after, reason, user_id, user_name, profile)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.table,
      String(entry.recordId),
      entry.action,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      entry.reason ?? null,
      user?.id ?? null,
      user?.name ?? null,
      user?.profile ?? null,
    ],
  );
}
