import { startTracing } from '../shared/tracing';
startTracing('ingestion-service'); // must run before other instrumented imports

import express from 'express';
import pinoHttp from 'pino-http';
import { config } from '../config';
import { migrate } from '../db/migrate';
import { createLogger } from '../shared/logger';
import { apiKeyAuth, errorHandler } from '../shared/http';
import { healthRoutes } from '../shared/health';
import { ingestionRoutes } from './ingestion.routes';

const logger = createLogger('ingestion-service');

async function main(): Promise<void> {
  await migrate(logger);

  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  // Health checks are public; everything else requires an API key.
  app.use('/', healthRoutes('ingestion-service'));
  app.use('/documents', apiKeyAuth, ingestionRoutes(logger));

  app.use(errorHandler(logger));

  app.listen(config.INGESTION_PORT, () => {
    logger.info({ port: config.INGESTION_PORT }, 'Ingestion service listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start ingestion service');
  process.exit(1);
});
