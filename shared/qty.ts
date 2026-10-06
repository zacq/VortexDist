// Bottles first (PRD rule 1): everything is stored in bottles; boxes are only how it is shown.

export interface Qty {
  boxes: number;
  bottles: number;
}

export function toBottles(boxes: number, bottles: number, perBox: number): number {
  return Math.max(0, Math.floor(boxes || 0)) * perBox + Math.max(0, Math.floor(bottles || 0));
}

export function totalBottles(qty: Qty, perBox: number): number {
  return toBottles(qty.boxes, qty.bottles, perBox);
}

// Works for negative values too (adjustments): sign is kept on both parts.
export function toBoxes(bottles: number, perBox: number): Qty {
  const sign = bottles < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(bottles));
  return { boxes: sign * Math.floor(abs / perBox), bottles: sign * (abs % perBox) };
}

export function normalizeQty(boxes: number, bottles: number, perBox: number): Qty {
  return toBoxes(toBottles(boxes, bottles, perBox), perBox);
}

export function formatQty(qty: Qty): string {
  const negative = qty.boxes < 0 || qty.bottles < 0;
  const boxes = Math.abs(qty.boxes);
  const bottles = Math.abs(qty.bottles);
  const prefix = negative ? "−" : "";
  if (boxes > 0 && bottles > 0) return `${prefix}${boxes.toLocaleString("en-US")} bx + ${bottles} btl`;
  if (boxes > 0) return `${prefix}${boxes.toLocaleString("en-US")} bx`;
  if (bottles > 0) return `${prefix}${bottles} btl`;
  return "0";
}

export function formatBottlesAsQty(bottles: number, perBox: number): string {
  return formatQty(toBoxes(bottles, perBox));
}
