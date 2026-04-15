/**
 * OCR Service
 *
 * Extracts structured text from PDF/image uploads.
 *
 * Phase 2 scaffold: returns a deterministic mock payload when
 * GOOGLE_AI_API_KEY is absent so the full upload → auto-fill flow is
 * demoable offline. When credentials are present, swap `mockExtract` with
 * a Google Document AI call. The return shape intentionally matches the
 * form field IDs used by the template configs so `/documents/new/[id]`
 * can hydrate fields directly from this response.
 */

export interface OcrResult {
  mode: 'live' | 'mock';
  rawText: string;
  fields: Record<string, string>;
  confidence: number;
}

import { getSetting } from './settings-service';

export async function extractDocument(opts: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<OcrResult> {
  const apiKey = await getSetting('GOOGLE_AI_API_KEY');
  if (!apiKey) return mockExtract(opts);
  return liveExtract(opts);
}

async function liveExtract(_: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<OcrResult> {
  throw new Error(
    'Live OCR not yet wired — set GOOGLE_AI_API_KEY and replace liveExtract() with a Document AI processor call.',
  );
}

/**
 * Deterministic mock — maps filename hints to sample fields so the
 * frontend can render a meaningful auto-filled form.
 */
function mockExtract(opts: { filename: string; mimeType: string; bytes: Buffer }): OcrResult {
  const lower = opts.filename.toLowerCase();
  const isMeeting = /meeting|minut|ប្រជុំ/.test(lower);
  const isMemo = /memo|អនុស្សរណៈ/.test(lower);

  if (isMeeting) {
    return {
      mode: 'mock',
      confidence: 0.87,
      rawText:
        'កិច្ចប្រជុំពិភាក្សាផែនការសកម្មភាពត្រីមាសទី២ ឆ្នាំ២០២៦ ទីកន្លែង៖ បន្ទប់ប្រជុំ ជាន់ទី៣',
      fields: {
        meeting_title: 'កិច្ចប្រជុំពិភាក្សាផែនការសកម្មភាពត្រីមាសទី២ ឆ្នាំ២០២៦',
        date: new Date().toISOString().slice(0, 10),
        location: 'បន្ទប់ប្រជុំ ជាន់ទី៣ អគារក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ',
        chairperson: 'ឯកឧត្តម អគ្គនាយក',
        attendees: 'នាយកដ្ឋានផែនការ|ប្រធាន\nនាយកដ្ឋានហិរញ្ញវត្ថុ|អនុប្រធាន',
        agenda: '១. ពិនិត្យលទ្ធផលត្រីមាសទី១\n២. ពិភាក្សាផែនការត្រីមាសទី២',
      },
    };
  }

  if (isMemo) {
    return {
      mode: 'mock',
      confidence: 0.84,
      rawText: 'អនុស្សរណៈផ្ទៃក្នុង ស្តីពីការដំឡើងប្រព័ន្ធ',
      fields: {
        memo_number: 'អ.០១២/២០២៦',
        date: new Date().toISOString().slice(0, 10),
        from: 'នាយកដ្ឋានព័ត៌មានវិទ្យា',
        to: 'គ្រប់នាយកដ្ឋាន និងអង្គភាពពាក់ព័ន្ធ',
        subject: 'ស្តីពីការដំឡើងប្រព័ន្ធកម្មវិធីថ្មី',
        body: 'សូមជម្រាបជូនថា នាយកដ្ឋានព័ត៌មានវិទ្យានឹងធ្វើការដំឡើងប្រព័ន្ធកម្មវិធីគ្រប់គ្រងឯកសារថ្មី។',
      },
    };
  }

  return {
    mode: 'mock',
    confidence: 0.82,
    rawText: 'លិខិតផ្លូវការ ស្តីពីការស្នើសុំការអនុម័តថវិកា',
    fields: {
      ref_number: '០០១ ស.ហ.វ',
      date: new Date().toISOString().slice(0, 10),
      recipient: 'ឯកឧត្តម ប្រធាននាយកដ្ឋានរដ្ឋបាល',
      subject: 'ស្តីពីការស្នើសុំការអនុម័តថវិកា (ដកស្រង់ពីឯកសារស្កែន)',
      salutation: 'សូមគោរពជូន ឯកឧត្តមប្រធាននាយកដ្ឋាន',
      body: 'យោងតាមឯកសារដែលបានស្កែន ខ្ញុំសូមគោរពស្នើសុំឯកឧត្តមប្រធាន មេត្តាពិនិត្យ និងអនុម័តថវិកា។',
      closing: 'សូមទទួលនូវការគោរពដ៏ខ្ពង់ខ្ពស់',
    },
  };
}
