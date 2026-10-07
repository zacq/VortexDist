import { roundMoney } from "../../shared/tax";
import type { Queryable } from "../db";

export type PaymentStatus = "Paid" | "Part paid" | "Unpaid" | "Overdue";
export type DispatchStatus = "Dispatched" | "Part dispatched" | "Not dispatched";

export interface InvoiceSummary {
  id: number;
  number: string;
  date: string;
  due_date: string | null;
  customer_id: number;
  customer: string;
  total_incl: number;
  vat: number;
  excise: number;
  etims_number: string | null;
  outstanding: number;
  dispatchable: number;
  dispatched: number;
  payment: PaymentStatus;
  dispatch: DispatchStatus;
}

// Posted invoices with derived payment and goods-out status. `where` filters on alias i (invoices).
export async function invoiceSummaries(q: Queryable, where = "TRUE", params: unknown[] = [], limit = 500, today: string): Promise<InvoiceSummary[]> {
  const rows = await q.query<Omit<InvoiceSummary, "payment" | "dispatch"> & { paid: number }>(
    `SELECT i.id, i.number, i.date, i.due_date, i.customer_id, c.name AS customer, i.total_incl, i.vat, i.excise, i.etims_number,
            COALESCE(pay.paid, 0) AS paid,
            i.total_incl - COALESCE(pay.paid, 0) - COALESCE(cn.credited, 0) AS outstanding,
            COALESCE(lines.bottles, 0) - COALESCE(cnb.bottles, 0) AS dispatchable,
            COALESCE(disp.bottles, 0) AS dispatched
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM allocations GROUP BY invoice_id) pay ON pay.invoice_id = i.id
       LEFT JOIN (SELECT invoice_id, SUM(bottles) AS bottles FROM invoice_lines GROUP BY invoice_id) lines ON lines.invoice_id = i.id
       LEFT JOIN (SELECT invoice_id, SUM(total_incl) AS credited FROM credit_notes WHERE status = 'Approved' GROUP BY invoice_id) cn ON cn.invoice_id = i.id
       LEFT JOIN (SELECT x.invoice_id, SUM(cnl.bottles) AS bottles FROM credit_note_lines cnl JOIN credit_notes x ON x.id = cnl.credit_note_id
                   WHERE x.status = 'Approved' GROUP BY x.invoice_id) cnb ON cnb.invoice_id = i.id
       LEFT JOIN (SELECT d.invoice_id, SUM(dl.bottles) AS bottles FROM dispatch_lines dl JOIN dispatches d ON d.id = dl.dispatch_id GROUP BY d.invoice_id) disp ON disp.invoice_id = i.id
      WHERE i.status = 'Posted' AND (${where})
      ORDER BY i.posted_at DESC NULLS LAST, i.id DESC
      LIMIT ${Math.floor(limit)}`,
    params,
  );

  return rows.map(({ paid, ...row }) => {
    const outstanding = roundMoney(row.outstanding);
    let payment: PaymentStatus;
    if (outstanding <= 0.004) payment = "Paid";
    else if (row.due_date !== null && row.due_date < today) payment = "Overdue";
    else if (paid > 0) payment = "Part paid";
    else payment = "Unpaid";

    let dispatch: DispatchStatus;
    if (row.dispatched <= 0) dispatch = row.dispatchable <= 0 ? "Dispatched" : "Not dispatched";
    else dispatch = row.dispatched >= row.dispatchable ? "Dispatched" : "Part dispatched";

    return { ...row, outstanding, payment, dispatch };
  });
}
