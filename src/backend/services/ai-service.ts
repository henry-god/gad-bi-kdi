/**
 * AI Service — Gemini only (post V5-M1).
 *
 * Orchestrates LLM calls using prompt-composer + knowledge-service.
 * Calls Gemini when GEMINI_API_KEY is set; otherwise returns a mocked
 * response so the end-to-end flow is testable offline / in CI.
 *
 * Keep the mock branch in sync with the live branch: same prompt
 * composition, same return shape — the only difference is whether we
 * actually hit the network.
 */

import { GoogleGenAI } from '@google/genai';
import { PromptComposer } from './prompt-composer';
import KnowledgeService from './knowledge-service';
import { getSetting } from './settings-service';

export interface GenerateOpts {
  templateId: string;
  userData: Record<string, string>;
  ocrText?: string;
  transcript?: string;
  additionalContext?: string;
}

export interface GenerateResult {
  mode: 'live' | 'mock';
  provider: 'gemini' | 'mock';
  model?: string;
  content: string;
  matchedRules: { mustWrite: string[]; mustNotWrite: string[] };
  schemaMatches: Array<{ category: string; title: string; score: number }>;
  systemPrompt: string;
  userPrompt: string;
  tokensIn?: number;
  tokensOut?: number;
}

const composer = new PromptComposer();
const knowledge = new KnowledgeService();

const SAFETY_MAP: Record<string, string> = {
  BLOCK_NONE: 'BLOCK_NONE',
  BLOCK_LOW: 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM: 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_HIGH: 'BLOCK_ONLY_HIGH',
};

function safetySettings(preset: string) {
  const threshold = SAFETY_MAP[preset] || 'BLOCK_NONE';
  return [
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
  ].map(category => ({ category, threshold }));
}

export async function generateWithAI(opts: GenerateOpts): Promise<GenerateResult> {
  const { rules, schemaMatches } = knowledge.match({
    templateId: opts.templateId,
    content: [opts.userData.body, opts.ocrText, opts.transcript, opts.additionalContext]
      .filter(Boolean)
      .join(' '),
  });

  const { systemPrompt, userPrompt } = composer.compose({
    templateId: opts.templateId,
    userData: opts.userData,
    ocrText: opts.ocrText,
    transcript: opts.transcript,
    additionalContext:
      (opts.additionalContext || '') +
      (schemaMatches.length
        ? '\n\nRELEVANT KNOWLEDGE ENTRIES:\n' +
          schemaMatches
            .map(s => `- [${s.category}] ${s.titleKm || s.title}: ${s.content}`)
            .join('\n')
        : ''),
  });

  const summarizedSchema = schemaMatches.map(s => ({
    category: s.category,
    title: s.titleKm || s.title,
    score: s.score,
  }));
  const matchedRules = {
    mustWrite: rules.mustWrite,
    mustNotWrite: rules.mustNotWrite,
  };

  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      mode: 'mock',
      provider: 'mock',
      content: mockResponse(opts, rules, schemaMatches),
      matchedRules,
      schemaMatches: summarizedSchema,
      systemPrompt,
      userPrompt,
    };
  }

  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.5-flash';
  const temperatureStr = (await getSetting('GEMINI_TEMPERATURE')) || '0.3';
  const temperature = Number.parseFloat(temperatureStr) || 0.3;
  const safetyPreset = (await getSetting('GEMINI_SAFETY_PRESET')) || 'BLOCK_NONE';

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        safetySettings: safetySettings(safetyPreset) as any,
      },
    });

    const content =
      typeof response.text === 'function'
        ? (response as any).text()
        : (response as any).text ?? '';

    const usage = (response as any).usageMetadata;

    return {
      mode: 'live',
      provider: 'gemini',
      model,
      content: String(content || ''),
      matchedRules,
      schemaMatches: summarizedSchema,
      systemPrompt,
      userPrompt,
      tokensIn: usage?.promptTokenCount,
      tokensOut: usage?.candidatesTokenCount,
    };
  } catch (err: any) {
    // Quota / network / auth errors fall back to mock with a visible note
    return {
      mode: 'mock',
      provider: 'mock',
      content: `[ Gemini call failed: ${err.message} — falling back to mock ]\n\n${mockResponse(opts, rules, schemaMatches)}`,
      matchedRules,
      schemaMatches: summarizedSchema,
      systemPrompt,
      userPrompt,
    };
  }
}

/**
 * Enhance a raw Khmer STT transcript — used by stt-service (Phase M5).
 * Lives here so the Gemini client + settings lookup is shared.
 */
export async function enhanceTranscript(raw: string, opts?: { temperature?: number }): Promise<
  { enhanced: string; mode: 'live' | 'mock'; model?: string }
