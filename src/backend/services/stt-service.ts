/**
 * Speech-to-Text Service — V5-M5.
 *
 * Two-stage pipeline:
 *   1. transcribe() — Google Cloud Speech-to-Text (sync `recognize`,
 *      inline audio ≤ 10 MB / ≤ 60 s). Long-running / GCS upload is
 *      deferred to M5.1.
 *   2. enhance()    — Gemini post-processor cleans punctuation,
 *      homophones, register (see enhanceTranscript in ai-service.ts).
 *
 * Falls back to a realistic Khmer mock when credentials are missing
 * so offline / CI flows stay identical.
 */

import { SpeechClient } from '@google-cloud/speech';
import { getSetting } from './settings-service';
import { enhanceTranscript } from './ai-service';

export interface SttStage {
  stage: 'upload' | 'transcribe' | 'enhance';
  ms: number;
  mode: 'live' | 'mock' | 'skipped';
}

export interface SttResult {
  mode: 'live' | 'mock';
  provider: 'google' | 'mock';
  rawText: string;
  enhancedText: string;
  /** Back-compat alias of enhancedText for older callers. */
  cleanText: string;
  fields: Record<string, string>;
  confidence: number;
  durationSec?: number;
  stages: SttStage[];
}

type EncodingKey =
  | 'LINEAR16'
  | 'FLAC'
  | 'MP3'
  | 'OGG_OPUS'
  | 'MP4'
  | 'ENCODING_UNSPECIFIED';

export function pickEncoding(mimeType: string, filename: string): EncodingKey {
  const mt = (mimeType || '').toLowerCase();
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (mt.includes('wav') || ext === 'wav') return 'LINEAR16';
  if (mt.includes('flac') || ext === 'flac') return 'FLAC';
  if (mt.includes('mpeg') || ext === 'mp3') return 'MP3';
  if (mt.includes('ogg') || ext === 'ogg' || ext === 'opus') return 'OGG_OPUS';
  if (mt.includes('m4a') || mt.includes('mp4') || ext === 'm4a' || ext === 'mp4') return 'MP4';
  return 'ENCODING_UNSPECIFIED';
}

function buildCredentialsFromServiceAccount(json: string):
  | { credentials: { client_email: string; private_key: string }; projectId?: string }
  | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      credentials: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      },
      projectId: parsed.project_id,
    };
  } catch {
    return null;
  }
}

