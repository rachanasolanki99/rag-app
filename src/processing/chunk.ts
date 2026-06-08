import { config } from '../config';

/**
 * Splits text into overlapping, roughly sentence-aligned chunks.
 *
 * Strategy: accumulate sentences until CHUNK_SIZE is reached, then start a new
 * chunk that carries CHUNK_OVERLAP characters of trailing context. Overlap
 * preserves meaning that would otherwise be cut across a boundary, which
 * improves retrieval quality.
 */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const size = config.CHUNK_SIZE;
  const overlap = Math.min(config.CHUNK_OVERLAP, size - 1);

  // Split on sentence-ish boundaries while keeping the delimiter.
  const sentences = clean.match(/[^.!?\n]+[.!?\n]?/g) ?? [clean];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > size && current.length > 0) {
      chunks.push(current.trim());
      current = overlap > 0 ? current.slice(-overlap) : '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
