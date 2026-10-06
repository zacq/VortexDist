import { neon, Pool, types } from "@neondatabase/serverless";
import { migrate } from "./schema";

// Money is numeric(14,2) and counts may be bigint: return JS numbers. Dates stay "YYYY-MM-DD" strings
// so no timezone shift can move a Nairobi business date.
const OID = { int8: 20, numeric: 1700, date: 1082 };
const parsers = {
  [OID.int8]: (value: string) => Number(value),
  [OID.numeric]: (value: string) => Number(value),
  [OID.date]: (value: string) => value,
};
for (const [oid, parse] of Object.entries(parsers)) types.setTypeParser(Number(oid), parse);

export type Params = unknown[];

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

// Netlify DB (Neon) sets NETLIFY_DATABASE_URL; DATABASE_URL works for any other Postgres host.
function connectionString(): string | undefined {
  return process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
}

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    async query<T>(text: string, params: Params = []) {
      return (await sql.query(text, params)) as T[];
    },
    // Interactive transactions need a WebSocket pool; open one per transaction and close it,
    // which is the recommended pattern inside serverless functions.
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      const pool = new Pool({ connectionString: url });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          async query<R>(text: string, params: Params = []) {
            return (await client.query(text, params)).rows as R[];
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
        await pool.end();
      }
    },
    async exec(text: string) {
      const pool = new Pool({ connectionString: url });
      try {
        await pool.query(text);
      } finally {
        await pool.end();
      }
    },
  };
}

async function pgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir, { parsers });
  return {
    async query<T>(text: string, params: Params = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      return pg.transaction(async (t) => fn({
        async query<R>(text: string, params: Params = []) {
          return (await t.query<R>(text, params)).rows;
        },
      }));
    },
    async exec(text: string) {
      await pg.exec(text);
    },
  };
}

let instance: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      const url = connectionString();
      if (!url && process.env.NETLIFY && process.env.CONTEXT) {
        throw new Error("No database configured. Enable Netlify DB or set DATABASE_URL.");
      }
      const db = url ? neonDb(url) : await pgliteDb();
      await migrate(db);
      return db;
    })();
    instance.catch(() => { instance = null; });
  }
  return instance;
}

export async function one<T>(q: Queryable, sql: string, params: Params = []): Promise<T | undefined> {
  return (await q.query<T>(sql, params))[0];
}