export async function transcribeAudio(opts: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<SttResult> {
  const uploadStart = Date.now();
  const stages: SttStage[] = [];

  const saJson = await getSetting('FIREBASE_SERVICE_ACCOUNT_JSON');
  const sttAuth = saJson ? buildCredentialsFromServiceAccount(saJson) : null;

  stages.push({ stage: 'upload', ms: Date.now() - uploadStart, mode: sttAuth ? 'live' : 'mock' });

  if (!sttAuth) {
    const mock = mockTranscribe(opts);
    mock.stages = [
      ...stages,
      { stage: 'transcribe', ms: 0, mode: 'mock' },
      { stage: 'enhance', ms: 0, mode: 'mock' },
    ];
    return mock;
  }

  const language = (await getSetting('GOOGLE_STT_LANGUAGE')) || 'km-KH';
  const model = (await getSetting('GOOGLE_STT_MODEL')) || 'latest_long';
  const diarization = ((await getSetting('GOOGLE_STT_DIARIZATION')) || 'true').toLowerCase() === 'true';
  const enhanceFlag = ((await getSetting('STT_ENHANCE_WITH_GEMINI')) || 'true').toLowerCase() === 'true';
  const encoding = pickEncoding(opts.mimeType, opts.filename);

  const transcribeStart = Date.now();
  let rawText = '';
  let confidence = 0;
  let totalSeconds = 0;
  try {
    const client = new SpeechClient(sttAuth);
    const [response] = await client.recognize({
      audio: { content: opts.bytes.toString('base64') },
      config: {
        encoding: encoding === 'ENCODING_UNSPECIFIED' ? undefined : (encoding as any),
        languageCode: language,
        model,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        audioChannelCount: 1,
        diarizationConfig: diarization ? { enableSpeakerDiarization: true, minSpeakerCount: 1, maxSpeakerCount: 6 } : undefined,
      },
    });

    const pieces: string[] = [];
    let confSum = 0;
    let confCount = 0;
    for (const result of response.results ?? []) {
      const alt = result.alternatives?.[0];
      if (!alt) continue;
      if (alt.transcript) pieces.push(alt.transcript);
      if (typeof alt.confidence === 'number') { confSum += alt.confidence; confCount++; }
      const words = alt.words ?? [];
      const last = words[words.length - 1];
      if (last?.endTime) {
        const sec = Number(last.endTime.seconds ?? 0) + Number(last.endTime.nanos ?? 0) / 1e9;
        if (sec > totalSeconds) totalSeconds = sec;
      }
    }
    rawText = pieces.join(' ').trim();
    confidence = confCount ? confSum / confCount : 0;
  } catch (err: any) {
    stages.push({ stage: 'transcribe', ms: Date.now() - transcribeStart, mode: 'mock' });
    const mock = mockTranscribe(opts);
    mock.stages = [
      ...stages,
      { stage: 'enhance', ms: 0, mode: 'skipped' },
    ];
    mock.rawText = `[ Google STT failed: ${err?.message || err} — falling back to mock ]\n\n${mock.rawText}`;
    return mock;
  }
  stages.push({ stage: 'transcribe', ms: Date.now() - transcribeStart, mode: 'live' });

  let enhancedText = rawText;
  let enhanceMode: 'live' | 'mock' | 'skipped' = 'skipped';
  const enhanceStart = Date.now();
  if (enhanceFlag && rawText.trim()) {
    const enhanced = await enhanceTranscript(rawText);
    enhancedText = enhanced.enhanced;
    enhanceMode = enhanced.mode;
  }
  stages.push({ stage: 'enhance', ms: Date.now() - enhanceStart, mode: enhanceMode });

  return {
    mode: 'live',
    provider: 'google',
    rawText,
    enhancedText,
    cleanText: enhancedText,
    fields: extractFieldsFromTranscript(enhancedText),
    confidence,
    durationSec: totalSeconds > 0 ? Math.round(totalSeconds) : undefined,
    stages,
  };
}

function extractFieldsFromTranscript(text: string): Record<string, string> {
  return { discussions: text };
}

function mockTranscribe(opts: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): SttResult {
  const raw = [
    'ជំរាបសួរ លោកជំទាវ ឯកឧត្តម អ្នកទាំងអស់គ្នា កិច្ចប្រជុំថ្ងៃនេះចាប់ផ្តើមនៅម៉ោង ប្រាំបួន។',
    'របៀបវារៈទីមួយ យើងនឹងពិនិត្យលទ្ធផលត្រីមាសទី១។ លទ្ធផលសម្រេចបាន ៨៥% នៃគោលដៅ។',
    'របៀបវារៈទីពីរ ការបែងចែកថវិកាបន្ថែមសម្រាប់គម្រោង IT។ នាយកដ្ឋានព័ត៌មានវិទ្យាស្នើសុំ ៥០០,០០០,០០០ រៀល។',
    'សេចក្តីសម្រេច៖ អនុម័តថវិកា កំណត់កាលបរិច្ឆេទប្រជុំបន្ទាប់នៅថ្ងៃទី១០ ខែកក្កដា។',
  ].join(' ');
  const enhanced = raw;
  return {
    mode: 'mock',
    provider: 'mock',
    rawText: raw,
    enhancedText: enhanced,
    cleanText: enhanced,
    confidence: 0.89,
    durationSec: Math.round(opts.bytes.length / 32000),
    fields: {
      meeting_title: 'កិច្ចប្រជុំពិភាក្សាផែនការសកម្មភាព',
      date: new Date().toISOString().slice(0, 10),
      agenda: '១. ពិនិត្យលទ្ធផលត្រីមាសទី១\n២. បែងចែកថវិកាសម្រាប់ IT',
      discussions: enhanced,
      decisions:
        '១. អនុម័តថវិកាបន្ថែមសម្រាប់គម្រោង IT\n២. កំណត់កាលបរិច្ឆេទប្រជុំបន្ទាប់នៅថ្ងៃទី១០ ខែកក្កដា',
    },
    stages: [],
  };
}
