import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ProfileName } from "../shared/types";
import { one, type Queryable } from "./db";
import { HttpError } from "./http";

const SESSION_DAYS = 30;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function validatePin(pin: unknown): string {
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) throw new HttpError(400, "PIN must be 4 to 6 digits.");
  return pin;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: number;
  name: string;
  phone: string;
  profiles: ProfileName[];
  profile: ProfileName;
  mustChangePin: boolean;
}

export async function createSession(q: Queryable, userId: number, profile: ProfileName): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await q.query(
    `INSERT INTO sessions (token_hash, user_id, profile, expires_at) VALUES ($1, $2, $3, now() + interval '${SESSION_DAYS} days')`,
    [hashToken(token), userId, profile],
  );
  return token;
}

export async function destroySession(q: Queryable, token: string): Promise<void> {
  await q.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function setSessionProfile(q: Queryable, token: string, profile: ProfileName): Promise<void> {
  await q.query("UPDATE sessions SET profile = $2 WHERE token_hash = $1", [hashToken(token), profile]);
}

export async function userForToken(q: Queryable, token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await one<{ id: number; name: string; phone: string; profiles: ProfileName[]; profile: ProfileName; must_change_pin: boolean }>(
    q,
    `SELECT u.id, u.name, u.phone, u.profiles, s.profile, u.must_change_pin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [hashToken(token)],
  );
  if (!row || !row.profiles.includes(row.profile)) return null;
  return { id: row.id, name: row.name, phone: row.phone, profiles: row.profiles, profile: row.profile, mustChangePin: row.must_change_pin };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}
