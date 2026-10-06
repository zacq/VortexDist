import { PageHeader } from "../components/common";
import { screens, type ScreenKey } from "../config/navigation";

// Shown for screens whose module is not built yet; each lists the PRD v2 user stories it will deliver.
const stories: Partial<Record<ScreenKey, string>> = {
  dashboard: "Stories 1–2: Owed to KRA, today at a glance, stock today, credit watch, unpaid by age, 7-day sales, alerts, recent invoices.",
  invoices: "Invoice list with filters: All · Unpaid · Overdue · Not dispatched · No eTIMS.",
  newInvoice: "Stories 5–7: invoice in boxes and bottles, live VAT and excise, stock and credit checks, eTIMS number, WhatsApp PDF.",
  invoice: "Invoice detail: preview, timeline, eTIMS, credit notes (story 11), goods out.",
  customers: "Story 4: customer accounts with KRA PIN check and Owner-controlled credit.",
  customer: "Story 9: statement with running balance, invoices, payments, block / unblock.",
  payments: "Payments received, by method and reference.",
  newPayment: "Story 8: M-Pesa / bank / cash payment applied to invoices oldest first.",
  stock: "Stories 14–15: daily register, physical counts with reasons, close and reopen the day.",
  production: "Production entries by day and batch.",
  newProduction: "Story 13: boxes made per SKU with batch number and raw-material shortage check.",
  materials: "Story 12: raw-material stock, reorder levels, purchases with input VAT and ethanol excise.",
  dispatch: "Story 16: confirm boxes and bottles leaving the factory against each invoice.",
  stamps: "Story 17: excise stamps received, applied, spoiled, returned; 0.5% reconciliation alert.",
  tax: "Story 10: VAT and excise owed by month, excise by SKU, due dates, tax pack export.",
  settings: "Story 3: company, price list and tax rates with start dates, SKUs, recipes, users, backups.",
  reports: "The nine PRD reports, each exported to Excel (CSV).",
  audit: "Who changed what and when, including overrides.",
};

export function PendingScreen({ screen }: { screen: ScreenKey }) {
  return (
    <div className="screen-enter mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader section="Vortex ERP" title={screens[screen].title} />
      <section className="max-w-2xl border-y border-stone-200 py-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#925515]">Module not built yet</p>
        <p className="text-sm leading-6 text-stone-600">{stories[screen]}</p>
      </section>
    </div>
  );
}

export function ForbiddenScreen() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <PageHeader title="Not available" supporting="Your profile can't open this screen. Ask the Owner if you need access." />
    </div>
  );
}

export function NotFoundScreen() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <PageHeader title="Page not found" supporting="Check the address, or use the menu." />
    </div>
  );
}
