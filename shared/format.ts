// Kenyan formats: KSh with comma thousands, Nairobi time (UTC+3, no daylight saving).

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}KSh ${moneyFormat.format(Math.abs(value))}`;
}

export function formatAmount(value: number): string {
  return moneyFormat.format(value);
}

export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}KSh ${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}KSh ${(abs / 1_000).toFixed(0)}K`;
  return formatMoney(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function parseDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatKenyanDate(date: string): string {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShortDate(date: string): string {
  const d = parseDate(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${LONG_MONTHS[m - 1]} ${year}`;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function nairobiNow(): Date {
  return new Date(Date.now() + NAIROBI_OFFSET_MS);
}

export function nairobiToday(): string {
  return nairobiNow().toISOString().slice(0, 10);
}

export function nairobiHour(): number {
  return nairobiNow().getUTCHours();
}

// ISO timestamp (UTC) -> "14:05" Nairobi time.
export function formatTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + NAIROBI_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  const local = new Date(new Date(iso).getTime() + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);
  return `${formatKenyanDate(local)} · ${formatTime(iso)}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/;
export const MPESA_CODE_PATTERN = /^[A-Z0-9]{10}$/;

// 0712 345 678 -> 254712345678 for wa.me links.
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}
