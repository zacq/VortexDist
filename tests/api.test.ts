import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Runs the real Netlify function handler against a throwaway PGlite database.
delete process.env.NETLIFY_DATABASE_URL;
delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = mkdtempSync(join(tmpdir(), "vortex-test-"));

const { handle } = await import("../server/app");

async function call(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const response = await handle(new Request(`http://localhost/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }));
  return { status: response.status, body: await response.json() };
}

test("migrations, owner sign-in, PIN change and bootstrap", async () => {
  assert.equal((await call("/health")).status, 200);

  const unauthenticated = await call("/bootstrap");
  assert.equal(unauthenticated.status, 401);

  const wrong = await call("/auth/login", { body: { phone: "0700 000 001", pin: "9999" } });
  assert.equal(wrong.status, 401);

  const login = await call("/auth/login", { body: { phone: "0700 000 001", pin: "1234" } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.profile, "Owner");
  assert.equal(login.body.user.mustChangePin, true);
  const token: string = login.body.token;

  const pin = await call("/auth/pin", { body: { currentPin: "1234", newPin: "4321" }, token });
  assert.equal(pin.status, 200);
  assert.equal(pin.body.user.mustChangePin, false);

  const boot = await call("/bootstrap", { token });
  assert.equal(boot.status, 200);
  assert.equal(boot.body.skus.length, 15);
  assert.deepEqual(boot.body.rates, { vat: 0.16, excisePerCl: 10 });
  const sku011 = boot.body.skus.find((s: { code: string }) => s.code === "011");
  assert.equal(sku011.price_per_bottle, 200);
  assert.equal(sku011.bottles_per_box, 24);
  assert.equal(sku011.abv, 0.4);

  assert.equal((await call("/auth/logout", { body: {}, token })).status, 200);
  assert.equal((await call("/auth/me", { token })).status, 401);
});
