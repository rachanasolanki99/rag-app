import { pool } from '../db/pool';
import type { DocumentRecord, DocumentStatus } from '../shared/types';

/**
 * Data-access for the `documents` table. Repositories are the ONLY layer that
 * writes SQL; services depend on these methods, not on the pool directly.
 */
export const documentsRepository = {
  async create(id: string, filename: string, mimeType: string): Promise<DocumentRecord> {
    const { rows } = await pool.query<DocumentRecord>(
      `INSERT INTO documents (id, filename, mime_type, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [id, filename, mimeType],
    );
    return rows[0];
  },

  async findById(id: string): Promise<DocumentRecord | null> {
    const { rows } = await pool.query<DocumentRecord>('SELECT * FROM documents WHERE id = $1', [id]);
    return rows[0] ?? null;
  },

  async list(): Promise<DocumentRecord[]> {
    const { rows } = await pool.query<DocumentRecord>(
      'SELECT * FROM documents ORDER BY created_at DESC',
    );
    return rows;
  },

  async setStatus(id: string, status: DocumentStatus, error: string | null = null): Promise<void> {
    await pool.query(
      `UPDATE documents SET status = $2, error = $3, updated_at = now() WHERE id = $1`,
      [id, status, error],
    );
  },

  async markCompleted(id: string, chunkCount: number): Promise<void> {
    await pool.query(
      `UPDATE documents
       SET status = 'completed', chunk_count = $2, error = NULL, updated_at = now()
       WHERE id = $1`,
      [id, chunkCount],
    );
  },
};
