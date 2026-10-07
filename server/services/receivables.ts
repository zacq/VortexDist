import type { CreditStatus } from "../../shared/credit";
import { roundMoney } from "../../shared/tax";
import type { Queryable } from "../db";

export interface OpenInvoice {
  id: number;
  number: string;
  date: string;
  due_date: string | null;
  customer_id: number;
  total_incl: number;
  vat: number;
  excise: number;
  outstanding: number;
}

// Posted invoices with money still owed: total − payments allocated − approved credit notes.
export async function openInvoices(q: Queryable, customerId?: number): Promise<OpenInvoice[]> {
  const rows = await q.query<OpenInvoice>(
    `SELECT i.id, i.number, i.date, i.due_date, i.customer_id, i.total_incl, i.vat, i.excise,
            i.total_incl
              - COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.invoice_id = i.id), 0)
              - COALESCE((SELECT SUM(cn.total_incl) FROM credit_notes cn WHERE cn.invoice_id = i.id AND cn.status = 'Approved'), 0)
              AS outstanding
       FROM invoices i
      WHERE i.status = 'Posted' AND ($1::int IS NULL OR i.customer_id = $1::int)
      ORDER BY i.date, i.id`,
    [customerId ?? null],
  );
  return rows.map((row) => ({ ...row, outstanding: roundMoney(row.outstanding) })).filter((row) => row.outstanding > 0.004);
}

export type { CreditStatus };

export interface CustomerCredit {
  customer_id: number;
  name: string;
  credit_allowed: boolean;
  credit_limit: number;
  terms_days: number;
  balance: number;
  pct_used: number;
  status: CreditStatus;
  reason: string | null;
  oldest_overdue: { number: string; age_days: number } | null;
}

function ageInDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// PRD rule 8: warn at 90% of the limit; block at 100% or when any invoice is past the terms.
export async function customerCredit(q: Queryable, today: string): Promise<CustomerCredit[]> {
  const customers = await q.query<{ id: number; name: string; credit_allowed: boolean; credit_limit: number; terms_days: number; blocked: boolean; block_reason: string | null; balance: number }>(
    `SELECT c.id, c.name, c.credit_allowed, c.credit_limit, c.terms_days, c.blocked, c.block_reason,
            COALESCE((SELECT SUM(debit - credit) FROM ledger_entries le WHERE le.customer_id = c.id), 0) AS balance
       FROM customers c
      WHERE NOT c.hidden
      ORDER BY c.name`,
  );
  const open = await openInvoices(q);

  return customers.map((customer) => {
    const balance = roundMoney(customer.balance);
    const overdue = open
      .filter((inv) => inv.customer_id === customer.id && inv.due_date !== null && inv.due_date < today)
      .map((inv) => ({ number: inv.number, age_days: ageInDays(inv.date, today) }))
      .sort((a, b) => b.age_days - a.age_days)[0] ?? null;
    const pct = customer.credit_limit > 0 ? balance / customer.credit_limit : 0;

    let status: CreditStatus = "OK";
    let reason: string | null = null;
    if (customer.blocked) {
      status = "Blocked";
      reason = customer.block_reason ?? "Blocked by the Owner";
    } else if (customer.credit_allowed && overdue) {
      status = "Blocked";
      reason = `invoice ${overdue.number} is ${overdue.age_days} days old, past the ${customer.terms_days}-day terms`;
    } else if (!customer.credit_allowed) {
      status = "Cash only";
    } else if (pct >= 1) {
      status = "Blocked";
      reason = "credit limit reached";
    } else if (pct >= 0.9) {
      status = "Near limit";
      reason = "near limit";
    }

    return {
      customer_id: customer.id,
      name: customer.name,
      credit_allowed: customer.credit_allowed,
      credit_limit: customer.credit_limit,
      terms_days: customer.terms_days,
      balance,
      pct_used: Math.round(pct * 1000) / 10,
      status,
      reason,
      oldest_overdue: overdue,
    };
  });
}
