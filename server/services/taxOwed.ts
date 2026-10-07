import { monthRange, shiftMonth } from "../../shared/format";
import { roundMoney } from "../../shared/tax";
import type { Queryable } from "../db";

export interface TaxOwed {
  from: string;
  to: string;
  outputVat: number;
  inputVat: number;
  vatPayable: number;
  excise: number;
  ethanolExcisePaid: number;
  total: number;
}

// Output VAT by invoice date, input VAT by purchase date, excise by dispatch date (rule 9).
// Approved credit notes reduce VAT and excise in the period they are approved.
export async function taxOwed(q: Queryable, from: string, to: string): Promise<TaxOwed> {
  const [row] = await q.query<{ output_vat: number; cn_vat: number; input_vat: number; excise: number; cn_excise: number; ethanol: number }>(
    `SELECT
       (SELECT COALESCE(SUM(vat), 0) FROM invoices WHERE status = 'Posted' AND date BETWEEN $1::date AND $2::date) AS output_vat,
       (SELECT COALESCE(SUM(vat), 0) FROM credit_notes WHERE status = 'Approved' AND date BETWEEN $1::date AND $2::date) AS cn_vat,
       (SELECT COALESCE(SUM(input_vat), 0) FROM purchases WHERE date BETWEEN $1::date AND $2::date) AS input_vat,
       (SELECT COALESCE(SUM(dl.excise), 0) FROM dispatch_lines dl JOIN dispatches d ON d.id = dl.dispatch_id WHERE d.date BETWEEN $1::date AND $2::date) AS excise,
       (SELECT COALESCE(SUM(excise), 0) FROM credit_notes WHERE status = 'Approved' AND date BETWEEN $1::date AND $2::date) AS cn_excise,
       (SELECT COALESCE(SUM(excise_paid), 0) FROM purchases WHERE date BETWEEN $1::date AND $2::date) AS ethanol`,
    [from, to],
  );
  const outputVat = roundMoney(row.output_vat - row.cn_vat);
  const inputVat = roundMoney(row.input_vat);
  const vatPayable = roundMoney(outputVat - inputVat);
  const excise = roundMoney(row.excise - row.cn_excise);
  return { from, to, outputVat, inputVat, vatPayable, excise, ethanolExcisePaid: roundMoney(row.ethanol), total: roundMoney(vatPayable + excise) };
}

export interface DuePayment {
  kind: "VAT" | "Excise";
  month: string;
  amount: number;
  due: string;
}

// VAT for a month is due by the 20th of the next month; excise is paid by the 5th (PRD, to confirm with the tax adviser).
export async function nextDuePayments(q: Queryable, today: string): Promise<DuePayment[]> {
  const thisMonth = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const result: DuePayment[] = [];
  for (const [kind, dueDay] of [["VAT", 20], ["Excise", 5]] as const) {
    const month = day <= dueDay ? shiftMonth(thisMonth, -1) : thisMonth;
    const range = monthRange(month);
    const owed = await taxOwed(q, range.from, range.to);
    result.push({
      kind,
      month,
      amount: kind === "VAT" ? owed.vatPayable : owed.excise,
      due: `${shiftMonth(month, 1)}-${String(dueDay).padStart(2, "0")}`,
    });
  }
  return result;
}
