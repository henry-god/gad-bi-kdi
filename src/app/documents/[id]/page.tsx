'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '../../_components/AppShell';
import { downloadAuthed } from '../../../frontend/utils/authFetch';

interface Doc {
  id: string;
  templateId: string;
  status: string;
  title: string;
  titleKm: string | null;
  version: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  inputData: Record<string, any>;
}

interface HistoryStep {
  id: string;
  stepOrder: number;
  action: string;
  comments: string | null;
  status: string;
  createdAt: string;
  actor: { id: string; name: string; nameKm: string | null; role: string };
}

interface Me {
  id: string;
  email: string;
  role: 'admin' | 'officer' | 'reviewer' | 'signer';
}

const STATUS_LABEL: Record<string, { km: string; color: string }> = {
  draft:          { km: 'ព្រាង',             color: 'bg-gray-200 text-gray-700' },
  pending_review: { km: 'កំពុងពិនិត្យ',        color: 'bg-yellow-100 text-yellow-800' },
  reviewed:       { km: 'បានពិនិត្យ',         color: 'bg-blue-100 text-blue-800' },
  approved:       { km: 'បានអនុម័ត',          color: 'bg-green-100 text-green-800' },
  signed:         { km: 'បានចុះហត្ថលេខា',       color: 'bg-emerald-100 text-emerald-800' },
  archived:       { km: 'រក្សាទុក',           color: 'bg-gray-300 text-gray-700' },
};

const ACTION_LABEL: Record<string, string> = {
  submit: 'ដាក់ស្នើ', review: 'បានពិនិត្យ', approve: 'អនុម័ត',
  reject: 'បដិសេធ', sign: 'ចុះហត្ថលេខា', archive: 'រក្សាទុក',
};

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [docRes, histRes, meRes] = await Promise.all([
      fetch(`/api/documents/${params.id}`).then(r => r.json()),
      fetch(`/api/documents/${params.id}/history`).then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]);
    if (docRes.success) setDoc(docRes.data); else setError(docRes.error);
    if (histRes.success) setHistory(histRes.data);
    if (meRes.success) setMe(meRes.data);
  }

  useEffect(() => { load(); }, [params.id]);

  async function act(action: string, requireComment = false) {
    if (requireComment && !comments.trim()) {
      setError('Please enter comments before rejecting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${params.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: comments || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setComments('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!doc) {
    return (
      <AppShell>
        <main className="max-w-5xl mx-auto p-6">
          {error ? <p className="text-kgd-red">{error}</p> : <p className="text-kgd-muted">កំពុងផ្ទុក…</p>}
        </main>
      </AppShell>
    );
  }

  const statusInfo = STATUS_LABEL[doc.status] || { km: doc.status, color: 'bg-gray-200' };
  const isOwner = me?.id === doc.userId;
  const canReview = me && ['reviewer', 'admin'].includes(me.role);
  const canSign = me && ['signer', 'admin'].includes(me.role);
  const canArchive = me?.role === 'admin';

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto p-6">
        <Link href="/documents" className="text-sm text-kgd-blue hover:underline">← ឯកសាររបស់ខ្ញុំ</Link>

        <div className="mt-3 bg-kgd-surface border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase text-gray-500">{doc.templateId}</p>
              <h1 className="font-khmer text-xl font-bold mt-1">{doc.titleKm || doc.title}</h1>
              <p className="text-xs text-gray-400 mt-1">
                v{doc.version} · created {new Date(doc.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-khmer ${statusInfo.color}`}>
                {statusInfo.km}
              </span>
              <button
                onClick={() => downloadAuthed(
                  `/api/documents/${doc.id}/download`,
                  `${doc.templateId}-${doc.id.slice(0, 8)}.docx`,
                )}
                className="text-sm text-kgd-blue hover:underline font-khmer"
              >
                ⬇ ទាញយក DOCX
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {doc.status === 'draft' && isOwner && (
              <button onClick={() => act('submit')} disabled={busy}
                className="bg-kgd-blue text-white px-4 py-2 rounded-lg font-khmer text-sm disabled:opacity-50">
                ដាក់ស្នើ (Submit for review)
              </button>
            )}
            {(doc.status === 'pending_review' || doc.status === 'reviewed') && canReview && (
              <>
                <button onClick={() => act('approve')} disabled={busy}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-khmer text-sm disabled:opacity-50">
                  ✓ អនុម័ត (Approve)
                </button>
                <button onClick={() => act('reject', true)} disabled={busy}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-khmer text-sm disabled:opacity-50">
                  ✗ បដិសេធ (Reject)
                </button>
              </>
            )}
            {doc.status === 'approved' && canSign && (
              <button onClick={() => act('sign')} disabled={busy}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-khmer text-sm disabled:opacity-50">
                ✎ ចុះហត្ថលេខា (Sign)
              </button>
            )}
            {doc.status === 'signed' && canArchive && (
              <button onClick={() => act('archive')} disabled={busy}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-khmer text-sm disabled:opacity-50">
                📦 រក្សាទុក (Archive)
              </button>
            )}
          </div>

          {(doc.status === 'pending_review' || doc.status === 'reviewed') && canReview && (
            <div className="mt-3">
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="មតិយោបល់ (Comments — required for reject)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-khmer text-sm outline-none focus:border-kgd-blue"
              />
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-kgd-surface border border-gray-200 rounded-lg p-6">
            <h2 className="font-khmer font-bold mb-3">ព័ត៌មានឯកសារ</h2>
            <dl className="text-sm">
              {Object.entries(doc.inputData || {}).map(([k, v]) => (
                <div key={k} className="py-2 border-b border-gray-100 grid grid-cols-[140px_1fr] gap-3">
                  <dt className="text-gray-500 text-xs uppercase">{k}</dt>
                  <dd className="font-khmer whitespace-pre-wrap break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-kgd-surface border border-gray-200 rounded-lg p-6">
            <h2 className="font-khmer font-bold mb-3">ប្រវត្តិដំណើរការ</h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 font-khmer">មិនទាន់មានសកម្មភាព</p>
            ) : (
              <ol className="space-y-3">
                {history.map(h => (
                  <li key={h.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-kgd-blue font-mono">{h.stepOrder}.</span>
                      <div className="flex-1">
                        <div className="font-khmer font-bold">{ACTION_LABEL[h.action] || h.action}</div>
                        <div className="text-xs text-gray-500">
                          {h.actor.nameKm || h.actor.name} · {h.actor.role}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(h.createdAt).toLocaleString()}
                        </div>
                        {h.comments && (
                          <div className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs font-khmer">
                            {h.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
