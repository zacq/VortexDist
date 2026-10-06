import type { Queryable } from "./db";
import { hashPin } from "./auth";

// Reference data locked in PRD v2 (6 Oct 2026). Customers, staff and liquid recipes
// are entered by the Owner; nothing invented is seeded here.

const PRODUCTS = [
  { code: "01", name: "Vodka" },
  { code: "02", name: "Gin" },
  { code: "03", name: "Pineapple" },
  { code: "04", name: "Strawberry" },
  { code: "05", name: "Whisky" },
];

const SIZES = [
  { digit: 1, size_ml: 100, bottles_per_box: 24, price: 200 },
  { digit: 2, size_ml: 200, bottles_per_box: 12, price: 220 },
  { digit: 3, size_ml: 750, bottles_per_box: 12, price: 1000 },
];

const RAW_MATERIALS: { code: string; name: string; category: string; unit: string; size_ml?: number; reorder: number; ethanol?: boolean }[] = [
  { code: "RM01", name: "Ethanol 96%", category: "Liquid", unit: "L", reorder: 250, ethanol: true },
  { code: "RM02", name: "Glycerine", category: "Liquid", unit: "L", reorder: 20 },
  { code: "RM03", name: "Water", category: "Liquid", unit: "L", reorder: 1000 },
  { code: "RM04", name: "Strawberry flavour", category: "Flavour", unit: "L", reorder: 5 },
  { code: "RM05", name: "Gin flavour", category: "Flavour", unit: "L", reorder: 5 },
  { code: "RM06", name: "Pineapple flavour", category: "Flavour", unit: "L", reorder: 5 },
  { code: "RM07", name: "Bottle 100ml", category: "Bottle", unit: "pcs", size_ml: 100, reorder: 5000 },
  { code: "RM08", name: "Bottle 200ml", category: "Bottle", unit: "pcs", size_ml: 200, reorder: 2000 },
  { code: "RM09", name: "Bottle 750ml", category: "Bottle", unit: "pcs", size_ml: 750, reorder: 600 },
  { code: "RM10", name: "Lid 100ml", category: "Lid", unit: "pcs", size_ml: 100, reorder: 2000 },
  { code: "RM11", name: "Lid 200ml", category: "Lid", unit: "pcs", size_ml: 200, reorder: 2000 },
  { code: "RM12", name: "Lid 750ml", category: "Lid", unit: "pcs", size_ml: 750, reorder: 600 },
  { code: "RM13", name: "Label 100ml", category: "Label", unit: "pcs", size_ml: 100, reorder: 5000 },
  { code: "RM14", name: "Label 200ml", category: "Label", unit: "pcs", size_ml: 200, reorder: 2000 },
  { code: "RM15", name: "Label 750ml", category: "Label", unit: "pcs", size_ml: 750, reorder: 600 },
  { code: "RM16", name: "Box 100ml", category: "Box", unit: "pcs", size_ml: 100, reorder: 200 },
  { code: "RM17", name: "Box 200ml", category: "Box", unit: "pcs", size_ml: 200, reorder: 150 },
  { code: "RM18", name: "Box 750ml", category: "Box", unit: "pcs", size_ml: 750, reorder: 50 },
  { code: "RM19", name: "Sello tape", category: "Packing", unit: "rolls", reorder: 10 },
];

const EFFECTIVE_FROM = "2026-10-06";

export async function seedReferenceData(q: Queryable): Promise<void> {
  await q.query(
    "INSERT INTO company_settings (id, name, address) VALUES (1, $1, $2)",
    ["Vortex Distillery", "Nairobi, Kenya"],
  );

  await q.query("INSERT INTO tax_rates (type, value, unit, valid_from) VALUES ('VAT', 0.16, 'fraction', $1)", [EFFECTIVE_FROM]);
  await q.query("INSERT INTO tax_rates (type, value, unit, valid_from) VALUES ('EXCISE_SPIRITS', 10, 'KSh per cl pure alcohol', $1)", [EFFECTIVE_FROM]);

  for (const product of PRODUCTS) {
    const [{ id }] = await q.query<{ id: number }>("INSERT INTO products (code, name, abv) VALUES ($1, $2, 0.40) RETURNING id", [product.code, product.name]);
    for (const size of SIZES) {
      await q.query(
        "INSERT INTO skus (code, product_id, size_ml, bottles_per_box) VALUES ($1, $2, $3, $4)",
        [`${product.code}${size.digit}`, id, size.size_ml, size.bottles_per_box],
      );
    }
  }

  for (const size of SIZES) {
    await q.query("INSERT INTO price_list (size_ml, price_per_bottle, valid_from) VALUES ($1, $2, $3)", [size.size_ml, size.price, EFFECTIVE_FROM]);
  }

  for (const item of RAW_MATERIALS) {
    await q.query(
      "INSERT INTO raw_materials (code, name, category, unit, size_ml, reorder_level, is_ethanol) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [item.code, item.name, item.category, item.unit, item.size_ml ?? null, item.reorder, item.ethanol ?? false],
    );
  }

  // Packaging per box is fixed by the pack size: one bottle, lid and label per bottle, one carton per box.
  await q.query(`
    INSERT INTO recipes (sku_id, raw_material_id, qty_per_box)
    SELECT s.id, rm.id, CASE WHEN rm.category = 'Box' THEN 1 ELSE s.bottles_per_box END
      FROM skus s JOIN raw_materials rm ON rm.size_ml = s.size_ml AND rm.category IN ('Bottle', 'Lid', 'Label', 'Box')
  `);

  const ownerPhone = process.env.OWNER_PHONE ?? "0700000001";
  const ownerPin = process.env.OWNER_INITIAL_PIN ?? "1234";
  await q.query(
    "INSERT INTO users (name, phone, pin_hash, profiles, must_change_pin) VALUES ($1, $2, $3, $4, true)",
    [process.env.OWNER_NAME ?? "Owner", ownerPhone, hashPin(ownerPin), ["Owner"]],
  );
}
