// Applies pending migrations to NETLIFY_DATABASE_URL / DATABASE_URL, or the local PGlite store when neither is set.
import { getDb } from "../server/db";

const db = await getDb();
const rows = await db.query<{ version: number; name: string }>("SELECT version, name FROM schema_migrations ORDER BY version");
for (const row of rows) console.log(`applied ${row.version} ${row.name}`);
