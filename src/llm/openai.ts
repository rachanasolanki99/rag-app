import OpenAI from 'openai';
import { config } from '../config';
import type { ChatProvider, EmbeddingProvider } from './types';

function client(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when provider is "openai"');
  }
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = config.EMBEDDING_DIM;
  private openai = client();

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.openai.embeddings.create({
      model: config.OPENAI_EMBED_MODEL,
      input: texts,
    });
    return res.data.map((d) => d.embedding as number[]);
  }
}

export class OpenAIChatProvider implements ChatProvider {
  private openai = client();

  async generate(system: string, user: string): Promise<string> {
    const res = await this.openai.chat.completions.create({
      model: config.OPENAI_CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content ?? '';
  }
}
