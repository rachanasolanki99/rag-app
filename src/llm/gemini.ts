import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import type { ChatProvider, EmbeddingProvider } from './types';

function client(): GoogleGenerativeAI {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when provider is "gemini"');
  }
  return new GoogleGenerativeAI(config.GEMINI_API_KEY);
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = config.EMBEDDING_DIM;
  private model = client().getGenerativeModel({ model: config.GEMINI_EMBED_MODEL });

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // Gemini embeds one content at a time via embedContent.
    for (const text of texts) {
      const res = await this.model.embedContent(text);
      out.push(res.embedding.values);
    }
    return out;
  }
}

export class GeminiChatProvider implements ChatProvider {
  private model = client().getGenerativeModel({ model: config.GEMINI_CHAT_MODEL });

  async generate(system: string, user: string): Promise<string> {
    const res = await this.model.generateContent(`${system}\n\n${user}`);
    return res.response.text();
  }
}
