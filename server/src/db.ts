/**
 * Postgres pool + migrations runner.
 *
 * On startup, applies every migration in `/server/migrations/` in order
 * (lexicographic). Migrations are tracked in a `_migrations` table so they
 * don't replay. Idempotent — safe to run on every boot.
 *
 * Used for:
 *   - players: { user_id, address, privy_did, created_at }
 *   - creatures_cache: chain mirror so we don't read RPC every match
 *   - decks: persisted deck choices keyed by user_id
 *   - matches: completed match records (for /profile match history)
 *   - earned_trait_progress: progression toward bonus trait fusion rewards
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL ?? "";

let _pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (_pool) return _pool;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Configure it in /server/.env (see .env.example).");
  }
  _pool = new pg.Pool({
    connectionString: DATABASE_URL,
    // Sensible production defaults. Bump if you need it.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  _pool.on("error", err => {
    logger.error({ err }, "pg pool error");
  });
  return _pool;
};

export const closePool = async () => {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
};

// -------------------------------------------------------------------------
// Migrations
// -------------------------------------------------------------------------

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

export const runMigrations = async (): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const applied = await client.query<{ id: string }>("SELECT id FROM _migrations ORDER BY id");
    const appliedSet = new Set(applied.rows.map(r => r.id));

    let files: string[];
    try {
      files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    } catch (err) {
      logger.warn({ err, dir: MIGRATIONS_DIR }, "migrations directory not found — skipping");
      return;
    }

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      logger.info({ file }, "applying migration");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations(id) VALUES($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error({ err, file }, "migration failed");
        throw err;
      }
    }
    logger.info({ applied: files.length }, "migrations complete");
  } finally {
    client.release();
  }
};

// -------------------------------------------------------------------------
// Player ops
// -------------------------------------------------------------------------

export type PlayerRecord = {
  user_id: string;
  address: string | null;
  privy_did: string | null;
  created_at: Date;
};

export const upsertPlayer = async (params: {
  address?: string | null;
  privyDid?: string | null;
}): Promise<PlayerRecord> => {
  const pool = getPool();
  const { address = null, privyDid = null } = params;
  // Prefer privy_did as the stable identity; otherwise wallet address.
  const identityCol = privyDid ? "privy_did" : "address";
  const identityVal = privyDid ?? address;
  if (!identityVal) throw new Error("upsertPlayer requires address or privyDid");
  const res = await pool.query<PlayerRecord>(
    `
    INSERT INTO players (address, privy_did)
    VALUES ($1, $2)
    ON CONFLICT (${identityCol}) DO UPDATE
      SET address = EXCLUDED.address,
          privy_did = EXCLUDED.privy_did
    RETURNING user_id, address, privy_did, created_at;
    `,
    [address, privyDid],
  );
  if (!res.rows[0]) throw new Error("upsertPlayer returned no row");
  return res.rows[0];
};

// -------------------------------------------------------------------------
// CLI: `tsx src/db.ts --migrate-only` to run migrations and exit
// -------------------------------------------------------------------------

if (process.argv.includes("--migrate-only")) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    try {
      await runMigrations();
      await closePool();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "migration cli failed");
      process.exit(1);
    }
  })();
}
