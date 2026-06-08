import { Pool } from 'pg';
import { config } from '../config';

/**
 * Single shared connection pool per process. `pg` handles pooling internally;
 * we cap it conservatively so many service replicas don't exhaust Postgres
 * connection limits on free tiers.
 */
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function closePool(): Promise<void> {
  await pool.end();
}
