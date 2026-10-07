import type { CreditStatus } from "./credit";

export type DashboardPeriod = "today" | "month" | "lastMonth";

export interface DashboardData {
  today: string;
  period: { key: DashboardPeriod; from: string; to: string };
  owedToKra: {
    outputVat: number;
    inputVat: number;
    vatPayable: number;
    excise: number;
    ethanolExcisePaid: number;
    total: number;
  };
  nextPayments: { kind: "VAT" | "Excise"; month: string; amount: number; due: string; daysLeft: number }[];
  glance: {
    sales: { total: number; invoices: number; bottles: number };
    cash: { total: number; payments: number; mpesa: number; bank: number; cash: number };
    produced: { boxes: number; bottles: number; skus: number };
    tax: { vat: number; excise: number };
  };
  stock: {
    dayStatus: "Open" | "Closed" | "Reopened";
    closeNudge: boolean;
    rows: { sku_id: number; code: string; label: string; perBox: number; opening: number; produced: number; sold: number; adjustments: number; closing: number }[];
    hiddenEmpty: number;
  };
  creditWatch: {
    rows: { customer_id: number; name: string; balance: number; limit: number; pctUsed: number; status: CreditStatus; reason: string | null }[];
    unpaidTotal: number;
    unpaidTax: number;
  };
  ageing: { d0_30: number; d31_60: number; d61_90: number; over90: number };
  sales: { date: string; total: number }[];
  alerts: { tone: "red" | "amber" | "grey" | "green"; text: string; link?: string }[];
  recentInvoices: {
    id: number;
    number: string;
    date: string;
    customer: string;
    total: number;
    payment: "Paid" | "Part paid" | "Unpaid" | "Overdue";
    dispatch: "Dispatched" | "Part dispatched" | "Not dispatched";
    etims: boolean;
  }[];
}
