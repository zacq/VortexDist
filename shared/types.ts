export const PROFILES = ["Owner", "Accountant", "Sales", "Store", "Dispatch"] as const;
export type ProfileName = (typeof PROFILES)[number];

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  profiles: ProfileName[];
  profile: ProfileName;
  mustChangePin: boolean;
}

export interface Sku {
  id: number;
  code: string;
  product: string;
  product_id: number;
  size_ml: number;
  bottles_per_box: number;
  abv: number;
  price_per_bottle: number;
  active: boolean;
}

export interface CompanySettings {
  name: string;
  kra_pin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  mpesa_paybill: string | null;
  invoice_prefix: string;
  credit_note_prefix: string;
}

export interface TaxRatesNow {
  vat: number;
  excisePerCl: number;
}

export interface Bootstrap {
  today: string;
  company: CompanySettings;
  skus: Sku[];
  rates: TaxRatesNow;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
