/** Lifecycle of a document as it moves through the async ingestion pipeline. */
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentRecord {
  id: string;
  filename: string;
  mime_type: string;
  status: DocumentStatus;
  chunk_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Message published to the queue when a new document needs processing. */
export interface IngestJob {
  documentId: string;
  filename: string;
  mimeType: string;
  /** Base64-encoded file content (kept simple; see README trade-offs for object storage). */
  contentBase64: string;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  distance: number;
}

export interface QueryAnswer {
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
  }>;
}
