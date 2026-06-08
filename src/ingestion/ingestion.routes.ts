import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/http';
import type { Logger } from '../shared/logger';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

// Keep files in memory (max 20 MB). For large files, swap to disk/object storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function ingestionRoutes(logger: Logger): Router {
  const controller = new IngestionController(new IngestionService(logger));
  const router = Router();

  router.post('/', upload.single('file'), asyncHandler(controller.upload));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.getOne));

  return router;
}
