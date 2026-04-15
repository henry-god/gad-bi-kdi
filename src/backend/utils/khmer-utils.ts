/**
 * Khmer Language Utilities
 *
 * Helpers for Khmer numerals, dates, and text cleanup used across
 * the template engine and API layer.
 */

const KHMER_DIGITS: Record<string, string> = {
  '0': '០', '1': '១', '2': '២', '3': '៣', '4': '៤',
  '5': '៥', '6': '៦', '7': '៧', '8': '៨', '9': '៩',
};
const ARABIC_DIGITS: Record<string, string> = Object.fromEntries(
  Object.entries(KHMER_DIGITS).map(([a, k]) => [k, a]),
);

const KHMER_MONTHS = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
];

const KHMER_DAYS = [
  'អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍',
];

export const KINGDOM_HEADER = {
  line1: 'ព្រះរាជាណាចក្រកម្ពុជា',
  line2: 'ជាតិ សាសនា ព្រះមហាក្សត្រ',
  line3: '✦✦✦',
};

export function toKhmerNumeral(num: string | number): string {
  return String(num).replace(/[0-9]/g, d => KHMER_DIGITS[d] || d);
}

export const toKhmerNumerals = toKhmerNumeral;

export function fromKhmerNumeral(text: string): string {
  return text.replace(/[\u17E0-\u17E9]/g, d => ARABIC_DIGITS[d] || d);
}

/**
 * Format a date in the Khmer government convention.
 * With city: រាជធានីភ្នំពេញ ថ្ងៃទី០១ ខែមករា ឆ្នាំ២០២៦
 * Without:   ថ្ងៃទី០១ ខែមករា ឆ្នាំ២០២៦
 */
export function formatKhmerDate(date: Date | string, includeCity: boolean = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = toKhmerNumeral(String(d.getDate()).padStart(2, '0'));
  const month = KHMER_MONTHS[d.getMonth()];
  const year = toKhmerNumeral(d.getFullYear());
  const core = `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;
  return includeCity ? `រាជធានីភ្នំពេញ ${core}` : core;
}

export function formatKhmerDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = KHMER_DAYS[d.getDay()];
  const day = toKhmerNumeral(String(d.getDate()).padStart(2, '0'));
  const month = KHMER_MONTHS[d.getMonth()];
  const year = toKhmerNumeral(d.getFullYear());
  return `ថ្ងៃ${dayName} ទី${day} ខែ${month} ឆ្នាំ${year}`;
}

export function containsKhmer(text: string): boolean {
  return /[\u1780-\u17FF]/.test(text);
}

/** Strip zero-width characters and collapse runs of whitespace. */
export function cleanKhmerText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function isValidRefNumber(ref: string): boolean {
  return /^លេខ\s[\u17E0-\u17E9]+/.test(ref);
}

export function getKingdomHeader() {
  return { ...KINGDOM_HEADER };
}

export default {
  toKhmerNumeral,
  toKhmerNumerals,
  fromKhmerNumeral,
  formatKhmerDate,
  formatKhmerDateFull,
  containsKhmer,
  cleanKhmerText,
  isValidRefNumber,
  getKingdomHeader,
  KINGDOM_HEADER,
};
