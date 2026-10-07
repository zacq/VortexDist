import { neon, Pool as NeonPool, types as neonTypes } from "@neondatabase/serverless";
import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import pg from "pg";
import { HttpError } from "./http";
import { migrate } from "./schema";

// Money is numeric(14,2) and counts may be bigint: return JS numbers. Dates stay "YYYY-MM-DD" strings
// so no timezone shift can move a Nairobi business date.
const OID = { int8: 20, numeric: 1700, date: 1082 };
const parsers = {
  [OID.int8]: (value: string) => Number(value),
  [OID.numeric]: (value: string) => Number(value),
  [OID.date]: (value: string) => value,
};
for (const [oid, parse] of Object.entries(parsers)) {
  neonTypes.setTypeParser(Number(oid), parse);
  pg.types.setTypeParser(Number(oid), parse);
}

export type Params = unknown[];

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

interface PoolLike {
  query(text: string, params?: Params): Promise<{ rows: unknown[] }>;
  connect(): Promise<{ query(text: string, params?: Params): Promise<{ rows: unknown[] }>; release(): void }>;
}

async function inTransaction<T>(client: Awaited<ReturnType<PoolLike["connect"]>>, fn: (q: Queryable) => Promise<T>): Promise<T> {
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
  }
}

// Long-lived TCP pool: `netlify dev`'s local database, or any Postgres given as DATABASE_URL.
function poolDb(pool: PoolLike): Db {
  return {
    async query<T>(text: string, params: Params = []) {
      return (await pool.query(text, params)).rows as T[];
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      return inTransaction(await pool.connect(), fn);
    },
    async exec(text: string) {
      await pool.query(text);
    },
  };
}

// Deployed Netlify Database: queries over HTTP with a client that refreshes the connection string;
// transactions open a short-lived WebSocket pool (the Neon pattern for serverless functions).
function serverlessDb(httpClient: ReturnType<typeof neon>, connectionString: () => string): Db {
  const withPool = async <T>(run: (pool: NeonPool) => Promise<T>) => {
    const pool = new NeonPool({ connectionString: connectionString() });
    try {
      return await run(pool);
    } finally {
      await pool.end();
    }
  };
  return {
    async query<T>(text: string, params: Params = []) {
      return (await httpClient.query(text, params)) as T[];
    },
    tx: (fn) => withPool(async (pool) => inTransaction(await pool.connect(), fn)),
    exec: (text) => withPool(async (pool) => { await pool.query(text); }),
  };
}

async function pgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir, { parsers });
  return {
    async query<T>(text: string, params: Params = []) {
      return (await db.query<T>(text, params)).rows;
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      return db.transaction(async (t) => fn({
        async query<R>(text: string, params: Params = []) {
          return (await t.query<R>(text, params)).rows;
        },
      }));
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

// 1. Netlify Database (deployed, or the local one `netlify dev` runs) via @netlify/database, which picks the driver.
// 2. DATABASE_URL / legacy NETLIFY_DATABASE_URL: any Postgres over TCP.
// 3. Nothing configured, outside Netlify: embedded PGlite in .data/ (tests, plain `vite` runs).
async function connect(): Promise<Db> {
  try {
    const netlifyDb = getDatabase();
    if (netlifyDb.driver === "serverless") return serverlessDb(netlifyDb.httpClient, () => netlifyDb.connectionString);
    return poolDb(netlifyDb.pool as unknown as PoolLike);
  } catch (error) {
    if (!(error instanceof MissingDatabaseConnectionError)) throw error;
  }

  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (url) return poolDb(new pg.Pool({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined }) as unknown as PoolLike);

  // Deployed functions run on Lambda with a read-only filesystem, so PGlite can't work there.
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.NETLIFY_DEV !== "true") {
    throw new HttpError(503, "No database is connected. In Netlify, open Data & storage → Database, create a database, then redeploy.", "NO_DATABASE");
  }
  return pgliteDb();
}

let instance: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      const db = await connect();
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
