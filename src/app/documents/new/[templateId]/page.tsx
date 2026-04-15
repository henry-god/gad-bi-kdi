'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../../_components/AppShell';
import DocumentForm from '../../../../frontend/components/organisms/DocumentForm';
import DocumentPreview from '../../../../frontend/components/organisms/DocumentPreview';
import {
  Button,
  Badge,
  Input,
  Textarea,
  Skeleton,
  StatusChip,
} from '../../../../frontend/components/atoms';

interface Section {
  id: string;
  label: string;
  labelKm: string;
  type: string;
  required: boolean;
  order: number;
}

interface TemplateConfig {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  sections: Section[];
}

type WizardStep = 2 | 3 | 4;
type SourceMode = 'manual' | 'ocr' | 'stt' | 'ai';

const SOURCE_META: Record<SourceMode, { icon: string; labelKm: string; labelEn: string; hint: string }> = {
  manual: { icon: '✏',  labelKm: 'បំពេញដោយដៃ',   labelEn: 'Manual form',     hint: 'Fill every field yourself — fastest for short docs.' },
  ocr:    { icon: '📷', labelKm: 'OCR ពី PDF',    labelEn: 'Scan a document', hint: 'Upload a PDF or photo; fields auto-fill from extracted Khmer text.' },
  stt:    { icon: '🎤', labelKm: 'STT ពីសំឡេង',  labelEn: 'Transcribe audio',hint: 'Upload meeting audio; transcript cleaned + fields populated.' },
  ai:     { icon: '🤖', labelKm: 'AI ពីសេចក្តីខ្លី',labelEn: 'AI-refine rough draft', hint: 'Paste a rough note; Claude refines against the rules.' },
};

