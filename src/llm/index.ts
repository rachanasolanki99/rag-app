import { config } from '../config';
import { GeminiChatProvider, GeminiEmbeddingProvider } from './gemini';
import { MockChatProvider, MockEmbeddingProvider } from './mock';
import { OpenAIChatProvider, OpenAIEmbeddingProvider } from './openai';
import type { ChatProvider, EmbeddingProvider } from './types';

/** Factory: returns the embedding provider selected by EMBEDDING_PROVIDER. */
export function getEmbeddingProvider(): EmbeddingProvider {
  switch (config.EMBEDDING_PROVIDER) {
    case 'gemini':
      return new GeminiEmbeddingProvider();
    case 'openai':
      return new OpenAIEmbeddingProvider();
    default:
      return new MockEmbeddingProvider();
  }
}

/** Factory: returns the chat/generation provider selected by LLM_PROVIDER. */
export function getChatProvider(): ChatProvider {
  switch (config.LLM_PROVIDER) {
    case 'gemini':
      return new GeminiChatProvider();
    case 'openai':
      return new OpenAIChatProvider();
    default:
      return new MockChatProvider();
  }
}

export * from './types';
