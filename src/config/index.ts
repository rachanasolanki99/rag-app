import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralized, validated configuration.
 *
 * Every service imports this single module instead of reading `process.env`
 * directly. Validation happens once at startup so misconfiguration fails fast
 * with a clear message rather than surfacing as a confusing runtime error.
 */
const schema = z.object({
  INGESTION_PORT: z.coerce.number().default(4001),
  QUERY_PORT: z.coerce.number().default(4002),

  API_KEY: z.string().min(1, 'API_KEY is required'),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  RABBITMQ_URL: z.string().min(1),
  INGESTION_QUEUE: z.string().default('document.ingest'),

  LLM_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  EMBEDDING_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  EMBEDDING_DIM: z.coerce.number().default(768),

  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_EMBED_MODEL: z.string().default('text-embedding-004'),
  GEMINI_CHAT_MODEL: z.string().default('gemini-1.5-flash'),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_EMBED_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),

  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(200),
  RETRIEVAL_TOP_K: z.coerce.number().default(4),

  LOG_LEVEL: z.string().default('info'),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
