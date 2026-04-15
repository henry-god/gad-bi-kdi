'use client';

import { useEffect, useState } from 'react';
import AppShell from '../_components/AppShell';

interface Setting {
  key: string;
  group: string;
  value: string | null;
  secret: boolean;
  description: string | null;
  hasValue: boolean;
  updatedAt: string | null;
}

const GROUP_LABEL: Record<string, { km: string; en: string; icon: string }> = {
  llm:            { km: 'ម៉ូឌែល AI សម្រាប់រាងឯកសារ', en: 'LLM (document drafting)',     icon: '🤖' },
  ocr:            { km: 'OCR (អាន PDF)',              en: 'OCR (PDF → text)',             icon: '📷' },
  stt:            { km: 'បំលែងសំឡេងទៅអត្ថបទ',        en: 'STT (audio → text)',           icon: '🎤' },
  auth:           { km: 'ការផ្ទៀងផ្ទាត់',              en: 'Authentication',                icon: '🔐' },
  knowledge:      { km: 'មូលដ្ឋានចំណេះដឹង',          en: 'Knowledge + graph',             icon: '📚' },
  storage:        { km: 'ការផ្ទុកឯកសារ',               en: 'Object storage',                icon: '💾' },
  notifications:  { km: 'ការជូនដំណឹង',                 en: 'Notifications',                 icon: '🔔' },
  organization:   { km: 'ព័ត៌មានស្ថាប័ន',             en: 'Organization (letterhead)',     icon: '🏛️' },
  deployment:     { km: 'ការដាក់ឲ្យដំណើរការ',         en: 'Deployment flags',              icon: '🚀' },
  other:          { km: 'ផ្សេងៗ',                      en: 'Other',                         icon: '⚙' },
};

interface Me {
  id: string;
  email: string;
  role: 'admin' | 'officer' | 'reviewer' | 'signer';
}

export default function SettingsPage() {
  const [items, setItems] = useState<Setting[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    const [meRes, setRes] = await Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]);
    if (meRes.success) setMe(meRes.data);
    if (setRes.success) setItems(setRes.data);
    else setError(setRes.error);
  }

  useEffect(() => { load(); }, []);

  async function save(key: string) {
    const value = drafts[key];
    if (value === undefined) return;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      setDrafts(prev => { const c = { ...prev }; delete c[key]; return c; });
      setToast(`Saved ${key}`);
      setTimeout(() => setToast(null), 2500);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-4">
          <h1 className="font-khmer text-2xl font-bold">ការកំណត់ API</h1>
          <p className="text-sm text-gray-500">
            API Settings — paste your keys here. Values override environment variables and take
            effect immediately (5s cache).
          </p>
        </div>

        {me && me.role !== 'admin' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-4 text-sm">
            Admin role required. Current role: <b>{me.role}</b>. Switch user (top-right) to an
            admin account to edit settings.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {items && me?.role === 'admin' && (() => {
          const byGroup: Record<string, Setting[]> = {};
          for (const s of items) {
            (byGroup[s.group] = byGroup[s.group] || []).push(s);
          }
          const order = ['llm', 'ocr', 'stt', 'auth', 'knowledge', 'storage', 'notifications', 'organization', 'deployment', 'other'];
          return (
          <div className="space-y-8">
            {order.filter(g => byGroup[g]).map(group => (
            <section key={group}>
              <h2 className="font-khmer text-lg font-bold text-kgd-text mb-3 flex items-center gap-2">
                <span aria-hidden>{GROUP_LABEL[group]?.icon || '⚙'}</span>
                {GROUP_LABEL[group]?.km || group}
                <span className="text-xs font-normal text-kgd-muted/80">· {GROUP_LABEL[group]?.en || group}</span>
              </h2>
              <div className="space-y-3">
            {byGroup[group].map(s => (
              <div key={s.key} className="bg-kgd-surface border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-bold">{s.key}</code>
                      {s.secret && (
                        <span className="text-[10px] uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          secret
                        </span>
                      )}
                      {s.hasValue ? (
                        <span className="text-[10px] uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          set
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          empty
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                    {s.hasValue && (
                      <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                        current: {s.value}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {s.key === 'FIREBASE_SERVICE_ACCOUNT_JSON' ? (
                    <textarea
                      rows={3}
                      value={drafts[s.key] ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder={'{ "type": "service_account", ... }'}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 font-mono text-xs outline-none focus:border-kgd-blue"
                    />
                  ) : (
                    <input
                      type={s.secret ? 'password' : 'text'}
                      value={drafts[s.key] ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder={s.hasValue ? '••• paste new value to replace •••' : 'Enter value'}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 font-mono text-sm outline-none focus:border-kgd-blue"
                    />
                  )}
                  <button
                    onClick={() => save(s.key)}
                    disabled={drafts[s.key] === undefined || savingKey === s.key}
                    className="bg-kgd-blue text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                  >
                    {savingKey === s.key ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
            </div>
            </section>
            ))}
          </div>
          );
        })()}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded shadow-lg text-sm">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
