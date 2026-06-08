import { startTracing } from '../shared/tracing';
startTracing('query-service'); // must run before other instrumented imports

import express from 'express';
import pinoHttp from 'pino-http';
import { config } from '../config';
import { createLogger } from '../shared/logger';
import { apiKeyAuth, errorHandler } from '../shared/http';
import { healthRoutes } from '../shared/health';
import { queryRoutes } from './query.routes';

const logger = createLogger('query-service');

async function main(): Promise<void> {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use('/', healthRoutes('query-service'));
  app.use('/query', apiKeyAuth, queryRoutes(logger));

  app.use(errorHandler(logger));

  app.listen(config.QUERY_PORT, () => {
    logger.info({ port: config.QUERY_PORT }, 'Query service listening');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start query service');
  process.exit(1);
});
