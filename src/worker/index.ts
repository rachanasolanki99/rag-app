import { startTracing } from '../shared/tracing';
startTracing('worker-service'); // must run before other instrumented imports

import http from 'http';
import type { ConsumeMessage } from 'amqplib';
import { config } from '../config';
import { migrate } from '../db/migrate';
import { closeQueue, getChannel } from '../queue/rabbitmq';
import { documentsRepository } from '../repositories/documents.repository';
import { createLogger } from '../shared/logger';
import type { IngestJob } from '../shared/types';
import { DocumentProcessor } from './processor';

const logger = createLogger('worker-service');
const processor = new DocumentProcessor(logger);

/**
 * Worker entrypoint. Polls (via push subscription) the durable queue and
 * processes one document at a time (prefetch=1). On unrecoverable failure the
 * document is marked "failed" and the message is acked so it is not redelivered
 * forever — the failure is observable via GET /documents.
 */
async function main(): Promise<void> {
  await migrate(logger);
  const channel = await getChannel(logger);

  await channel.consume(config.INGESTION_QUEUE, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    let job: IngestJob | undefined;
    try {
      job = JSON.parse(msg.content.toString()) as IngestJob;
      await processor.process(job);
      channel.ack(msg);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err, documentId: job?.documentId }, 'Failed to process document');
      if (job?.documentId) {
        await documentsRepository.setStatus(job.documentId, 'failed', error).catch(() => undefined);
      }
      channel.ack(msg); // give up after internal retries; state is persisted as "failed"
    }
  });

  logger.info('Worker is consuming jobs');
  startHealthServer();
}

/** Minimal health server so the container has a liveness/readiness probe. */
function startHealthServer(): void {
  const port = config.INGESTION_PORT + 100; // e.g. 4101
  http
    .createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'worker-service' }));
        return;
      }
      res.writeHead(404).end();
    })
    .listen(port, () => logger.info({ port }, 'Worker health server listening'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});

process.on('SIGTERM', () => {
  closeQueue().finally(() => process.exit(0));
});
