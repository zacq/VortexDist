import type { Queryable } from "../db";

export interface StockRow {
  sku_id: number;
  code: string;
  product: string;
  size_ml: number;
  bottles_per_box: number;
  active: boolean;
  opening: number;
  produced: number;
  sold: number;
  adjustments: number;
  closing: number;
}

// Every finished-goods movement in bottles. Sold is net of approved credit notes that return stock.
const MOVEMENTS = `
  SELECT sku_id, date, bottles AS produced, 0 AS sold, 0 AS adjustments FROM production_entries
  UNION ALL
  SELECT il.sku_id, i.date, 0, il.bottles, 0
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
   WHERE i.status = 'Posted'
  UNION ALL
  SELECT il.sku_id, cn.date, 0, -cnl.bottles, 0
    FROM credit_note_lines cnl
    JOIN credit_notes cn ON cn.id = cnl.credit_note_id
    JOIN invoice_lines il ON il.id = cnl.invoice_line_id
   WHERE cn.status = 'Approved' AND cnl.restock
  UNION ALL
  SELECT sku_id, date, 0, 0, bottles FROM stock_adjustments
`;

// PRD rule 2: closing = opening + produced − sold ± adjustments; opening = previous day's closing.
// Closing is always calculated from movements, never typed.
export async function stockForDate(q: Queryable, date: string): Promise<StockRow[]> {
  return q.query<StockRow>(
    `WITH mv AS (${MOVEMENTS})
     SELECT s.id AS sku_id, s.code, p.name AS product, s.size_ml, s.bottles_per_box, s.active,
            COALESCE(SUM(mv.produced + -mv.sold + mv.adjustments) FILTER (WHERE mv.date < $1::date), 0) AS opening,
            COALESCE(SUM(mv.produced) FILTER (WHERE mv.date = $1::date), 0) AS produced,
            COALESCE(SUM(mv.sold) FILTER (WHERE mv.date = $1::date), 0) AS sold,
            COALESCE(SUM(mv.adjustments) FILTER (WHERE mv.date = $1::date), 0) AS adjustments,
            COALESCE(SUM(mv.produced + -mv.sold + mv.adjustments) FILTER (WHERE mv.date <= $1::date), 0) AS closing
       FROM skus s
       JOIN products p ON p.id = s.product_id
       LEFT JOIN mv ON mv.sku_id = s.id
      GROUP BY s.id, p.name
      ORDER BY s.code`,
    [date],
  );
}

export type DayState = "Open" | "Closed" | "Reopened";

export async function dayState(q: Queryable, date: string): Promise<DayState> {
  const [row] = await q.query<{ status: DayState }>("SELECT status FROM day_status WHERE date = $1::date", [date]);
  return row?.status ?? "Open";
}
