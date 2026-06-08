import crypto from 'crypto';
import { config } from '../config';
import type { ChatProvider, EmbeddingProvider } from './types';

/**
 * Zero-dependency providers so the whole pipeline runs without any API key.
 *
 * - Embeddings are deterministic, seeded from word hashes, then L2-normalized.
 *   They are NOT semantically meaningful, but they are stable and let vector
 *   search + the full data flow work end-to-end for demos and tests.
 * - The chat provider returns an extractive answer built from the retrieved
 *   context, which is enough to demonstrate the RAG wiring.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = config.EMBEDDING_DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimension).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const token of tokens) {
      const hash = crypto.createHash('md5').update(token).digest();
      // Spread each token across a few dimensions for a denser signal.
      for (let i = 0; i < 4; i++) {
        const idx = hash[i] % this.dimension;
        vec[idx] += 1;
      }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

export class MockChatProvider implements ChatProvider {
  async generate(_system: string, user: string): Promise<string> {
    // The user prompt already contains the retrieved context block; surface it
    // so the demo answer is clearly grounded in the documents.
    const contextMarker = 'Context:';
    const idx = user.indexOf(contextMarker);
    const context = idx >= 0 ? user.slice(idx + contextMarker.length) : user;
    const snippet = context.trim().split('\n').slice(0, 6).join('\n');
    return [
      '[MOCK ANSWER — set LLM_PROVIDER=gemini or openai for a real LLM response]',
      '',
      'Based on the most relevant document excerpts:',
      snippet,
    ].join('\n');
  }
}
