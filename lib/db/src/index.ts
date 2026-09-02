import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazily create the pool/db on first use instead of at import time. Routes
// that don't touch the database (health check, static frontend, music
// search, etc.) must keep working even when DATABASE_URL isn't configured
// yet — throwing at module load would crash the entire process before it
// can start listening, taking the whole app down with it.
let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<typeof schema> | undefined;

function assertDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: assertDatabaseUrl() });
  }
  return _pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getDb(), prop, receiver);
    },
  },
);

export * from "./schema";
