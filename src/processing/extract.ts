import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

/**
 * Converts a raw document buffer into plain text based on its MIME type.
 * Supports PDF, DOCX, and plain text / Markdown.
 */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Markdown, plain text, or unknown text-like content.
  return buffer.toString('utf-8');
}
