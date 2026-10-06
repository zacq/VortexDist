import { can, type Permission } from "../../shared/permissions";
import type { ProfileName } from "../../shared/types";
import type { IconName } from "../components/Icon";

export interface ScreenDef {
  pattern: string;
  title: string;
  icon: IconName;
  permission: Permission | Permission[];
}

// Brief "Screen map": 14 screens plus reports, audit and account.
export const screens: Record<string, ScreenDef> = {
  dashboard: { pattern: "/", title: "Dashboard", icon: "dashboard", permission: "dashboard.view" },
  invoices: { pattern: "/invoices", title: "Invoices", icon: "invoice", permission: "invoices.view" },
  newInvoice: { pattern: "/invoices/new", title: "New invoice", icon: "plus", permission: "invoices.create" },
  invoice: { pattern: "/invoices/:id", title: "Invoice", icon: "invoice", permission: "invoices.view" },
  customers: { pattern: "/customers", title: "Customers", icon: "users", permission: "customers.view" },
  customer: { pattern: "/customers/:id", title: "Customer", icon: "users", permission: "customers.view" },
  payments: { pattern: "/payments", title: "Payments", icon: "payment", permission: "payments.view" },
  newPayment: { pattern: "/payments/new", title: "Record payment", icon: "payment", permission: "payments.record" },
  stock: { pattern: "/stock", title: "Daily stock register", icon: "box", permission: "stock.view" },
  production: { pattern: "/production", title: "Production", icon: "production", permission: "materials.view" },
  newProduction: { pattern: "/production/new", title: "Record production", icon: "production", permission: "stock.record" },
  materials: { pattern: "/materials", title: "Raw materials", icon: "materials", permission: "materials.view" },
  dispatch: { pattern: "/dispatch", title: "Dispatch queue", icon: "dispatch", permission: "dispatch.confirm" },
  stamps: { pattern: "/stamps", title: "Stamp register", icon: "stamp", permission: "stamps.view" },
  tax: { pattern: "/tax", title: "Tax summary", icon: "tax", permission: "dashboard.view" },
  settings: { pattern: "/settings", title: "Settings", icon: "settings", permission: "settings.view" },
  reports: { pattern: "/reports", title: "Reports", icon: "file", permission: ["reports.sales", "reports.stock"] },
  audit: { pattern: "/audit", title: "Audit log", icon: "clock", permission: "audit.view" },
};

export type ScreenKey = keyof typeof screens;

export interface ProfileNavigation {
  home: string;
  tabs: { label: string; screen: ScreenKey }[];
  more: ScreenKey[];
  primaryAction?: { label: string; icon: IconName; to: string };
}

// Brief "Bottom bar per profile (phone)".
export const profileNavigation: Record<ProfileName, ProfileNavigation> = {
  Owner: {
    home: "/",
    tabs: [
      { label: "Dashboard", screen: "dashboard" },
      { label: "Invoices", screen: "invoices" },
      { label: "Stock", screen: "stock" },
      { label: "Customers", screen: "customers" },
    ],
    more: ["payments", "production", "materials", "dispatch", "stamps", "tax", "reports", "audit", "settings"],
    primaryAction: { label: "New invoice", icon: "plus", to: "/invoices/new" },
  },
  Accountant: {
    home: "/",
    tabs: [
      { label: "Dashboard", screen: "dashboard" },
      { label: "Customers", screen: "customers" },
      { label: "Payments", screen: "payments" },
      { label: "Tax", screen: "tax" },
    ],
    more: ["invoices", "materials", "stamps", "reports", "settings"],
    primaryAction: { label: "Record payment", icon: "payment", to: "/payments/new" },
  },
  Sales: {
    home: "/invoices",
    tabs: [
      { label: "Invoices", screen: "invoices" },
      { label: "Customers", screen: "customers" },
      { label: "Stock", screen: "stock" },
    ],
    more: [],
    primaryAction: { label: "New invoice", icon: "plus", to: "/invoices/new" },
  },
  Store: {
    home: "/stock",
    tabs: [
      { label: "Stock", screen: "stock" },
      { label: "Production", screen: "production" },
      { label: "Materials", screen: "materials" },
    ],
    more: [],
    primaryAction: { label: "Record production", icon: "production", to: "/production/new" },
  },
  Dispatch: {
    home: "/dispatch",
    tabs: [
      { label: "Dispatch queue", screen: "dispatch" },
      { label: "Stamps", screen: "stamps" },
    ],
    more: [],
    primaryAction: { label: "Confirm goods out", icon: "dispatch", to: "/dispatch" },
  },
};

export function canOpen(profile: ProfileName, screen: ScreenKey): boolean {
  const required = screens[screen].permission;
  return (Array.isArray(required) ? required : [required]).some((permission) => can(profile, permission));
}

export function resolveScreen(pathname: string): { key: ScreenKey; params: Record<string, string> } | null {
  // Literal routes ("/invoices/new") are checked before parameterised ones ("/invoices/:id").
  const entries = Object.entries(screens).sort(([, a], [, b]) => Number(a.pattern.includes(":")) - Number(b.pattern.includes(":")));
  for (const [key, def] of entries) {
    const keys: string[] = [];
    const regex = new RegExp(`^${def.pattern.replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return "([^/]+)"; })}/?$`);
    const found = regex.exec(pathname);
    if (found) return { key, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(found[i + 1])])) };
  }
  return null;
}
