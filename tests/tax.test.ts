import assert from "node:assert/strict";
import { test } from "node:test";
import { toBottles, toBoxes, formatQty } from "../shared/qty";
import { exciseFor, lineTax, netPerBottle, totalsForLines, vatFromInclusive } from "../shared/tax";

test("per-bottle breakdown matches PRD v2", () => {
  assert.deepEqual(lineTax({ bottles: 1, pricePerBottle: 200, sizeMl: 100 }), { total: 200, vat: 27.59, exVat: 172.41, excise: 40, net: 132.41 });
  assert.deepEqual(lineTax({ bottles: 1, pricePerBottle: 220, sizeMl: 200 }), { total: 220, vat: 30.34, exVat: 189.66, excise: 80, net: 109.66 });
  assert.deepEqual(lineTax({ bottles: 1, pricePerBottle: 1000, sizeMl: 750 }), { total: 1000, vat: 137.93, exVat: 862.07, excise: 300, net: 562.07 });
});

test("full-box equivalents match PRD v2", () => {
  assert.equal(vatFromInclusive(4800), 662.07);
  assert.equal(vatFromInclusive(2640), 364.14);
  assert.equal(vatFromInclusive(12000), 1655.17);
  assert.equal(exciseFor(24, 100), 960);
  assert.equal(exciseFor(12, 750), 3600);
});

test("worked invoice totals match PRD v2", () => {
  const totals = totalsForLines([
    { bottles: 240, pricePerBottle: 200, sizeMl: 100 },
    { bottles: 240, pricePerBottle: 220, sizeMl: 200 },
    { bottles: 60, pricePerBottle: 1000, sizeMl: 750 },
    { bottles: 6, pricePerBottle: 200, sizeMl: 100 },
  ]);
  assert.equal(totals.totalIncl, 162000);
  assert.equal(totals.vat, 22344.83);
  assert.equal(totals.totalExVat, 139655.17);
  assert.equal(totals.excise, 47040);
  assert.equal(totals.netToVortex, 92615.17);
  assert.equal(totals.bottles, 546);
});

test("price that does not cover VAT and excise leaves nothing for Vortex", () => {
  assert.ok(netPerBottle(200, 100) > 0);
  assert.ok(netPerBottle(90, 200) <= 0);
});

test("bottles first: boxes + bottles conversions", () => {
  assert.equal(toBottles(2, 5, 24), 53);
  assert.deepEqual(toBoxes(13200, 24), { boxes: 550, bottles: 0 });
  assert.equal(formatQty(toBoxes(246, 24)), "10 bx + 6 btl");
  assert.equal(formatQty(toBoxes(-30, 24)), "−1 bx + 6 btl");
});
