// Tax engine (PRD v2 "Tax engine"). Calculated per line, rounded to 2 decimals, then summed.

export const DEFAULT_VAT_RATE = 0.16;
export const DEFAULT_EXCISE_PER_CL = 10;
export const DEFAULT_ABV = 0.4;

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON * Math.sign(amount)) * 100) / 100;
}

export function vatFromInclusive(total: number, vatRate = DEFAULT_VAT_RATE): number {
  return roundMoney((total * vatRate) / (1 + vatRate));
}

export function pureAlcoholCl(bottles: number, sizeMl: number, abv = DEFAULT_ABV): number {
  return Math.round(bottles * (sizeMl / 10) * abv * 1000) / 1000;
}

export function exciseFor(bottles: number, sizeMl: number, abv = DEFAULT_ABV, ratePerCl = DEFAULT_EXCISE_PER_CL): number {
  return roundMoney(bottles * (sizeMl / 10) * abv * ratePerCl);
}

export function netToVortex(totalInclusive: number, vat: number, excise: number): number {
  return roundMoney(totalInclusive - vat - excise);
}

export interface LineTaxInput {
  bottles: number;
  pricePerBottle: number;
  sizeMl: number;
  abv?: number;
  vatRate?: number;
  excisePerCl?: number;
}

export interface LineTax {
  total: number;
  vat: number;
  exVat: number;
  excise: number;
  net: number;
}

export function lineTax({ bottles, pricePerBottle, sizeMl, abv = DEFAULT_ABV, vatRate = DEFAULT_VAT_RATE, excisePerCl = DEFAULT_EXCISE_PER_CL }: LineTaxInput): LineTax {
  const total = roundMoney(bottles * pricePerBottle);
  const vat = vatFromInclusive(total, vatRate);
  const excise = exciseFor(bottles, sizeMl, abv, excisePerCl);
  return { total, vat, exVat: roundMoney(total - vat), excise, net: netToVortex(total, vat, excise) };
}

export interface InvoiceTotals {
  totalIncl: number;
  vat: number;
  totalExVat: number;
  excise: number;
  netToVortex: number;
  bottles: number;
}

export function totalsForLines(lines: LineTaxInput[]): InvoiceTotals {
  let totalIncl = 0;
  let vat = 0;
  let excise = 0;
  let bottles = 0;
  for (const line of lines) {
    const tax = lineTax(line);
    totalIncl += tax.total;
    vat += tax.vat;
    excise += tax.excise;
    bottles += line.bottles;
  }
  totalIncl = roundMoney(totalIncl);
  vat = roundMoney(vat);
  excise = roundMoney(excise);
  return { totalIncl, vat, totalExVat: roundMoney(totalIncl - vat), excise, netToVortex: netToVortex(totalIncl, vat, excise), bottles };
}

// Price-list rule: a price that leaves zero or less for Vortex after VAT and excise is rejected.
export function netPerBottle(pricePerBottle: number, sizeMl: number, abv = DEFAULT_ABV, vatRate = DEFAULT_VAT_RATE, excisePerCl = DEFAULT_EXCISE_PER_CL): number {
  return lineTax({ bottles: 1, pricePerBottle, sizeMl, abv, vatRate, excisePerCl }).net;
}
