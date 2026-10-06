import type { ProfileName } from "../shared/types";
import type { SessionUser } from "./auth";
import type { Db } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export interface Context {
  request: Request;
  db: Db;
  url: URL;
  params: Record<string, string>;
  user: SessionUser | null;
  token: string | null;
}

export interface AuthedContext extends Context {
  user: SessionUser;
  token: string;
}

type Handler = (ctx: Context) => Promise<unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: Method, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, key: string) => { keys.push(key); return "([^/]+)"; })}/?$`);
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get(path: string, handler: Handler) { return this.add("GET", path, handler); }
  post(path: string, handler: Handler) { return this.add("POST", path, handler); }
  put(path: string, handler: Handler) { return this.add("PUT", path, handler); }

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    let pathMatched = false;
    for (const route of this.routes) {
      const found = route.pattern.exec(path);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]));
      return { handler: route.handler, params };
    }
    if (pathMatched) throw new HttpError(405, "Method not allowed.");
    return null;
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function csv(filename: string, rows: (string | number | null | undefined)[][]): Response {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel opens UTF-8 (KSh, en dashes) correctly.
  const body = "﻿" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function readJson<T = Record<string, unknown>>(ctx: Context): Promise<T> {
  try {
    return (await ctx.request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

export function requireUser(ctx: Context): AuthedContext {
  if (!ctx.user || !ctx.token) throw new HttpError(401, "Please sign in.", "UNAUTHENTICATED");
  return ctx as AuthedContext;
}

export function requireProfile(ctx: Context, ...allowed: ProfileName[]): AuthedContext {
  const authed = requireUser(ctx);
  if (!allowed.includes(authed.user.profile)) {
    throw new HttpError(403, `The ${authed.user.profile} profile can't do this.`, "FORBIDDEN");
  }
  return authed;
}
