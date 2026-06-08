import { v4 as uuidv4 } from 'uuid';
import { publishJob } from '../queue/rabbitmq';
import { documentsRepository } from '../repositories/documents.repository';
import { BadRequestError, NotFoundError } from '../shared/errors';
import type { Logger } from '../shared/logger';
import type { DocumentRecord, IngestJob } from '../shared/types';

const SUPPORTED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

/**
 * Application logic for document ingestion. It persists a "pending" document
 * row and hands the heavy work (extraction/chunking/embedding) to the worker
 * via the queue, so the HTTP request returns immediately (async ingestion).
 */
export class IngestionService {
  constructor(private readonly logger: Logger) {}

  async ingest(file: Express.Multer.File): Promise<DocumentRecord> {
    if (!file) throw new BadRequestError('A file is required (form field "file")');

    const isSupportedExt = /\.(pdf|docx|md|markdown|txt)$/i.test(file.originalname);
    if (!SUPPORTED.includes(file.mimetype) && !isSupportedExt) {
      throw new BadRequestError(`Unsupported file type: ${file.mimetype || file.originalname}`);
    }

    const id = uuidv4();
    const doc = await documentsRepository.create(id, file.originalname, file.mimetype);

    const job: IngestJob = {
      documentId: id,
      filename: file.originalname,
      mimeType: file.mimetype,
      contentBase64: file.buffer.toString('base64'),
    };
    await publishJob(this.logger, job);

    this.logger.info({ documentId: id, filename: file.originalname }, 'Document queued for ingestion');
    return doc;
  }

  list(): Promise<DocumentRecord[]> {
    return documentsRepository.list();
  }

  async getById(id: string): Promise<DocumentRecord> {
    const doc = await documentsRepository.findById(id);
    if (!doc) throw new NotFoundError(`Document ${id} not found`);
    return doc;
  }
}
