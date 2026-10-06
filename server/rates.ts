import type { Sku, TaxRatesNow } from "../shared/types";
import { HttpError } from "./http";
import type { Queryable } from "./db";

// Rule 5: tax rates and prices are looked up by document date.

export async function ratesOn(q: Queryable, date: string): Promise<TaxRatesNow> {
  const rows = await q.query<{ type: string; value: number }>(
    `SELECT DISTINCT ON (type) type, value FROM tax_rates
      WHERE valid_from <= $1 AND (valid_to IS NULL OR valid_to >= $1)
      ORDER BY type, valid_from DESC`,
    [date],
  );
  const vat = rows.find((row) => row.type === "VAT")?.value;
  const excise = rows.find((row) => row.type === "EXCISE_SPIRITS")?.value;
  if (vat === undefined || excise === undefined) throw new HttpError(409, `No VAT or excise rate is set for ${date}. Ask the Owner to set tax rates.`);
  return { vat, excisePerCl: excise };
}

export async function skusOn(q: Queryable, date: string): Promise<Sku[]> {
  return q.query<Sku>(
    `SELECT s.id, s.code, p.name AS product, p.id AS product_id, s.size_ml, s.bottles_per_box, p.abv, s.active,
            COALESCE((SELECT pl.price_per_bottle FROM price_list pl
                       WHERE pl.size_ml = s.size_ml AND pl.valid_from <= $1 AND (pl.valid_to IS NULL OR pl.valid_to >= $1)
                       ORDER BY pl.valid_from DESC LIMIT 1), 0) AS price_per_bottle
       FROM skus s JOIN products p ON p.id = s.product_id
      ORDER BY s.code`,
    [date],
  );
}
