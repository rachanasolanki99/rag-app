import { Router } from 'express';
import { asyncHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

export function queryRoutes(logger: Logger): Router {
  const controller = new QueryController(new QueryService(logger));
  const router = Router();

  router.post('/', asyncHandler(controller.ask));

  return router;
}
