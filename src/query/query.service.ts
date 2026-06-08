import { config } from '../config';
import { getChatProvider, getEmbeddingProvider } from '../llm';
import { chunksRepository } from '../repositories/chunks.repository';
import { BadRequestError } from '../shared/errors';
import type { Logger } from '../shared/logger';
import { withRetry } from '../shared/retry';
import type { QueryAnswer, RetrievedChunk } from '../shared/types';

const SYSTEM_PROMPT = [
  'You are a precise technical documentation assistant.',
  'Answer the question using ONLY the provided context.',
  'If the answer is not in the context, say you could not find it in the documents.',
  'Cite sources by their [filename] where relevant.',
].join(' ');

/**
 * Implements the RAG query flow:
 *   embed question -> vector search -> assemble context -> LLM generation.
 */
export class QueryService {
  private embedder = getEmbeddingProvider();
  private chat = getChatProvider();

  constructor(private readonly logger: Logger) {}

  async ask(question: string): Promise<QueryAnswer> {
    if (!question || question.trim().length < 3) {
      throw new BadRequestError('Question must be at least 3 characters');
    }

    const [questionEmbedding] = await withRetry(() => this.embedder.embed([question]), {
      retries: 3,
      baseDelayMs: 500,
      logger: this.logger,
      label: 'embed-question',
    });

    const chunks = await chunksRepository.search(questionEmbedding, config.RETRIEVAL_TOP_K);

    if (chunks.length === 0) {
      return {
        answer: 'No documents have been ingested yet, so I have no context to answer from.',
        sources: [],
      };
    }

    const context = this.buildContext(chunks);
    const userPrompt = `Question: ${question}\n\nContext:\n${context}`;

    const answer = await withRetry(() => this.chat.generate(SYSTEM_PROMPT, userPrompt), {
      retries: 3,
      baseDelayMs: 500,
      logger: this.logger,
      label: 'generate',
    });

    return {
      answer,
      sources: this.dedupeSources(chunks),
    };
  }

  private buildContext(chunks: RetrievedChunk[]): string {
    return chunks
      .map((c) => `[${c.filename} #${c.chunkIndex}]\n${c.content}`)
      .join('\n\n---\n\n');
  }

  private dedupeSources(chunks: RetrievedChunk[]): QueryAnswer['sources'] {
    const seen = new Set<string>();
    const sources: QueryAnswer['sources'] = [];
    for (const c of chunks) {
      const key = `${c.documentId}:${c.chunkIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ documentId: c.documentId, filename: c.filename, chunkIndex: c.chunkIndex });
    }
    return sources;
  }
}
