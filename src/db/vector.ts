/** pgvector accepts a literal in the form `[0.1,0.2,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