> {
  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey || !raw.trim()) {
    return { enhanced: raw, mode: 'mock' };
  }
  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.5-flash';
  const temperature = opts?.temperature ?? 0.1;
  const system = `You are a professional Khmer government meeting transcript editor.
Input: a raw, potentially noisy Khmer transcript from an automated speech-to-text system.
Fix recognition errors (homophones, dropped endings), add proper punctuation, split into
sentences and speaker turns. Preserve every sentence's meaning — do NOT summarize or
condense. Output formal, official-register Khmer. Return only the cleaned transcript.`;

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: raw,
      config: { systemInstruction: system, temperature },
    });
    const enhanced =
      typeof (response as any).text === 'function'
        ? (response as any).text()
        : (response as any).text ?? raw;
    return { enhanced: String(enhanced || raw), mode: 'live', model };
  } catch {
    return { enhanced: raw, mode: 'mock' };
  }
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onDone: (meta: Omit<GenerateResult, 'content'>) => void;
  onError: (message: string) => void;
}

/**
 * Streaming variant of generateWithAI. Emits incremental tokens via
 * handlers.onToken; finishes with handlers.onDone (or onError). Falls
 * back to a chunked mock stream when GEMINI_API_KEY is absent so the
 * client flow is identical in CI / offline.
 */
export async function generateWithAIStream(opts: GenerateOpts, handlers: StreamHandlers): Promise<void> {
  const { rules, schemaMatches } = knowledge.match({
    templateId: opts.templateId,
    content: [opts.userData.body, opts.ocrText, opts.transcript, opts.additionalContext]
      .filter(Boolean)
      .join(' '),
  });

  const { systemPrompt, userPrompt } = composer.compose({
    templateId: opts.templateId,
    userData: opts.userData,
    ocrText: opts.ocrText,
    transcript: opts.transcript,
    additionalContext:
      (opts.additionalContext || '') +
      (schemaMatches.length
        ? '\n\nRELEVANT KNOWLEDGE ENTRIES:\n' +
          schemaMatches
            .map(s => `- [${s.category}] ${s.titleKm || s.title}: ${s.content}`)
            .join('\n')
        : ''),
  });

  const summarizedSchema = schemaMatches.map(s => ({
    category: s.category,
    title: s.titleKm || s.title,
    score: s.score,
  }));
  const matchedRules = {
    mustWrite: rules.mustWrite,
    mustNotWrite: rules.mustNotWrite,
  };

  const apiKey = await getSetting('GEMINI_API_KEY');
  if (!apiKey) {
    const mock = mockResponse(opts, rules, schemaMatches);
    for (let i = 0; i < mock.length; i += 40) {
      handlers.onToken(mock.slice(i, i + 40));
      await new Promise(r => setTimeout(r, 20));
    }
    handlers.onDone({
      mode: 'mock', provider: 'mock',
      matchedRules, schemaMatches: summarizedSchema,
      systemPrompt, userPrompt,
    });
    return;
  }

  const model = (await getSetting('GEMINI_MODEL')) || 'gemini-2.5-flash';
  const temperatureStr = (await getSetting('GEMINI_TEMPERATURE')) || '0.3';
  const temperature = Number.parseFloat(temperatureStr) || 0.3;
  const safetyPreset = (await getSetting('GEMINI_SAFETY_PRESET')) || 'BLOCK_NONE';

  try {
    const client = new GoogleGenAI({ apiKey });
    const stream = await (client.models as any).generateContentStream({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        safetySettings: safetySettings(safetyPreset) as any,
      },
    });

    let tokensIn: number | undefined;
    let tokensOut: number | undefined;
    for await (const chunk of stream as AsyncIterable<any>) {
      const piece =
        typeof chunk?.text === 'function' ? chunk.text() :
        chunk?.text ?? chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (piece) handlers.onToken(String(piece));
      const usage = chunk?.usageMetadata;
      if (usage?.promptTokenCount != null) tokensIn = usage.promptTokenCount;
      if (usage?.candidatesTokenCount != null) tokensOut = usage.candidatesTokenCount;
    }
    handlers.onDone({
      mode: 'live', provider: 'gemini', model,
      matchedRules, schemaMatches: summarizedSchema,
      systemPrompt, userPrompt, tokensIn, tokensOut,
    });
  } catch (err: any) {
    handlers.onError(err?.message ?? String(err));
  }
}

function mockResponse(
  opts: GenerateOpts,
  rules: { documentType: string; documentTypeKm: string; mustWrite: string[] },
  schema: Array<{ category: string; titleKm?: string; title: string }>,
): string {
  const body = opts.userData.body || '(no draft body provided)';
  const header = [
    `[ MOCK AI OUTPUT · set GEMINI_API_KEY in Settings to enable live Gemini ]`,
    `template: ${opts.templateId} (${rules.documentTypeKm})`,
    schema.length
      ? `matched schema entries: ${schema.map(s => s.titleKm || s.title).join(', ')}`
      : 'no schema matches',
    `applied ${rules.mustWrite.length} must-write rules`,
  ].join('\n');
  return `${header}\n\n---\n\n${body}\n\n(The live Gemini model would tighten register, fix honorifics, and enforce the must-write / must-not-write rules automatically.)`;
}
