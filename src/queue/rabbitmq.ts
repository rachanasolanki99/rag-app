import amqp from 'amqplib';
import { config } from '../config';
import type { Logger } from '../shared/logger';

/**
 * Thin RabbitMQ helper used by the ingestion (producer) and worker (consumer)
 * services. Connection is established lazily and retried with backoff because
 * the broker may start a moment after the app in docker-compose.
 *
 * Types are inferred from `amqp.connect` so this stays compatible across
 * amqplib type-definition versions (Connection vs. ChannelModel renames).
 */
type Conn = Awaited<ReturnType<typeof amqp.connect>>;
type Ch = Awaited<ReturnType<Conn['createChannel']>>;

let connection: Conn | null = null;
let channel: Ch | null = null;

async function connectWithRetry(logger: Logger, attempt = 1): Promise<Conn> {
  try {
    return await amqp.connect(config.RABBITMQ_URL);
  } catch (err) {
    if (attempt >= 10) throw err;
    const delayMs = Math.min(1000 * attempt, 5000);
    logger.warn({ attempt, delayMs }, 'RabbitMQ not ready, retrying...');
    await new Promise((r) => setTimeout(r, delayMs));
    return connectWithRetry(logger, attempt + 1);
  }
}

export async function getChannel(logger: Logger): Promise<Ch> {
  if (channel) return channel;

  connection = await connectWithRetry(logger);
  channel = await connection.createChannel();

  // Durable queue so messages survive a broker restart.
  await channel.assertQueue(config.INGESTION_QUEUE, { durable: true });
  // Process one job at a time per worker -> fair dispatch across replicas.
  await channel.prefetch(1);

  logger.info({ queue: config.INGESTION_QUEUE }, 'Connected to RabbitMQ');
  return channel;
}

export async function publishJob(logger: Logger, payload: unknown): Promise<void> {
  const ch = await getChannel(logger);
  ch.sendToQueue(config.INGESTION_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}

export async function closeQueue(): Promise<void> {
  await channel?.close().catch(() => undefined);
  await connection?.close().catch(() => undefined);
  channel = null;
  connection = null;
}
