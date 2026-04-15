import { describe, it, expect } from 'vitest';
import {
  toKhmerNumeral, fromKhmerNumeral, formatKhmerDate,
  containsKhmer, cleanKhmerText, KINGDOM_HEADER
} from '../../src/backend/utils/khmer-utils';

describe('toKhmerNumeral', () => {
  it('converts 0-9', () => {
    expect(toKhmerNumeral(0)).toBe('០');
    expect(toKhmerNumeral(9)).toBe('៩');
  });
  it('converts multi-digit', () => {
    expect(toKhmerNumeral(2026)).toBe('២០២៦');
    expect(toKhmerNumeral(123)).toBe('១២៣');
  });
  it('converts string input', () => {
    expect(toKhmerNumeral('500000')).toBe('៥០០០០០');
  });
});

describe('fromKhmerNumeral', () => {
  it('converts back to Arabic', () => {
    expect(fromKhmerNumeral('២០២៦')).toBe('2026');
    expect(fromKhmerNumeral('១២៣')).toBe('123');
  });
});

describe('formatKhmerDate', () => {
  it('formats with city prefix', () => {
    const result = formatKhmerDate('2026-04-12');
    expect(result).toContain('រាជធានីភ្នំពេញ');
    expect(result).toContain('១២');
    expect(result).toContain('មេសា');
    expect(result).toContain('២០២៦');
  });
  it('formats without city', () => {
    const result = formatKhmerDate('2026-04-12', false);
    expect(result).not.toContain('រាជធានីភ្នំពេញ');
    expect(result).toContain('ថ្ងៃទី១២');
  });
});

describe('containsKhmer', () => {
  it('detects Khmer text', () => {
    expect(containsKhmer('សួស្តី')).toBe(true);
    expect(containsKhmer('Hello')).toBe(false);
    expect(containsKhmer('Hello សួស្តី')).toBe(true);
  });
});

describe('cleanKhmerText', () => {
  it('removes zero-width spaces', () => {
    expect(cleanKhmerText('សួស្តី\u200Bworld')).toBe('សួស្តីworld');
  });
  it('collapses multiple spaces', () => {
    expect(cleanKhmerText('hello   world')).toBe('hello world');
  });
});

describe('KINGDOM_HEADER', () => {
  it('has all 3 lines', () => {
    expect(KINGDOM_HEADER.line1).toContain('ព្រះរាជាណាចក្រកម្ពុជា');
    expect(KINGDOM_HEADER.line2).toContain('ជាតិ');
    expect(KINGDOM_HEADER.line3).toBe('✦✦✦');
  });
});
