/**
 * HTML renderer — produces pixel-preview HTML mirroring the DOCX
 * layout. Shares layout constants with template-engine via
 * `shared/docx-constants`.
 *
 * Returns a complete HTML document so the wizard can drop it into
 * an iframe.
 */

import type TemplateEngine from './template-engine';
import { resolveAllStrings } from '../utils/placeholders';
import {
  PAGE_A4_CM, MARGIN_CM, BODY_PT, LINE_SPACING,
  FONT_BODY, FONT_HEADER, FOOTER_PAGE_FORMAT_KM,
} from '../../shared/docx-constants';

interface PreviewTemplate {
  id: string;
  name: string;
  nameKm: string;
  sections: Array<{ id: string; labelKm: string; type: string; order: number; required?: boolean }>;
  placeholders?: Record<string, string>;
  letterhead?: { enabled: boolean };
  footer?: { enabled: boolean; pageNumber: boolean };
}

export interface PreviewData extends Record<string, unknown> {
  ministry_name?: string;
  department_name?: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;');

export function renderTemplateHtml(template: PreviewTemplate, rawData: PreviewData): string {
  const data = resolveAllStrings(template, rawData);

  const sections = [...template.sections].sort((a, b) => a.order - b.order);
  const parts: string[] = [];

  parts.push(`
    <header class="kgd-kingdom">
      <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
      <p class="motto">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
      <p class="divider">✦✦✦</p>
    </header>
  `);

  if (template.letterhead?.enabled) {
    const ministry = String(data.ministry_name ?? '');
    const dept = String(data.department_name ?? '');
    if (ministry || dept) {
      parts.push(`
        <div class="kgd-letterhead">
          ${ministry ? `<p class="ministry">${escapeHtml(ministry)}</p>` : ''}
          ${dept ? `<p class="department">${escapeHtml(dept)}</p>` : ''}
          <p class="rule">──────────────</p>
        </div>
      `);
    }
  }

  for (const section of sections) {
    if (section.id === 'header_kingdom') continue;
    const value = data[section.id];
    const isSignature = section.type === 'signature';
    const hasSigner = isSignature && (data.signer_name || data.signer_title);
    if (!isSignature && (value === undefined || value === null || value === '')) continue;
    if (isSignature && !hasSigner && (value === undefined || value === null || value === '')) continue;
    const label = escapeHtml(section.labelKm);

    if (section.type === 'richtext') {
      const paragraphs = String(value)
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p class="rt">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
        .join('\n');
      parts.push(`<section class="kgd-section richtext">
        <h3>${label}៖</h3>
        ${paragraphs}
      </section>`);
      continue;
    }

    if (section.type === 'signature') {
      const name = escapeHtml(String(data.signer_name ?? ''));
      const title = escapeHtml(String(data.signer_title ?? ''));
      parts.push(`<section class="kgd-section signature">
        <p class="sig-label">${label}</p>
        <div class="sig-space"></div>
        <p class="sig-name">${name}</p>
        ${title ? `<p class="sig-title">${title}</p>` : ''}
      </section>`);
      continue;
    }

    // text, date, select, table → single line with label
    if (section.id === 'subject') {
      parts.push(`<p class="kgd-subject"><strong>កម្មវត្ថុ៖</strong> <strong>${escapeHtml(String(value))}</strong></p>`);
    } else {
      parts.push(`<p class="kgd-field"><strong>${label}៖</strong> ${escapeHtml(String(value))}</p>`);
    }
  }

  const footerText = template.footer?.enabled && template.footer?.pageNumber
    ? FOOTER_PAGE_FORMAT_KM.replace('{PAGE}', '1').replace('{NUMPAGES}', '1')
    : '';

  const css = `
    @page { size: ${PAGE_A4_CM.width}cm ${PAGE_A4_CM.height}cm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #e5e7eb; font-family: "${FONT_BODY}", serif; }
    .kgd-page {
      width: ${PAGE_A4_CM.width}cm;
      min-height: ${PAGE_A4_CM.height}cm;
      padding: ${MARGIN_CM.top}cm ${MARGIN_CM.right}cm ${MARGIN_CM.bottom}cm ${MARGIN_CM.left}cm;
      margin: 1rem auto;
      background: #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      font-size: ${BODY_PT}pt;
      line-height: ${LINE_SPACING};
      text-align: justify;
      text-justify: inter-character;
      box-sizing: border-box;
      color: #111;
    }
    .kgd-kingdom { text-align: center; margin-bottom: 0.6rem; }
    .kgd-kingdom h1 { font-family: "${FONT_HEADER}", serif; font-size: 14pt; margin: 0 0 0.2rem; }
    .kgd-kingdom .motto { font-family: "${FONT_HEADER}", serif; font-size: ${BODY_PT}pt; margin: 0 0 0.2rem; font-weight: 700; }
    .kgd-kingdom .divider { font-size: ${BODY_PT}pt; margin: 0 0 0.6rem; }
    .kgd-letterhead { text-align: center; margin-bottom: 0.8rem; font-family: "${FONT_HEADER}", serif; }
    .kgd-letterhead .ministry { font-weight: 700; margin: 0 0 0.2rem; }
    .kgd-letterhead .department { margin: 0 0 0.2rem; }
    .kgd-letterhead .rule { margin: 0.4rem 0; }
    .kgd-section { margin: 0.5rem 0; }
    .kgd-section h3 { font-size: ${BODY_PT}pt; margin: 0.5rem 0 0.2rem; font-weight: 700; }
    .kgd-section.richtext p.rt { text-indent: 1.2cm; margin: 0 0 0.4rem; }
    .kgd-section.signature { text-align: right; margin-top: 1.2rem; }
    .kgd-section.signature .sig-label { font-weight: 700; margin: 0 0 0.2rem; }
    .kgd-section.signature .sig-space { height: 1.2rem; }
    .kgd-section.signature .sig-name { font-weight: 700; margin: 0; }
    .kgd-section.signature .sig-title { margin: 0; font-size: ${BODY_PT}pt; }
    .kgd-subject { margin: 0.4rem 0; }
    .kgd-field { margin: 0.2rem 0; }
    .kgd-footer { position: fixed; bottom: 1.2cm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #555; }
  `;

  return `<!doctype html>
<html lang="km">
<head>
<meta charset="utf-8">
<title>${escapeHtml(template.nameKm)} · preview</title>
<link rel="preload" as="font" href="/fonts/KhmerOSSiemreap.ttf" type="font/ttf" crossorigin>
<link rel="preload" as="font" href="/fonts/KhmerOSMuollight.ttf" type="font/ttf" crossorigin>
<style>
@font-face { font-family: "${FONT_BODY}"; src: url("/fonts/KhmerOSSiemreap.ttf") format("truetype"); font-display: swap; }
@font-face { font-family: "${FONT_HEADER}"; src: url("/fonts/KhmerOSMuollight.ttf") format("truetype"); font-display: swap; }
${css}
</style>
</head>
<body>
<article class="kgd-page">
${parts.join('\n')}
${footerText ? `<div class="kgd-footer">${escapeHtml(footerText)}</div>` : ''}
</article>
</body>
</html>`;
}

export function listAndRender(engine: TemplateEngine, templateId: string, data: PreviewData): string {
  const config = engine.loadTemplate(templateId) as unknown as PreviewTemplate;
  return renderTemplateHtml(config, data);
}
