/**
 * Output Service
 * 
 * Handles document export: DOCX download, PDF conversion,
 * preview generation, and file storage.
 * 
 * TODO (Claude Code):
 * - Phase 1: Return DOCX buffer for download
 * - Phase 2: Add PDF conversion via LibreOffice headless
 * - Phase 5: Add MinIO storage for persistent files
 * - Phase 5: Add version management
 */

export class OutputService {

  async exportDOCX(buffer: Buffer, filename: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    return {
      buffer,
      filename: `${filename}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // Phase 2: PDF conversion
  // async exportPDF(docxBuffer: Buffer, filename: string): Promise<{ buffer: Buffer; filename: string }> { ... }

  // Phase 5: Save to storage
  // async saveToStorage(buffer: Buffer, path: string): Promise<string> { ... }

  // Phase 5: Version management
  // async createVersion(documentId: string, buffer: Buffer): Promise<number> { ... }
}

export default OutputService;
