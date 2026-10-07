import { bearerToken, userForToken } from "./auth";
import { getDb } from "./db";
import { HttpError, json, Router, type Context } from "./http";
import { registerAuth } from "./modules/auth";
import { registerDashboard } from "./modules/dashboard";
import { registerReference } from "./modules/reference";

const router = new Router();
registerAuth(router);
registerReference(router);
registerDashboard(router);

// Requests arrive either as /api/... (local tools) or /.netlify/functions/api/... (Netlify rewrite).
function apiPath(url: URL): string {
  return url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
}

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    const match = router.match(request.method, apiPath(url));
    if (!match) throw new HttpError(404, "Not found.");
    const db = await getDb();
    const token = bearerToken(request);
    const ctx: Context = { request, db, url, params: match.params, token, user: await userForToken(db, token) };
    const result = await match.handler(ctx);
    return result instanceof Response ? result : json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message, code: error.code, details: error.details }, error.status);
    }
    const pgError = error as { code?: string; detail?: string };
    if (pgError.code === "23505") return json({ error: "That value is already in use.", code: "DUPLICATE", details: pgError.detail }, 409);
    console.error(error);
    return json({ error: "Something went wrong on the server." }, 500);
  }
}
