'use client';

/**
 * DocumentForm Component
 * 
 * Dynamically renders form fields based on template.sections[].
 * Each section.type maps to a form element:
 *   text → input
 *   richtext → textarea (Phase 2: rich text editor)
 *   date → Khmer date picker
 *   table → dynamic table rows
 *   signature → name + title fields
 *   select → dropdown
 * 
 * TODO (Claude Code - Phase 1 PRIORITY):
 * - Fetch template config from GET /api/templates/:id
 * - Render fields dynamically sorted by section.order
 * - Mark required fields with red asterisk
 * - Validate required fields before allowing next step
 * - Khmer date picker: calendar with Khmer months/numerals
 * - Signature block: two fields (name + title) in a row
 * - Table type: add/remove rows dynamically
 * - Support Khmer placeholder text
 * - Save form state to parent via onChange(data)
 */

import React from 'react';

/**
 * Table editor — stores rows as pipe-delimited lines so the backend
 * parser (template-engine.normalizeTableRows) can ingest it directly.
 * First row is treated as the header.
 */
function TableEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const rows: string[][] = value
    ? value.split('\n').map(line => line.split('|').map(c => c.trim()))
    : [['ឈ្មោះ', 'តំណែង'], ['', '']];
  const cols = Math.max(...rows.map(r => r.length));

  function serialize(next: string[][]) {
    onChange(next.map(r => r.join('|')).join('\n'));
  }

  function setCell(ri: number, ci: number, v: string) {
    const copy = rows.map(r => [...r]);
    while (copy[ri].length < cols) copy[ri].push('');
    copy[ri][ci] = v;
    serialize(copy);
  }

  function addRow() {
    const blank = Array.from({ length: cols }, () => '');
    serialize([...rows, blank]);
  }

  function removeRow(idx: number) {
    if (rows.length <= 1) return;
    serialize(rows.filter((_, i) => i !== idx));
  }

  return (
    <div className="border border-gray-300 rounded-lg p-3">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} className="p-1">
                  <input
                    value={row[ci] ?? ''}
                    onChange={e => setCell(ri, ci, e.target.value)}
                    className={`w-full border border-gray-200 rounded px-2 py-1 font-khmer ${ri === 0 ? 'bg-gray-50 font-bold' : ''}`}
                    placeholder={ri === 0 ? 'header' : ''}
                  />
                </td>
              ))}
              <td className="p-1 w-8">
                {ri > 0 && (
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove row"
                  >✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-sm text-kgd-blue hover:underline font-khmer"
      >+ បន្ថែមជួរ (Add row)</button>
    </div>
  );
}

interface Section {
  id: string;
  label: string;
  labelKm: string;
  type: string;
  required: boolean;
  order: number;
}

interface Props {
  sections: Section[];
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
}

export default function DocumentForm({ sections, data, onChange }: Props) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const handleChange = (id: string, value: string) => {
    onChange({ ...data, [id]: value });
  };

  return (
    <div className="space-y-4">
      {sorted.map(section => (
        <div key={section.id}>
          <label className="block font-khmer text-sm font-bold mb-1">
            {section.labelKm}
            {section.required && <span className="text-red-500 ml-1">*</span>}
            <span className="text-gray-400 text-xs ml-2">({section.label})</span>
          </label>

          {section.type === 'text' && (
            <input
              type="text"
              value={data[section.id] || ''}
              onChange={e => handleChange(section.id, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-khmer focus:border-kgd-blue focus:ring-1 focus:ring-kgd-blue outline-none"
              placeholder={section.labelKm}
              required={section.required}
            />
          )}

          {section.type === 'richtext' && (
            <textarea
              value={data[section.id] || ''}
              onChange={e => handleChange(section.id, e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-khmer focus:border-kgd-blue focus:ring-1 focus:ring-kgd-blue outline-none"
              placeholder={section.labelKm}
              required={section.required}
            />
          )}

          {section.type === 'date' && (
            <input
              type="date"
              value={data[section.id] || ''}
              onChange={e => handleChange(section.id, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-khmer focus:border-kgd-blue outline-none"
              required={section.required}
            />
            // TODO: Replace with custom Khmer date picker
          )}

          {section.type === 'signature' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={data[`${section.id}_name`] || ''}
                onChange={e => handleChange(`${section.id}_name`, e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 font-khmer focus:border-kgd-blue outline-none"
                placeholder="ឈ្មោះ (Name)"
              />
              <input
                type="text"
                value={data[`${section.id}_title`] || ''}
                onChange={e => handleChange(`${section.id}_title`, e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 font-khmer focus:border-kgd-blue outline-none"
                placeholder="តំណែង (Title)"
              />
            </div>
          )}

          {section.type === 'table' && (
            <TableEditor
              value={data[section.id] || ''}
              onChange={v => handleChange(section.id, v)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
