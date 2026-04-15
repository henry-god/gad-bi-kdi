/**
 * Prompt Composer Service
 * 
 * Combines user input + knowledge rules + template requirements into
 * structured prompts for LLM document generation.
 * 
 * This is the "brain" that eliminates repeated prompting.
 * The system prompt includes ALL relevant rules permanently.
 * 
 * TODO (Claude Code - Phase 3):
 * - Build system prompt from template rules (must-write, must-not-write, tone)
 * - Inject knowledge context from matched categories
 * - Format user input data as structured context
 * - Support multi-source fusion (OCR text + transcript + manual input)
 * - Return formatted prompt ready for Claude/Gemini API call
 */

import KnowledgeService from './knowledge-service';

interface ComposerInput {
  templateId: string;
  userData: Record<string, string>;
  ocrText?: string;           // From PDF OCR (Phase 2)
  transcript?: string;         // From voice STT (Phase 4)
  additionalContext?: string;  // Extra context from user
  knowledgeCategories?: string[];
}

interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    templateId: string;
    rulesApplied: string[];
    knowledgeUsed: string[];
  };
}

export class PromptComposer {
  private knowledgeService: KnowledgeService;

  constructor() {
    this.knowledgeService = new KnowledgeService();
  }

  compose(input: ComposerInput): ComposedPrompt {
    const rules = this.knowledgeService.loadRules(input.templateId);

    const systemPrompt = `You are a Cambodian government document drafting assistant.
You are generating a ${rules.documentType} (${rules.documentTypeKm}).

MANDATORY REQUIREMENTS - You MUST include:
${rules.mustWrite.map((r, i) => `${i + 1}. ${r}`).join('\n')}

PROHIBITED CONTENT - You MUST NOT include:
${rules.mustNotWrite.map((r, i) => `${i + 1}. ${r}`).join('\n')}

TONE & STYLE:
- Register: ${rules.toneGuidelines.register}
- Honorifics: ${rules.toneGuidelines.honorifics}
- Voice: ${rules.toneGuidelines.voice}
- Politeness: ${rules.toneGuidelines.politeness}

STRUCTURE RULES:
${JSON.stringify(rules.structureRules, null, 2)}

Output the document content in Khmer. Follow the exact structure required.
Do not add explanations or meta-commentary. Output only the document content.`;

    const userParts: string[] = [];
    
    if (input.userData) {
      userParts.push(`DOCUMENT METADATA:\n${JSON.stringify(input.userData, null, 2)}`);
    }
    if (input.ocrText) {
      userParts.push(`REFERENCE DOCUMENT (OCR extracted):\n${input.ocrText}`);
    }
    if (input.transcript) {
      userParts.push(`MEETING TRANSCRIPT (cleaned):\n${input.transcript}`);
    }
    if (input.additionalContext) {
      userParts.push(`ADDITIONAL CONTEXT:\n${input.additionalContext}`);
    }

    const userPrompt = userParts.join('\n\n---\n\n');

    return {
      systemPrompt,
      userPrompt,
      metadata: {
        templateId: input.templateId,
        rulesApplied: [input.templateId],
        knowledgeUsed: input.knowledgeCategories || [],
      },
    };
  }
}

export default PromptComposer;
