import { PROFILES, type AuthUser, type ProfileName } from "../../shared/types";
import { createSession, destroySession, hashPin, setSessionProfile, validatePin, verifyPin } from "../auth";
import { audit } from "../audit";
import { one } from "../db";
import { HttpError, readJson, requireUser, type Router } from "../http";

function toAuthUser(user: { id: number; name: string; phone: string; profiles: ProfileName[]; profile: ProfileName; mustChangePin: boolean }): AuthUser {
  return { id: user.id, name: user.name, phone: user.phone, profiles: user.profiles, profile: user.profile, mustChangePin: user.mustChangePin };
}

function normalizePhone(phone: unknown): string {
  if (typeof phone !== "string") throw new HttpError(400, "Enter your phone number.");
  return phone.replace(/\D/g, "").replace(/^254/, "0");
}

export function registerAuth(router: Router) {
  router.post("/auth/login", async (ctx) => {
    const body = await readJson<{ phone?: string; pin?: string }>(ctx);
    const phone = normalizePhone(body.phone);
    const pin = validatePin(body.pin);
    const user = await one<{ id: number; name: string; phone: string; pin_hash: string; profiles: ProfileName[]; must_change_pin: boolean; active: boolean }>(
      ctx.db,
      "SELECT id, name, phone, pin_hash, profiles, must_change_pin, active FROM users WHERE regexp_replace(phone, '\\D', '', 'g') = $1",
      [phone],
    );
    if (!user || !user.active || !verifyPin(pin, user.pin_hash)) {
      throw new HttpError(401, "Phone number or PIN is wrong.", "BAD_LOGIN");
    }
    const profile = user.profiles[0];
    const token = await createSession(ctx.db, user.id, profile);
    await audit(ctx.db, { id: user.id, name: user.name, phone: user.phone, profiles: user.profiles, profile, mustChangePin: user.must_change_pin }, {
      table: "users", recordId: user.id, action: "login",
    });
    return {
      token,
      user: toAuthUser({ id: user.id, name: user.name, phone: user.phone, profiles: user.profiles, profile, mustChangePin: user.must_change_pin }),
    };
  });

  router.post("/auth/logout", async (ctx) => {
    const authed = requireUser(ctx);
    await destroySession(ctx.db, authed.token);
    return { ok: true };
  });

  router.get("/auth/me", async (ctx) => ({ user: toAuthUser(requireUser(ctx).user) }));

  // One person can hold more than one profile; they choose which one they are working as.
  router.post("/auth/profile", async (ctx) => {
    const authed = requireUser(ctx);
    const { profile } = await readJson<{ profile?: ProfileName }>(ctx);
    if (!profile || !PROFILES.includes(profile) || !authed.user.profiles.includes(profile)) {
      throw new HttpError(403, "You don't hold that profile.");
    }
    await setSessionProfile(ctx.db, authed.token, profile);
    return { user: toAuthUser({ ...authed.user, profile }) };
  });

  router.post("/auth/pin", async (ctx) => {
    const authed = requireUser(ctx);
    const body = await readJson<{ currentPin?: string; newPin?: string }>(ctx);
    const current = validatePin(body.currentPin);
    const next = validatePin(body.newPin);
    const row = await one<{ pin_hash: string }>(ctx.db, "SELECT pin_hash FROM users WHERE id = $1", [authed.user.id]);
    if (!row || !verifyPin(current, row.pin_hash)) throw new HttpError(400, "Current PIN is wrong.");
    if (current === next) throw new HttpError(400, "Choose a different PIN.");
    await ctx.db.query("UPDATE users SET pin_hash = $2, must_change_pin = false WHERE id = $1", [authed.user.id, hashPin(next)]);
    await audit(ctx.db, authed.user, { table: "users", recordId: authed.user.id, action: "change_pin" });
    return { user: toAuthUser({ ...authed.user, mustChangePin: false }) };
  });
}
