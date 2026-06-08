import { migrate } from '../db/migrate';
import { closePool } from '../db/pool';
import { createLogger } from '../shared/logger';

/** Standalone migration entrypoint: `npm run migrate`. */
const logger = createLogger('migrate');

migrate(logger)
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
