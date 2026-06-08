import { config } from '../config';
import { pool } from './pool';
import type { Logger } from '../shared/logger';

/**
 * Idempotent schema migration run on service startup.
 *
 * The embedding column dimension is templated from EMBEDDING_DIM because
 * pgvector requires a fixed dimension and different providers emit different
 * sizes (mock/gemini=768, openai-3-small=1536).
 */
export async function migrate(logger: Logger): Promise<void> {
  const dim = config.EMBEDDING_DIM;

  await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id           UUID PRIMARY KEY,
      filename     TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      chunk_count  INTEGER NOT NULL DEFAULT 0,
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chunks (
      id           UUID PRIMARY KEY,
      document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index  INTEGER NOT NULL,
      content      TEXT NOT NULL,
      embedding    vector(${dim}) NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);',
  );

  // Approximate-nearest-neighbour index for fast cosine similarity search.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `);

  logger.info({ embeddingDim: dim }, 'Database schema is up to date');
}
