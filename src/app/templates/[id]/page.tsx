'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../_components/AppShell';
import { Button, Input, Textarea, Badge } from '../../../frontend/components/atoms';

type Section = {
  id: string;
  label: string;
  labelKm: string;
  type: 'text' | 'richtext' | 'date' | 'select' | 'table' | 'signature';
  required?: boolean;
  order?: number;
  options?: Array<{ value: string; label: string; labelKm?: string }>;
};

type Config = {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  page?: any;
  fonts?: any;
  letterhead?: any;
  footer?: any;
  sections: Section[];
  placeholders: Record<string, string>;
};

const SECTION_TYPES: Section['type'][] = ['text', 'richtext', 'date', 'select', 'table', 'signature'];
const CATEGORIES = ['letter', 'memo', 'minutes', 'report', 'decree', 'notification', 'request', 'certificate', 'contract', 'other'];

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id as string;

  const [me, setMe] = useState<any>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(r => r.success && setMe(r.data));
  }, []);

  useEffect(() => {
    fetch(`/api/templates/${id}`).then(r => r.json()).then(r => {
      if (r.success) setConfig(r.data);
      else setError(r.error);
    });
  }, [id]);

  const previewSrc = useMemo(() => {
    if (!config) return '';
    const mock: Record<string, string> = {};
    for (const s of config.sections) {
      if (s.type === 'date') mock[s.id] = new Date().toISOString().slice(0, 10);
      else if (s.type === 'signature') mock[s.id] = 'នាយក · Director';
      else mock[s.id] = s.labelKm || s.label;
    }
    const b64 = typeof window !== 'undefined'
      ? btoa(unescape(encodeURIComponent(JSON.stringify(mock))))
      : '';
    return `/api/templates/${id}/preview?data=${encodeURIComponent(b64)}`;
  }, [id, config]);

  async function save() {
    if (!config) return;
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch(`/api/templates/admin/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }).then(r => r.json());
    setSaving(false);
    if (!res.success) setError(res.error);
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  function updateSection(i: number, patch: Partial<Section>) {
    if (!config) return;
    const next = [...config.sections];
    next[i] = { ...next[i], ...patch };
    setConfig({ ...config, sections: next });
  }
  function moveSection(i: number, dir: -1 | 1) {
    if (!config) return;
    const j = i + dir;
    if (j < 0 || j >= config.sections.length) return;
    const next = [...config.sections];
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((s, idx) => (s.order = idx + 1));
    setConfig({ ...config, sections: next });
  }
  function removeSection(i: number) {
    if (!config) return;
    const next = config.sections.filter((_, idx) => idx !== i);
    next.forEach((s, idx) => (s.order = idx + 1));
    setConfig({ ...config, sections: next });
  }
  function addSection() {
    if (!config) return;
    const nextId = `section_${config.sections.length + 1}`;
    setConfig({
      ...config,
      sections: [...config.sections, { id: nextId, label: 'New Section', labelKm: 'ផ្នែកថ្មី', type: 'text', required: false, order: config.sections.length + 1 }],
    });
  }

  function updatePlaceholder(key: string, newKey: string, value: string) {
    if (!config) return;
    const ph: Record<string, string> = {};
    for (const [k, v] of Object.entries(config.placeholders || {})) {
      if (k === key) ph[newKey] = value; else ph[k] = v;
    }
    setConfig({ ...config, placeholders: ph });
  }
  function removePlaceholder(key: string) {
    if (!config) return;
    const { [key]: _removed, ...rest } = config.placeholders || {};
    setConfig({ ...config, placeholders: rest });
  }
  function addPlaceholder() {
    if (!config) return;
    setConfig({ ...config, placeholders: { ...(config.placeholders || {}), '{{NEW_PLACEHOLDER}}': 'Description' } });
  }

  if (error && !config) {
    return <AppShell><div className="p-6 text-red-500">Error: {error}</div></AppShell>;
  }
  if (!config) {
    return <AppShell><div className="p-6 text-slate-400">Loading…</div></AppShell>;
  }

  const readonly = !isAdmin;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link href="/templates" className="text-sm text-slate-400 hover:text-slate-200">← Templates</Link>
            <h1 className="text-xl font-khmer-header mt-1">{config.nameKm} <span className="text-slate-500 text-base">· {config.name}</span></h1>
            <div className="flex gap-2 mt-1">
              <Badge tone="neutral">{config.category}</Badge>
              <span className="text-xs text-slate-500 font-mono">{config.id}</span>
              {readonly && <Badge tone="amber">read-only</Badge>}
            </div>
          </div>
          {!readonly && (
            <div className="flex gap-2 items-center">
              {saved && <span className="text-emerald-400 text-sm">✓ Saved</span>}
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          )}
        </div>

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: form */}
          <div className="space-y-4">
            <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h2 className="text-sm font-medium text-slate-200 mb-3">Basics</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">Name (English)
                  <Input value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} disabled={readonly} />
                </label>
                <label className="text-xs text-slate-400">ឈ្មោះ (Khmer)
                  <Input value={config.nameKm} onChange={e => setConfig({ ...config, nameKm: e.target.value })} disabled={readonly} />
                </label>
                <label className="text-xs text-slate-400">Category
                  <select
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100"
                    value={config.category}
                    onChange={e => setConfig({ ...config, category: e.target.value })}
                    disabled={readonly}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-200">Sections ({config.sections.length})</h2>
                {!readonly && <Button variant="secondary" size="sm" onClick={addSection}>+ Add section</Button>}
              </div>
              <div className="space-y-2">
                {config.sections.map((s, i) => (
                  <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-md p-2">
                    <div className="flex gap-2 items-center mb-2">
                      <span className="text-xs text-slate-500 w-6">#{i + 1}</span>
                      <Input className="flex-1 font-mono text-xs" value={s.id} onChange={e => updateSection(i, { id: e.target.value })} disabled={readonly} />
                      <select
                        className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-100"
                        value={s.type}
                        onChange={e => updateSection(i, { type: e.target.value as Section['type'] })}
                        disabled={readonly}
                      >
                        {SECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input type="checkbox" checked={!!s.required} onChange={e => updateSection(i, { required: e.target.checked })} disabled={readonly} />
                        req
                      </label>
                      {!readonly && (
                        <>
                          <button type="button" className="text-slate-400 hover:text-slate-200 text-xs px-1" onClick={() => moveSection(i, -1)}>↑</button>
                          <button type="button" className="text-slate-400 hover:text-slate-200 text-xs px-1" onClick={() => moveSection(i, 1)}>↓</button>
                          <button type="button" className="text-red-400 hover:text-red-300 text-xs px-1" onClick={() => removeSection(i)}>✕</button>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Label (English)" value={s.label} onChange={e => updateSection(i, { label: e.target.value })} disabled={readonly} />
                      <Input placeholder="ស្លាក (Khmer)" value={s.labelKm} onChange={e => updateSection(i, { labelKm: e.target.value })} disabled={readonly} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-200">Placeholders</h2>
                {!readonly && <Button variant="secondary" size="sm" onClick={addPlaceholder}>+ Add</Button>}
              </div>
              <div className="space-y-2">
                {Object.entries(config.placeholders || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <Input className="flex-1 font-mono text-xs" defaultValue={k} onBlur={e => e.target.value !== k && updatePlaceholder(k, e.target.value, v)} disabled={readonly} />
                    <Input className="flex-1 text-xs" value={v} onChange={e => updatePlaceholder(k, k, e.target.value)} disabled={readonly} />
                    {!readonly && <button type="button" className="text-red-400 hover:text-red-300 text-xs px-2" onClick={() => removePlaceholder(k)}>✕</button>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: preview */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2">
              <div className="text-xs text-slate-400 px-2 py-1">Live preview</div>
              <iframe
                key={config.sections.length + ':' + config.nameKm}
                src={previewSrc}
                className="w-full h-[80vh] rounded-md bg-white"
                title="Template preview"
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
