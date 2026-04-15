/**
 * Shared layout constants — single source of truth for DOCX + HTML
 * renderers so preview iframe and generated DOCX agree.
 */

export const PAGE_A4_CM = { width: 21.0, height: 29.7 };
export const MARGIN_CM = { top: 2.54, bottom: 2.54, left: 3.17, right: 2.54 };
export const BODY_PT = 11;
export const TITLE_PT = 14;
export const HEADER_PT = 11;
export const FOOTER_PT = 9;
export const LINE_SPACING = 1.5;

export const FONT_BODY = 'Khmer OS Siemreap';
export const FONT_HEADER = 'Khmer OS Muollight';

export const FOOTER_PAGE_FORMAT_KM = 'ទំព័រទី {PAGE} នៃ {NUMPAGES}';

// DXA conversions (used by docx-js).
export const cmToDxa = (cm: number): number => Math.round(cm * 567);
export const ptToHalfPt = (pt: number): number => pt * 2;
export const lineSpacingToTwips = (spacing: number): number => Math.round(spacing * 240);