export default function NewDocumentPage({ params }: { params: { templateId: string } }) {
  const { templateId } = params;
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [autoFilledFrom, setAutoFilledFrom] = useState<Record<string, SourceMode>>({});
  const [step, setStep] = useState<WizardStep>(2);
  const [source, setSource] = useState<SourceMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [generated, setGenerated] = useState<{ documentId: string; downloadUrl: string } | null>(null);
  const [sttResult, setSttResult] = useState<{
    mode: string; provider: string; rawText: string; enhancedText: string;
    confidence: number; durationSec?: number;
    stages: Array<{ stage: string; ms: number; mode: string }>;
  } | null>(null);
  const [sttView, setSttView] = useState<'enhanced' | 'raw'>('enhanced');
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/templates/${templateId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setConfig(res.data);
        else setToast({ kind: 'err', msg: res.error || 'Failed to load template' });
      });
  }, [templateId]);

  const required = useMemo(() => {
    if (!config) return [] as Section[];
    return config.sections.filter(s => s.required && s.id !== 'header_kingdom');
  }, [config]);

  const missing = useMemo(() => {
    return required.filter(s => {
      const v = data[s.id];
      if (s.type === 'signature') {
        return !(data[`${s.id}_name`]?.trim() || data.signer_name?.trim());
      }
      return !(typeof v === 'string' && v.trim());
    });
  }, [required, data]);

  async function uploadForAutoFill(kind: 'ocr' | 'stt', file: File) {
    setBusy(true);
    setToast(null);
    if (kind === 'stt') setSttResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/ai/${kind}`, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      const fields = json.data.fields || {};
      setData(prev => ({ ...prev, ...fields }));
      setAutoFilledFrom(prev => {
        const next = { ...prev };
        for (const k of Object.keys(fields)) next[k] = kind;
        return next;
      });
      if (kind === 'stt') {
        setSttResult({
          mode: json.data.mode,
          provider: json.data.provider,
          rawText: json.data.rawText ?? '',
          enhancedText: json.data.enhancedText ?? json.data.cleanText ?? '',
          confidence: json.data.confidence ?? 0,
          durationSec: json.data.durationSec,
          stages: json.data.stages ?? [],
        });
      }
      const stageSummary = kind === 'stt' && Array.isArray(json.data.stages)
        ? ' · ' + json.data.stages.map((s: any) => `${s.stage}:${s.mode}`).join(' ')
        : '';
      setToast({
        kind: 'ok',
        msg: `បំពេញដោយ ${kind.toUpperCase()} ✓ (${json.data.mode} · ${Math.round((json.data.confidence ?? 0) * 100)}%)${stageSummary}`,
      });
      setStep(3);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (audioRef.current) audioRef.current.value = '';
    }
  }

  async function refineWithAI() {
    if (!aiDraft.trim()) {
      setToast({ kind: 'err', msg: 'Paste some rough text first.' });
      return;
    }
    setBusy(true);
    setToast(null);
    setData(prev => ({ ...prev, body: '' }));
    setAutoFilledFrom(prev => ({ ...prev, body: 'ai' }));
    try {
      const res = await fetch('/api/ai/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          templateId,
          data: { body: aiDraft },
          additionalContext: aiDraft,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalMode = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = frame.split('\n');
          let event = 'message';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) dataLine += line.slice(6);
          }
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine);
            if (event === 'token' && typeof parsed.text === 'string') {
              setData(prev => ({ ...prev, body: (prev.body ?? '') + parsed.text }));
            } else if (event === 'done') {
              finalMode = parsed.mode ?? '';
            } else if (event === 'error') {
              throw new Error(parsed.message || 'stream error');
            }
          } catch (e: any) {
            if (event === 'error') throw e;
          }
        }
      }
      setToast({ kind: 'ok', msg: `បានរួមបញ្ចូល AI ✓${finalMode ? ` (${finalMode})` : ''}` });
      setStep(3);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (missing.length > 0) {
      setToast({ kind: 'err', msg: `Fill required: ${missing.slice(0, 3).map(s => s.labelKm).join(', ')}…` });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, data }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setGenerated({ documentId: json.data.documentId, downloadUrl: json.data.downloadUrl });
      setToast({
        kind: 'ok',
        msg: `រក្សាទុករួច ✓ · id ${json.data.documentId.slice(0, 8)}`,
      });
      const dl = await fetch(json.data.downloadUrl);
      const blob = await dl.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateId}-${json.data.documentId.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message || 'Generation failed' });
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (!generated) {
      await generate();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${generated.documentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setToast({ kind: 'ok', msg: 'ដាក់ស្នើពិនិត្យរួច ✓' });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <Link href="/documents/new" className="text-xs text-kgd-blue hover:underline">
              ← ប្តូរគំរូ
            </Link>
            <h1 className="font-khmer text-xl md:text-2xl font-bold text-kgd-text truncate">
              {config?.nameKm ?? 'កំពុងផ្ទុក…'}
            </h1>
            <p className="text-xs text-kgd-muted">{config?.name ?? templateId}</p>
          </div>
          <Stepper step={step} />
        </div>

        {!config ? (
          <div className="space-y-3">
            <Skeleton height={120} />
            <Skeleton height={400} />
          </div>
        ) : (
          <>
            {step === 2 && (
              <StepSource
                source={source}
                setSource={setSource}
                onManual={() => { setSource('manual'); setStep(3); }}
                onUploadPdf={() => fileRef.current?.click()}
                onUploadAudio={() => audioRef.current?.click()}
                aiDraft={aiDraft}
                setAiDraft={setAiDraft}
                onRefineAI={refineWithAI}
                busy={busy}
              />
            )}

            {step === 3 && (
              <>
                {sttResult && (
                  <SttResultPanel
                    result={sttResult}
                    view={sttView}
                    setView={setSttView}
                    onUseText={(text) => {
                      setData(prev => ({ ...prev, discussions: text, body: prev.body || text }));
                      setAutoFilledFrom(prev => ({ ...prev, discussions: 'stt' }));
                    }}
                  />
                )}
                <StepFields
                  config={config}
                  data={data}
                  setData={setData}
                  autoFilledFrom={autoFilledFrom}
                  templateId={templateId}
                />
              </>
            )}

            {step === 4 && (
              <StepReview
                config={config}
                data={data}
                required={required}
                missing={missing}
                generated={generated}
                onGenerate={generate}
                onSubmitReview={submitForReview}
                busy={busy}
              />
            )}

            {/* Footer nav */}
            <div className="sticky bottom-0 -mx-4 md:-mx-6 mt-6 bg-kgd-surface/95 backdrop-blur border-t border-kgd-border px-4 md:px-6 py-3 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (s > 2 ? ((s - 1) as WizardStep) : s))}
                disabled={step === 2}
              >
                ← ត្រឡប់ក្រោយ
              </Button>
              <div className="flex items-center gap-2 text-xs text-kgd-muted">
                {step === 3 && missing.length > 0 && (
                  <Badge tone="amber">បាត់ {missing.length} វាល</Badge>
                )}
              </div>
              {step < 4 ? (
                <Button onClick={() => setStep((s) => ((s + 1) as WizardStep))} disabled={step === 2 && !source}>
                  បន្ទាប់ →
                </Button>
              ) : (
                <Button variant="gold" onClick={generate} loading={busy} disabled={missing.length > 0}>
                  ⬇ បង្កើត + ទាញយក
                </Button>
              )}
            </div>
          </>
        )}

        {/* Hidden upload inputs */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setSource('ocr'); uploadForAutoFill('ocr', f); }
          }}
        />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setSource('stt'); uploadForAutoFill('stt', f); }
          }}
        />

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-24 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-khmer max-w-sm
              ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-kgd-red text-white'}`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stepper({ step }: { step: WizardStep }) {
  const steps = [
    { n: 1, km: 'គំរូ', en: 'Template' },
    { n: 2, km: 'ប្រភព', en: 'Source' },
    { n: 3, km: 'បំពេញ', en: 'Fields' },
    { n: 4, km: 'ពិនិត្យ', en: 'Review' },
  ];
  return (
    <ol className="flex items-center gap-2 text-xs flex-wrap">
      {steps.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-kgd-blue text-white' : 'bg-kgd-elevated text-kgd-muted'}`}
            >
              {done ? '✓' : s.n}
            </span>
            <span className={`font-khmer ${active ? 'text-kgd-text font-bold' : 'text-kgd-muted'}`}>
              {s.km}
            </span>
            {i < steps.length - 1 && <span className="text-kgd-border">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

function StepSource({
  source, setSource, onManual, onUploadPdf, onUploadAudio,
  aiDraft, setAiDraft, onRefineAI, busy,
}: {
  source: SourceMode | null;
  setSource: (s: SourceMode) => void;
  onManual: () => void;
  onUploadPdf: () => void;
  onUploadAudio: () => void;
  aiDraft: string;
  setAiDraft: (v: string) => void;
  onRefineAI: () => void;
  busy: boolean;
}) {
  return (
    <section className="bg-kgd-surface border border-kgd-border rounded-2xl p-6">
      <h2 className="font-khmer font-bold text-lg mb-1 text-kgd-text">ចាប់ផ្តើមពីអ្វី?</h2>
      <p className="text-sm text-kgd-muted mb-4">Pick how you'd like to populate this document.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(SOURCE_META) as SourceMode[]).map(m => {
          const meta = SOURCE_META[m];
          const active = source === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSource(m);
                if (m === 'manual') onManual();
                if (m === 'ocr') onUploadPdf();
                if (m === 'stt') onUploadAudio();
              }}
              disabled={busy}
              className={`text-left p-4 rounded-xl border-2 transition-colors
                ${active ? 'border-kgd-blue bg-blue-50' : 'border-kgd-border hover:border-kgd-blue/50 bg-kgd-surface'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{meta.icon}</span>
                <span className="font-khmer font-bold">{meta.labelKm}</span>
              </div>
              <p className="text-xs text-kgd-muted mt-2">{meta.labelEn} — {meta.hint}</p>
            </button>
          );
        })}
      </div>

      {source === 'ai' && (
        <div className="mt-4 border-t border-kgd-border pt-4">
          <label className="font-khmer text-sm font-bold block mb-2">
            បិទភ្ជាប់សេចក្តីព្រាង
          </label>
          <Textarea
            rows={6}
            value={aiDraft}
            onChange={e => setAiDraft(e.target.value)}
            placeholder="ខ្ញុំសូមស្នើសុំការអនុម័តថវិកា…"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={onRefineAI} loading={busy} disabled={!aiDraft.trim()}>
              🤖 Refine with AI
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function StepFields({
  config, data, setData, autoFilledFrom, templateId,
}: {
  config: TemplateConfig;
  data: Record<string, string>;
  setData: (v: Record<string, string>) => void;
  autoFilledFrom: Record<string, SourceMode>;
  templateId: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-kgd-surface border border-kgd-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-khmer font-bold text-lg text-kgd-text">បំពេញព័ត៌មាន</h2>
          {Object.keys(autoFilledFrom).length > 0 && (
            <Badge tone="blue">{Object.keys(autoFilledFrom).length} auto-filled</Badge>
          )}
        </div>
        <DocumentFormWithBadges
          sections={config.sections}
          data={data}
          onChange={setData}
          autoFilledFrom={autoFilledFrom}
        />
      </section>
      <section className="lg:sticky lg:top-20 self-start">
        <h2 className="font-khmer font-bold text-lg mb-3 text-kgd-text">មើលជាមុន</h2>
        <div className="overflow-auto max-h-[80vh] rounded-xl">
          <DocumentPreview templateId={templateId} data={data} />
        </div>
      </section>
    </div>
  );
}

function DocumentFormWithBadges({
  sections, data, onChange, autoFilledFrom,
}: {
  sections: Section[];
  data: Record<string, string>;
  onChange: (d: Record<string, string>) => void;
  autoFilledFrom: Record<string, SourceMode>;
}) {
  // Wrap the existing DocumentForm but render our own badges above the field
  // by injecting a small banner block. For simplicity we render DocumentForm
  // and show a summary of auto-filled fields at the top.
  const autoFilledIds = Object.keys(autoFilledFrom);
  return (
    <>
      {autoFilledIds.length > 0 && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
          <p className="font-khmer font-bold text-kgd-blue mb-1">បំពេញដោយស្វ័យប្រវត្តិ</p>
          <div className="flex flex-wrap gap-1">
            {autoFilledIds.map(id => (
              <span key={id} className="inline-flex items-center gap-1 bg-kgd-surface border border-blue-200 rounded-full px-2 py-0.5">
                <span className="text-kgd-blue">{id}</span>
                <span className="text-[10px] uppercase text-kgd-muted">· {autoFilledFrom[id]}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <DocumentForm sections={sections} data={data} onChange={onChange} />
    </>
  );
}

function StepReview({
  config, data, required, missing, generated, onGenerate, onSubmitReview, busy,
}: {
  config: TemplateConfig;
  data: Record<string, string>;
  required: Section[];
  missing: Section[];
  generated: { documentId: string; downloadUrl: string } | null;
  onGenerate: () => void;
  onSubmitReview: () => void;
  busy: boolean;
}) {
  const filled = required.length - missing.length;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-kgd-surface border border-kgd-border rounded-2xl p-6">
        <h2 className="font-khmer font-bold text-lg text-kgd-text mb-3">សង្ខេប</h2>
        <dl className="text-sm grid grid-cols-[140px_1fr] gap-3">
          <dt className="text-kgd-muted text-xs uppercase">Template</dt>
          <dd className="font-khmer">{config.nameKm} · {config.name}</dd>
          <dt className="text-kgd-muted text-xs uppercase">Category</dt>
          <dd>{config.category}</dd>
          <dt className="text-kgd-muted text-xs uppercase">Fields</dt>
          <dd>
            <span className={filled === required.length ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
              {filled} / {required.length}
            </span>{' '}
            required filled
          </dd>
        </dl>

        <h3 className="font-khmer font-bold mt-5 mb-2 text-kgd-text">បញ្ជីផ្ទៀងផ្ទាត់</h3>
        <ul className="text-sm space-y-1">
          {required.map(s => {
            const ok = !missing.find(m => m.id === s.id);
            return (
              <li key={s.id} className="flex items-start gap-2">
                <span className={ok ? 'text-emerald-600' : 'text-amber-600'}>{ok ? '✓' : '⚠'}</span>
                <span className="font-khmer">{s.labelKm}</span>
                <span className="text-xs text-kgd-muted/80">{s.label}</span>
              </li>
            );
          })}
        </ul>

        {generated && (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="font-khmer text-sm">
              បានរក្សាទុក · <span className="font-mono text-xs">#{generated.documentId.slice(0, 8)}</span>
            </p>
            <div className="flex gap-2 mt-2">
              <a href={generated.downloadUrl}>
                <Button size="sm" variant="secondary">⬇ DOCX ម្តងទៀត</Button>
              </a>
              <Button size="sm" onClick={onSubmitReview} loading={busy}>
                ដាក់ស្នើពិនិត្យ
              </Button>
              <Link href={`/documents/${generated.documentId}`}>
                <Button size="sm" variant="ghost">បើក →</Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="lg:sticky lg:top-20 self-start">
        <h2 className="font-khmer font-bold text-lg mb-3 text-kgd-text">មើលចុងក្រោយ</h2>
        <div className="overflow-auto max-h-[80vh] rounded-xl">
          <DocumentPreview templateId={config.id} data={data} />
        </div>
      </section>
    </div>
  );
}

function SttResultPanel({
  result, view, setView, onUseText,
}: {
  result: {
    mode: string; provider: string; rawText: string; enhancedText: string;
    confidence: number; durationSec?: number;
    stages: Array<{ stage: string; ms: number; mode: string }>;
  };
  view: 'enhanced' | 'raw';
  setView: (v: 'enhanced' | 'raw') => void;
  onUseText: (text: string) => void;
}) {
  const text = view === 'enhanced' ? result.enhancedText : result.rawText;
  const stageTone = (m: string) =>
    m === 'live' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
    : m === 'mock' ? 'bg-amber-100 text-amber-700 border-amber-300'
    : 'bg-kgd-elevated/60 text-kgd-muted border-kgd-border';
  return (
    <div className="mb-4 bg-kgd-surface border border-kgd-border rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-khmer font-bold text-sm">🎤 STT</span>
          {result.stages.map(s => (
            <span
              key={s.stage}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${stageTone(s.mode)}`}
              title={`${s.stage} · ${s.mode} · ${s.ms} ms`}
            >
              {s.stage}:{s.mode} · {s.ms}ms
            </span>
          ))}
          <span className="text-xs text-kgd-muted">
            {result.provider} · {Math.round((result.confidence ?? 0) * 100)}%
            {result.durationSec ? ` · ${result.durationSec}s audio` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView('enhanced')}
            className={`text-xs px-2 py-1 rounded-l border ${view === 'enhanced' ? 'bg-slate-800 text-white border-slate-800' : 'bg-kgd-surface text-kgd-muted border-kgd-border'}`}
          >Enhanced</button>
          <button
            type="button"
            onClick={() => setView('raw')}
            className={`text-xs px-2 py-1 rounded-r border ${view === 'raw' ? 'bg-slate-800 text-white border-slate-800' : 'bg-kgd-surface text-kgd-muted border-kgd-border'}`}
          >Raw</button>
        </div>
      </div>
      <pre className="mt-3 font-khmer text-sm whitespace-pre-wrap max-h-48 overflow-auto bg-kgd-elevated p-3 rounded-lg border border-kgd-border">
        {text || '(empty)'}
      </pre>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => onUseText(text)}>
          ប្រើអត្ថបទនេះ →
        </Button>
      </div>
    </div>
  );
}
