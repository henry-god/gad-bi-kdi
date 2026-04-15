import { describe, it, expect } from 'vitest';
import { pickEncoding, transcribeAudio } from '../../src/backend/services/stt-service';

describe('V5-M5 stt-service', () => {
  it('pickEncoding resolves common mime types', () => {
    expect(pickEncoding('audio/wav', 'a.wav')).toBe('LINEAR16');
    expect(pickEncoding('audio/flac', 'a.flac')).toBe('FLAC');
    expect(pickEncoding('audio/mpeg', 'a.mp3')).toBe('MP3');
    expect(pickEncoding('audio/ogg', 'a.ogg')).toBe('OGG_OPUS');
    expect(pickEncoding('audio/x-m4a', 'a.m4a')).toBe('MP4');
    expect(pickEncoding('application/octet-stream', 'a.unknown')).toBe('ENCODING_UNSPECIFIED');
  });

  it('falls back to mock when no service account is configured', async () => {
    const result = await transcribeAudio({
      filename: 'dummy.wav',
      mimeType: 'audio/wav',
      bytes: Buffer.from(new Uint8Array(32000)),
    });
    expect(result.mode).toBe('mock');
    expect(result.provider).toBe('mock');
    expect(result.rawText.length).toBeGreaterThan(20);
    expect(result.enhancedText.length).toBeGreaterThan(20);
    expect(result.cleanText).toBe(result.enhancedText);
    expect(result.stages).toHaveLength(3);
    expect(result.stages.map(s => s.stage)).toEqual(['upload', 'transcribe', 'enhance']);
    expect(result.fields.discussions).toBeTruthy();
  });

  it('mock result populates meeting-minutes field keys', async () => {
    const result = await transcribeAudio({
      filename: 'dummy.wav',
      mimeType: 'audio/wav',
      bytes: Buffer.from(new Uint8Array(64000)),
    });
    expect(result.fields).toHaveProperty('discussions');
    expect(result.fields).toHaveProperty('meeting_title');
    expect(result.fields).toHaveProperty('decisions');
  });
});
