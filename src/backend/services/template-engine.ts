/**
 * Template Engine Service
 *
 * Generates DOCX files from template configs + user data.
 * Uses the `docx` npm package (docx-js).
 *
 * Key conventions:
 * - Template configs: /templates/config/*.json
 * - Khmer body font: "Khmer OS Battambang"
 * - Khmer header font: "Khmer OS Muol Light"
 * - A4 DXA: 11906 x 16838; 1 cm = 567 DXA; font size = pt*2 (half-points)
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, BorderStyle, WidthType, PageNumber,
  TabStopType, HeightRule,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { formatKhmerDate } from '../utils/khmer-utils';
import { templateStore } from './template-store';

interface SectionConfig {
  id: string;
  label: string;
  labelKm: string;
  type: 'text' | 'richtext' | 'date' | 'select' | 'table' | 'signature';
  required: boolean;
  order: number;
  options?: Array<{ value: string; label: string; labelKm?: string }>;
}

interface TemplateConfig {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  page: {
    size: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; bottom: number; left: number; right: number };
  };
  fonts: {
    title: { family: string; size: number; bold: boolean };
    body: { family: string; size: number; lineSpacing: number };
    header: { family: string; size: number };
    footer: { family: string; size: number };
  };
  letterhead: {
    enabled: boolean;
    logoPosition: string;
    ministryName: boolean;
    departmentName: boolean;
    emblem: boolean;
    ministryNameText?: string;
    departmentNameText?: string;
    logoPath?: string;
  };
  footer: { enabled: boolean; pageNumber: boolean; address: boolean; addressText?: string };
  sections: SectionConfig[];
  placeholders: Record<string, string>;
}

type FieldValue = string | string[] | Array<Record<string, string>>;
interface DocumentData { [key: string]: FieldValue | undefined; }

const cmToDxa = (cm: number): number => Math.round(cm * 567);
const ptToHalfPt = (pt: number): number => pt * 2;
// docx line spacing is in 240ths (single = 240, 1.5 = 360)
const lineSpacingToTwips = (spacing: number): number => Math.round(spacing * 240);

export class TemplateEngine {
  private configDir: string;

  constructor(configDir: string = process.env.TEMPLATE_CONFIG_DIR || path.join(__dirname, '../../../templates/config')) {
    this.configDir = configDir;
  }

  loadTemplate(templateId: string): TemplateConfig {
    const configPath = path.join(this.configDir, `${templateId}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  listTemplates(): Array<{ id: string; name: string; nameKm: string; category: string }> {
    const files = fs.readdirSync(this.configDir).filter(f =>
      f.endsWith('.json') && !f.startsWith('_')
    );
    return files.map(f => {
      const config = JSON.parse(fs.readFileSync(path.join(this.configDir, f), 'utf-8'));
      return { id: config.id, name: config.name, nameKm: config.nameKm, category: config.category };
    });
  }

  async generate(templateId: string, data: DocumentData): Promise<Buffer> {
    let config: TemplateConfig;
    try {
      config = (await templateStore.getTemplate(templateId)) as TemplateConfig;
    } catch {
      config = this.loadTemplate(templateId);
    }
    this.validateRequired(config, data);

    const { margins } = config.page;
    const isA4 = config.page.size === 'A4';

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: config.fonts.body.family,
              size: ptToHalfPt(config.fonts.body.size),
            },
            paragraph: {
              spacing: { line: lineSpacingToTwips(config.fonts.body.lineSpacing) },
            },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: {
              width: isA4 ? 11906 : 12240,
              height: isA4 ? 16838 : 15840,
            },
            margin: {
              top: cmToDxa(margins.top),
              bottom: cmToDxa(margins.bottom),
              left: cmToDxa(margins.left),
              right: cmToDxa(margins.right),
            },
          },
        },
        footers: this.buildFooters(config),
        children: this.buildContent(config, data),
      }],
    });

    return await Packer.toBuffer(doc);
  }

  private validateRequired(config: TemplateConfig, data: DocumentData): void {
    const missing: string[] = [];
    for (const section of config.sections) {
      if (!section.required) continue;
      if (section.id === 'header_kingdom') continue; // always auto-generated
      const value = data[section.id];
      if (value === undefined || value === null || value === '') {
        missing.push(`${section.labelKm} (${section.label})`);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  private buildContent(config: TemplateConfig, data: DocumentData): (Paragraph | Table)[] {
    const out: (Paragraph | Table)[] = [];
    const bodyFont = config.fonts.body.family;
    const bodySize = ptToHalfPt(config.fonts.body.size);
    const headerFont = config.fonts.header.family;
    const headerSize = ptToHalfPt(config.fonts.header.size);
    const titleFont = config.fonts.title.family;
    const titleSize = ptToHalfPt(config.fonts.title.size);

    // 1) Kingdom header (always first, auto-generated, centered)
    out.push(...this.buildKingdomHeader(headerFont, titleSize, headerSize));

    // 2) Letterhead ministry/department block
    if (config.letterhead?.enabled) {
      out.push(...this.buildLetterhead(config, data));
    }

    // Sort remaining sections
    const sortedSections = [...config.sections]
      .filter(s => s.id !== 'header_kingdom')
      .sort((a, b) => a.order - b.order);

    // 3) Try to pair ref_number/memo_number with date on one line
    const refSection = sortedSections.find(s => /^(ref_number|memo_number)$/.test(s.id));
    const dateSection = sortedSections.find(s => s.id === 'date');
    const usedInPair = new Set<string>();

    if (refSection && dateSection && data[refSection.id] && data[dateSection.id]) {
      out.push(this.buildRefDateLine(
        String(data[refSection.id]),
        this.formatDateValue(data[dateSection.id] as string),
        bodyFont,
        bodySize,
      ));
      out.push(this.spacer(bodyFont, bodySize));
      usedInPair.add(refSection.id);
      usedInPair.add(dateSection.id);
    }

    for (const section of sortedSections) {
      if (usedInPair.has(section.id)) continue;
      const value = data[section.id];
      if (value === undefined || value === null || value === '') continue;

      out.push(...this.buildSection(section, value, config, data));
    }

    return out;
  }

  private buildKingdomHeader(font: string, titleSize: number, subSize: number): Paragraph[] {
    const center = { alignment: AlignmentType.CENTER };
    return [
      new Paragraph({
        ...center,
        children: [new TextRun({
          text: 'ព្រះរាជាណាចក្រកម្ពុជា',
          font, size: titleSize, bold: true,
        })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        ...center,
        children: [new TextRun({
          text: 'ជាតិ សាសនា ព្រះមហាក្សត្រ',
          font, size: subSize, bold: true,
        })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        ...center,
        children: [new TextRun({ text: '✦✦✦', font, size: subSize })],
        spacing: { after: 240 },
      }),
    ];
  }

  private buildLetterhead(config: TemplateConfig, data: DocumentData): Paragraph[] {
    const font = config.fonts.header.family;
    const size = ptToHalfPt(config.fonts.header.size);
    const paragraphs: Paragraph[] = [];

    const ministryText =
      (data['ministry_name'] as string) ||
      config.letterhead.ministryNameText ||
      (config.letterhead.ministryName ? '' : '');
    if (ministryText) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: ministryText, font, size, bold: true })],
        spacing: { after: 60 },
      }));
    }

    const departmentText =
      (data['department_name'] as string) ||
      config.letterhead.departmentNameText ||
      '';
    if (departmentText) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: departmentText, font, size })],
        spacing: { after: 120 },
      }));
    }

    if (paragraphs.length > 0) {
      paragraphs.push(this.separator(font, size));
    }
    return paragraphs;
  }

  private buildRefDateLine(refNumber: string, dateText: string, font: string, size: number): Paragraph {
    const rightTabDxa = 15000 / 2; // approx center of printable area; page.width - margins handled by TabStopPosition.MAX
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
      children: [
        new TextRun({ text: `លេខ ${refNumber}`, font, size }),
        new TextRun({ text: '\t', font, size }),
        new TextRun({ text: dateText, font, size }),
      ],
    });
  }

  private formatDateValue(value: string): string {
    // Accept ISO date or pre-formatted Khmer string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatKhmerDate(value);
    return value;
  }

  private buildSection(
    section: SectionConfig,
    value: FieldValue,
    config: TemplateConfig,
    data: DocumentData,
  ): (Paragraph | Table)[] {
    const bodyFont = config.fonts.body.family;
    const bodySize = ptToHalfPt(config.fonts.body.size);

    switch (section.type) {
      case 'text':
        return this.buildText(section, String(value), bodyFont, bodySize);

      case 'richtext':
        return this.buildRichText(section, String(value), bodyFont, bodySize);

      case 'date':
        return this.buildText(section, this.formatDateValue(String(value)), bodyFont, bodySize);

      case 'table':
        return [this.buildTable(section, value, bodyFont, bodySize), this.spacer(bodyFont, bodySize)];

      case 'signature':
        return this.buildSignature(section, data, bodyFont, bodySize);

      case 'select':
        return this.buildText(section, this.resolveSelect(section, String(value)), bodyFont, bodySize);

      default:
        return this.buildText(section, String(value), bodyFont, bodySize);
    }
  }

  private buildText(section: SectionConfig, value: string, font: string, size: number): Paragraph[] {
    // Section-specific formatting
    if (section.id === 'subject') {
      return [new Paragraph({
        children: [
          new TextRun({ text: `កម្មវត្ថុ៖ `, font, size, bold: true }),
          new TextRun({ text: value, font, size, bold: true }),
        ],
        spacing: { before: 120, after: 120 },
      })];
    }
    if (section.id === 'recipient' || section.id === 'to') {
      return [new Paragraph({
        children: [
          new TextRun({ text: `${section.labelKm}៖ `, font, size, bold: true }),
          new TextRun({ text: value, font, size }),
        ],
        spacing: { after: 120 },
      })];
    }
    if (section.id === 'from') {
      return [new Paragraph({
        children: [
          new TextRun({ text: `${section.labelKm}៖ `, font, size, bold: true }),
          new TextRun({ text: value, font, size }),
        ],
        spacing: { after: 120 },
      })];
    }
    if (section.id === 'cc') {
      const lines = value.split('\n').filter(Boolean);
      const children: Paragraph[] = [
        new Paragraph({
          children: [new TextRun({ text: 'ចម្លងជូន៖', font, size, bold: true, italics: true })],
          spacing: { before: 240, after: 60 },
        }),
        ...lines.map(line => new Paragraph({
          children: [new TextRun({ text: `- ${line}`, font, size, italics: true })],
          indent: { left: 360 },
          spacing: { after: 40 },
        })),
      ];
      return children;
    }
    return [new Paragraph({
      children: [new TextRun({ text: value, font, size })],
      spacing: { after: 120 },
    })];
  }

  private buildRichText(section: SectionConfig, value: string, font: string, size: number): Paragraph[] {
    const label = new Paragraph({
      children: [new TextRun({ text: `${section.labelKm}៖`, font, size, bold: true })],
      spacing: { before: 160, after: 80 },
    });
    const paragraphs = value
      .split(/\n\n+/)
      .map(block => block.trim())
      .filter(Boolean)
      .map(block => {
        const runs: TextRun[] = [];
        const lines = block.split('\n');
        lines.forEach((line, idx) => {
          runs.push(new TextRun({ text: line, font, size }));
          if (idx < lines.length - 1) runs.push(new TextRun({ text: '', break: 1 }));
        });
        return new Paragraph({
          children: runs,
          indent: { firstLine: 720 },
          spacing: { after: 120 },
          // Thai Distribute — character-level stretch, correct for Khmer
          // which has no inter-word spaces (Western JUSTIFIED does nothing).
          alignment: AlignmentType.DISTRIBUTE,
        });
      });
    return [label, ...paragraphs];
  }

  private buildTable(section: SectionConfig, value: FieldValue, font: string, size: number): Table {
    // Normalize input to rows of cell arrays
    const rows: string[][] = this.normalizeTableRows(value);

    const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const allBorders = { top: border, bottom: border, left: border, right: border };

    const tableRows = rows.map((row, rIdx) =>
      new TableRow({
        tableHeader: rIdx === 0,
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: row.map(cell =>
          new TableCell({
            width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
            children: [new Paragraph({
              children: [new TextRun({ text: cell, font, size, bold: rIdx === 0 })],
              alignment: rIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            })],
            borders: allBorders,
          }),
        ),
      }),
    );

    return new Table({
      rows: tableRows,
      width: { size: 9000, type: WidthType.DXA },
    });
  }

  private normalizeTableRows(value: FieldValue): string[][] {
    if (Array.isArray(value)) {
      if (value.length === 0) return [['']];
      if (typeof value[0] === 'string') {
        return (value as string[]).map(line => line.split('|').map(c => c.trim()));
      }
      // Array of objects
      const objs = value as Array<Record<string, string>>;
      const keys = Object.keys(objs[0]);
      return [keys, ...objs.map(o => keys.map(k => String(o[k] ?? '')))];
    }
    // String: split on newlines, each row split on | or ,
    const raw = String(value).trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [['']];
    const hasPipe = lines.some(l => l.includes('|'));
    const sep = hasPipe ? '|' : ',';
    return lines.map(line => line.split(sep).map(c => c.trim()));
  }

  private buildSignature(
    section: SectionConfig,
    data: DocumentData,
    font: string,
    size: number,
  ): Paragraph[] {
    // Prefer section-specific signer fields; fall back to generic
    const nameKey = section.id === 'signature' ? 'signer_name' : `${section.id}_name`;
    const titleKey = section.id === 'signature' ? 'signer_title' : `${section.id}_title`;
    const name = String(data[nameKey] ?? data['signer_name'] ?? '').trim();
    const title = String(data[titleKey] ?? data['signer_title'] ?? '').trim();

    const right = { alignment: AlignmentType.RIGHT };
    const labelLine = new Paragraph({
      ...right,
      children: [new TextRun({ text: section.labelKm || 'ហត្ថលេខា', font, size, bold: true })],
      spacing: { before: 240, after: 60 },
    });
    const spaceForSignature = new Paragraph({
      ...right,
      children: [new TextRun({ text: '', font, size })],
      spacing: { before: 360, after: 360 },
    });
    const nameLine = new Paragraph({
      ...right,
      children: [new TextRun({ text: name, font, size, bold: true })],
      spacing: { after: 40 },
    });
    const titleLine = title
      ? new Paragraph({
          ...right,
          children: [new TextRun({ text: title, font, size })],
          spacing: { after: 120 },
        })
      : null;

    return [labelLine, spaceForSignature, nameLine, ...(titleLine ? [titleLine] : [])];
  }

  private resolveSelect(section: SectionConfig, value: string): string {
    if (!section.options) return value;
    const match = section.options.find(o => o.value === value);
    if (!match) return value;
    return match.labelKm || match.label || value;
  }

  private spacer(font: string, size: number): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: '', font, size })],
      spacing: { after: 120 },
    });
  }

  private separator(font: string, size: number): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '──────────────', font, size })],
      spacing: { after: 120 },
    });
  }

  private buildFooters(config: TemplateConfig): { default: Footer } | undefined {
    if (!config.footer?.enabled) return undefined;
    const font = config.fonts.footer.family;
    const size = ptToHalfPt(config.fonts.footer.size);
    const children: Paragraph[] = [];
    if (config.footer.address && config.footer.addressText) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: config.footer.addressText, font, size })],
      }));
    }
    if (config.footer.pageNumber) {
      // "ទំព័រទី {PAGE} នៃ {NUMPAGES}" — NBFSA standard footer format.
      // Page numbers render as Arabic numerals inside Khmer labels (docx-js
      // page fields don't support Khmer numeral formatting); acceptable.
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'ទំព័រទី', font, size }),
          new TextRun({ children: [PageNumber.CURRENT], font, size }),
          new TextRun({ text: ' នៃ', font, size }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size }),
        ],
      }));
    }
    if (children.length === 0) return undefined;
    return { default: new Footer({ children }) };
  }
}

export default TemplateEngine;
