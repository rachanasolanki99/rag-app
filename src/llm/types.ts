/**
 * Provider-agnostic AI interfaces. The rest of the app depends only on these,
 * so swapping Gemini <-> OpenAI <-> a local model is a one-line config change.
 */
export interface EmbeddingProvider {
  readonly dimension: number;
  /** Returns one embedding vector per input text, in order. */
  embed(texts: string[]): Promise<number[][]>;
}

export interface ChatProvider {
  /** Generates a grounded answer given a system + user prompt. */
  generate(system: string, user: string): Promise<string>;
}
