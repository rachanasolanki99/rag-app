import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { toVectorLiteral } from '../db/vector';
import type { RetrievedChunk } from '../shared/types';

export interface ChunkInput {
  chunkIndex: number;
  content: string;
  embedding: number[];
}

/** Data-access for the `chunks` table (text + pgvector embeddings). */
export const chunksRepository = {
  /**
   * Replaces all chunks for a document inside a single transaction so a
   * re-processed document never ends up with a mix of old and new chunks.
   */
  async replaceForDocument(documentId: string, chunks: ChunkInput[]): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);

      for (const c of chunks) {
        await client.query(
          `INSERT INTO chunks (id, document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), documentId, c.chunkIndex, c.content, toVectorLiteral(c.embedding)],
        );
      }

      await client.query('COMMIT');
      return chunks.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Cosine-distance nearest-neighbour search. `<=>` is pgvector's cosine
   * distance operator (smaller = more similar).
   */
  async search(queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]> {
    const { rows } = await pool.query(
      `SELECT
         c.id            AS "chunkId",
         c.document_id   AS "documentId",
         d.filename      AS "filename",
         c.chunk_index   AS "chunkIndex",
         c.content       AS "content",
         c.embedding <=> $1 AS "distance"
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       ORDER BY c.embedding <=> $1
       LIMIT $2`,
      [toVectorLiteral(queryEmbedding), topK],
    );
    return rows as RetrievedChunk[];
  },
};
