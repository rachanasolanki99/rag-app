import { Request, Response } from 'express';
import { IngestionService } from './ingestion.service';

/** Translates HTTP <-> service calls. No business logic lives here. */
export class IngestionController {
  constructor(private readonly service: IngestionService) {}

  upload = async (req: Request, res: Response): Promise<void> => {
    const doc = await this.service.ingest(req.file as Express.Multer.File);
    res.status(202).json({
      message: 'Document accepted for processing',
      document: doc,
    });
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    res.json({ documents: await this.service.list() });
  };

  getOne = async (req: Request, res: Response): Promise<void> => {
    res.json({ document: await this.service.getById(req.params.id) });
  };
}
