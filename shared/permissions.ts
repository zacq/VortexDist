import type { ProfileName } from "./types";

// PRD v2 permissions table. Shared so the UI hides what the API would refuse.
export type Permission =
  | "dashboard.view"
  | "customers.view"
  | "customers.edit"
  | "credit.set"
  | "invoices.view"
  | "invoices.create"
  | "dispatch.confirm"
  | "creditNotes.raise"
  | "creditNotes.approve"
  | "payments.view"
  | "payments.record"
  | "settings.view"
  | "settings.edit"
  | "materials.view"
  | "materials.record"
  | "stock.view"
  | "stock.record"
  | "stamps.view"
  | "stamps.record"
  | "overrides"
  | "reports.all"
  | "reports.sales"
  | "reports.stock"
  | "audit.view";

const matrix: Record<ProfileName, Permission[]> = {
  Owner: [
    "dashboard.view", "customers.view", "customers.edit", "credit.set", "invoices.view", "invoices.create",
    "dispatch.confirm", "creditNotes.raise", "creditNotes.approve", "payments.view", "payments.record",
    "settings.view", "settings.edit", "materials.view", "materials.record", "stock.view", "stock.record",
    "stamps.view", "stamps.record", "overrides", "reports.all", "reports.sales", "reports.stock", "audit.view",
  ],
  Accountant: [
    "dashboard.view", "customers.view", "invoices.view", "creditNotes.raise", "payments.view", "payments.record",
    "settings.view", "materials.view", "stamps.view", "reports.all", "reports.sales", "reports.stock",
  ],
  Sales: ["customers.view", "customers.edit", "invoices.view", "invoices.create", "payments.view", "settings.view", "stock.view", "reports.sales"],
  Store: ["materials.view", "materials.record", "stock.view", "stock.record", "stamps.view", "reports.stock"],
  Dispatch: ["invoices.view", "dispatch.confirm", "stamps.view", "stamps.record"],
};

export function can(profile: ProfileName, permission: Permission): boolean {
  return matrix[profile].includes(permission);
}

export function profilesWith(permission: Permission): ProfileName[] {
  return (Object.keys(matrix) as ProfileName[]).filter((profile) => matrix[profile].includes(permission));
}
