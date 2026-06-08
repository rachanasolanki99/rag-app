import type { Logger } from './logger';

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  logger: Logger;
  label: string;
}

/**
 * Runs `fn` with exponential backoff (baseDelay * 2^attempt) plus jitter.
 * Used for transient failures such as LLM/API rate limits.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.retries) break;
      const delay = opts.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      opts.logger.warn({ label: opts.label, attempt: attempt + 1, delay }, 'Retrying after failure');
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
