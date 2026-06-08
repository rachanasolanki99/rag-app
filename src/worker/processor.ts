import { getEmbeddingProvider } from '../llm';
import { chunkText } from '../processing/chunk';
import { extractText } from '../processing/extract';
import { chunksRepository } from '../repositories/chunks.repository';
import { documentsRepository } from '../repositories/documents.repository';
import type { Logger } from '../shared/logger';
import { withRetry } from '../shared/retry';
import type { IngestJob } from '../shared/types';

/**
 * Executes the ingestion pipeline for a single document:
 *   extract text -> chunk -> embed -> persist (transactional) -> mark completed.
 *
 * Embedding is wrapped in exponential-backoff retry because external embedding
 * APIs are the most likely source of transient failures (rate limits/network).
 */
export class DocumentProcessor {
  private embedder = getEmbeddingProvider();

  constructor(private readonly logger: Logger) {}

  async process(job: IngestJob): Promise<void> {
    const { documentId, filename, mimeType } = job;
    this.logger.info({ documentId, filename }, 'Processing document');

    await documentsRepository.setStatus(documentId, 'processing');

    const buffer = Buffer.from(job.contentBase64, 'base64');
    const text = await extractText(buffer, mimeType, filename);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('No extractable text content found in document');
    }

    const embeddings = await withRetry(() => this.embedder.embed(chunks), {
      retries: 4,
      baseDelayMs: 500,
      logger: this.logger,
      label: 'embed',
    });

    const stored = await chunksRepository.replaceForDocument(
      documentId,
      chunks.map((content, chunkIndex) => ({
        chunkIndex,
        content,
        embedding: embeddings[chunkIndex],
      })),
    );

    await documentsRepository.markCompleted(documentId, stored);
    this.logger.info({ documentId, chunks: stored }, 'Document processed successfully');
  }
}
