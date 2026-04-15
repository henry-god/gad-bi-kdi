'use client';

/**
 * TemplateSelector Component
 * 
 * Displays grid of available templates as clickable cards.
 * Each card shows: nameKm, name (English), category icon.
 * 
 * TODO (Claude Code):
 * - Fetch from GET /api/templates on mount
 * - Display as responsive grid (2-3 cols)
 * - Category filter tabs (letter, memo, minutes, report, etc.)
 * - Highlight selected card
 * - Call onSelect(templateId) when clicked
 * - Show loading skeleton while fetching
 * - Handle fetch errors gracefully
 */

import React, { useEffect, useState } from 'react';

interface Template {
  id: string;
  name: string;
  nameKm: string;
  category: string;
}

interface Props {
  onSelect: (templateId: string) => void;
  selected?: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  letter: '✉️',
  memo: '📋',
  minutes: '📝',
  report: '📊',
  decree: '📜',
  notification: '📢',
  request: '📨',
  certificate: '🏅',
  contract: '📄',
  other: '📁',
};

export default function TemplateSelector({ onSelect, selected }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(res => {
        if (res.success) setTemplates(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? templates.filter(t => t.category === filter) : templates;
  const categories = [...new Set(templates.map(t => t.category))];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1 rounded-full text-sm font-khmer
            ${!filter ? 'bg-kgd-blue text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          ទាំងអស់
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-sm
              ${filter === cat ? 'bg-kgd-blue text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {CATEGORY_ICONS[cat] || '📁'} {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`text-left p-4 rounded-lg border-2 transition hover:shadow-md
              ${selected === t.id ? 'border-kgd-blue bg-blue-50' : 'border-gray-200 bg-white'}`}
          >
            <span className="text-2xl">{CATEGORY_ICONS[t.category] || '📁'}</span>
            <h3 className="font-khmer font-bold mt-2">{t.nameKm}</h3>
            <p className="text-xs text-gray-400 mt-1">{t.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
