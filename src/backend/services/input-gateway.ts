/**
 * Input Gateway Service
 * 
 * Routes incoming files/data to appropriate processors.
 * Returns normalized structured data regardless of input type.
 * 
 * Phase 1: Manual form input only (passthrough)
 * Phase 2: + PDF OCR processing
 * Phase 4: + Audio STT processing
 * 
 * TODO (Claude Code):
 * - Phase 2: Add PDF processing via Google Document AI / PaddleOCR
 * - Phase 4: Add audio processing via Whisper API
 * - Add file type detection and validation
 * - Add batch processing queue (Celery equivalent in Node: BullMQ)
 */

interface InputResult {
  type: 'manual' | 'pdf_ocr' | 'audio_stt' | 'docx_extract' | 'xlsx_extract';
  rawContent: string;
  cleanedContent: string;
  metadata: {
    fileName?: string;
    fileSize?: number;
    pageCount?: number;
    duration?: number;
    language: string;
    confidence?: number;
  };
  entities: {
    names: string[];
    dates: string[];
    organizations: string[];
    references: string[];
  };
}

export class InputGateway {

  async process(input: { type: string; data: any; file?: Buffer }): Promise<InputResult> {
    switch (input.type) {
      case 'manual':
        return this.processManual(input.data);
      case 'pdf':
        return this.processPDF(input.file!, input.data);
      case 'audio':
        return this.processAudio(input.file!, input.data);
      case 'docx':
        return this.processDOCX(input.file!, input.data);
      default:
        throw new Error(`Unsupported input type: ${input.type}`);
    }
  }

  private async processManual(data: Record<string, string>): Promise<InputResult> {
    const content = Object.values(data).join('\n');
    return {
      type: 'manual',
      rawContent: content,
      cleanedContent: content,
      metadata: { language: 'km' },
      entities: { names: [], dates: [], organizations: [], references: [] },
    };
  }

  // Phase 2
  private async processPDF(_file: Buffer, _meta: any): Promise<InputResult> {
    throw new Error('PDF processing not implemented yet (Phase 2)');
  }

  // Phase 4
  private async processAudio(_file: Buffer, _meta: any): Promise<InputResult> {
    throw new Error('Audio processing not implemented yet (Phase 4)');
  }

  // Phase 2
  private async processDOCX(_file: Buffer, _meta: any): Promise<InputResult> {
    throw new Error('DOCX extraction not implemented yet (Phase 2)');
  }
}

export default InputGateway;
