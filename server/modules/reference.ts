import { nairobiToday } from "../../shared/format";
import type { Bootstrap, CompanySettings } from "../../shared/types";
import { one } from "../db";
import { requireUser, type Router } from "../http";
import { ratesOn, skusOn } from "../rates";

export function registerReference(router: Router) {
  router.get("/health", async (ctx) => {
    await ctx.db.query("SELECT 1");
    return { ok: true, today: nairobiToday() };
  });

  router.get("/bootstrap", async (ctx): Promise<Bootstrap> => {
    requireUser(ctx);
    const today = nairobiToday();
    const [company, skus, rates] = await Promise.all([
      one<CompanySettings>(ctx.db, "SELECT name, kra_pin, address, phone, email, bank_name, bank_account, mpesa_paybill, invoice_prefix, credit_note_prefix FROM company_settings WHERE id = 1"),
      skusOn(ctx.db, today),
      ratesOn(ctx.db, today),
    ]);
    return { today, company: company!, skus, rates };
  });
}
