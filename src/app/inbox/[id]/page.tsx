'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '../../_components/AppShell';
import { Button, Badge, Skeleton } from '../../../frontend/components/atoms';

interface Thread {
  id: string; title: string; titleKm?: string; templateId: string;
  status: string; currentLevel: number; bounceCount: number;
  currentVersion: number; priority: string; direction: string;
  currentHolderId: string; createdById: string;
  latestContent: Record<string, any>;
}

interface Action {
  id: string; actorId: string; actorLevel: number; action: string;
  direction: string; fromLevel: number; toLevel: number;
  notes?: string; notesKm?: string; reasonCode?: string;
  versionBefore: number; versionAfter: number;
  createdAt?: any;
}

interface Version {
  id: string; versionNumber: number; changeSummary?: string;
  changeSummaryKm?: string; createdAt?: any;
}

const ACTION_ICONS: Record<string, string> = {
  CREATE: '📝', SUBMIT: '📤', REVIEW: '🔍', APPROVE: '✅',
  BOUNCE: '🔽', REVISE: '✏', RESUBMIT: '📤', SIGN: '✍',
  ANNOTATE: '💬', ASSIGN: '👤', RECALL: '↩', ARCHIVE: '📦',
};

const STATUS_BADGE: Record<string, { tone: 'sky' | 'emerald' | 'amber' | 'neutral'; label: string }> = {
  CREATED: { tone: 'neutral', label: 'Draft' },
  SUBMITTED: { tone: 'sky', label: 'Submitted' },
  IN_REVIEW: { tone: 'sky', label: 'In Review' },
  APPROVED_LEVEL: { tone: 'emerald', label: 'Approved' },
  BOUNCED: { tone: 'amber', label: 'Bounced' },
  REVISION: { tone: 'amber', label: 'Revising' },
  RESUBMITTED: { tone: 'sky', label: 'Resubmitted' },
  PENDING_SIGN: { tone: 'emerald', label: 'Pending Sign' },
  SIGNED: { tone: 'emerald', label: 'Signed' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
};

const api = (path: string, opts?: RequestInit) => fetch(path, opts).then(r => r.json());

export default function ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [timeline, setTimeline] = useState<Action[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'timeline' | 'content' | 'versions'>('timeline');

  // Action state
  const [actionNotes, setActionNotes] = useState('');
  const [bounceLevel, setBounceLevel] = useState(7);
  const [bounceReason, setBounceReason] = useState('other');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api(`/api/threads/${id}`);
    if (res.success) {
      setThread(res.data.thread);
      setTimeline(res.data.timeline);
      setVersions(res.data.versions);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function doAction(action: string, body: any = {}) {
    setBusy(true);
    const res = await api(`/api/threads/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.success) {
      setActionNotes('');
      load();
    } else {
      alert(res.error);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-3">
          <Skeleton className="h-10" /><Skeleton className="h-40" /><Skeleton className="h-20" />
        </div>
      </AppShell>
    );
  }

  if (!thread) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto p-4 md:p-6 text-kgd-muted">Thread not found.</div>
      </AppShell>
    );
  }

  const sb = STATUS_BADGE[thread.status] || { tone: 'neutral' as const, label: thread.status };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <button onClick={() => router.push('/inbox')} className="text-xs text-kgd-muted hover:text-kgd-blue mb-1">
              ← Back to Inbox
            </button>
            <h1 className="text-lg font-khmer-header text-kgd-text">{thread.titleKm || thread.title}</h1>
            <div className="text-xs text-kgd-muted mt-1">
              {thread.templateId} · L{thread.currentLevel} · v{thread.currentVersion}
              {thread.bounceCount > 0 && <span className="text-amber-400 ml-2">{thread.bounceCount} bounces</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/threads/${id}/generate-docx`}
              className="text-xs bg-kgd-elevated border border-kgd-border rounded px-2 py-1 text-kgd-blue hover:bg-kgd-blue/10 transition-colors"
            >
              Download DOCX
            </a>
            <Badge tone={sb.tone}>{sb.label}</Badge>
            {thread.priority === 'urgent' && <Badge tone="amber">URGENT</Badge>}
            <span className="text-lg">{thread.direction === 'up' ? '↑' : '↓'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-kgd-border">
          {(['timeline', 'content', 'versions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px
                ${tab === t ? 'border-kgd-blue text-kgd-blue' : 'border-transparent text-kgd-muted hover:text-kgd-text'}`}
            >
              {t === 'timeline' ? 'Timeline' : t === 'content' ? 'Content' : 'Versions'}
              {t === 'timeline' && <span className="ml-1 text-xs text-kgd-muted">({timeline.length})</span>}
              {t === 'versions' && <span className="ml-1 text-xs text-kgd-muted">({versions.length})</span>}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {tab === 'timeline' && (
          <div className="space-y-0">
            {timeline.map((a, i) => (
              <div key={a.id} className="flex gap-3 relative">
                {/* Vertical line */}
                {i < timeline.length - 1 && (
                  <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-kgd-border" />
                )}
                <div className="w-8 h-8 rounded-full bg-kgd-elevated border border-kgd-border flex items-center justify-center text-sm shrink-0 z-10">
                  {ACTION_ICONS[a.action] || '•'}
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-sm text-kgd-text">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-kgd-muted ml-2">
                      L{a.fromLevel}
                      {a.fromLevel !== a.toLevel && (
                        <span> → L{a.toLevel} {a.direction === 'up' ? '↑' : a.direction === 'down' ? '↓' : '↔'}</span>
                      )}
                    </span>
                    {a.versionBefore !== a.versionAfter && (
                      <span className="text-kgd-muted ml-2">v{a.versionBefore} → v{a.versionAfter}</span>
                    )}
                  </div>
                  {a.notes && (
                    <div className="mt-1 text-xs text-kgd-muted bg-kgd-elevated rounded p-2 border border-kgd-border/60">
                      {a.notes}
                    </div>
                  )}
                  {a.reasonCode && a.reasonCode !== 'other' && (
                    <Badge tone="amber">{a.reasonCode.replace(/_/g, ' ')}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {tab === 'content' && (
          <div className="bg-kgd-surface border border-kgd-border rounded-lg p-4">
            <pre className="text-sm text-kgd-text whitespace-pre-wrap font-khmer">
              {JSON.stringify(thread.latestContent, null, 2)}
            </pre>
          </div>
        )}

        {/* Versions */}
        {tab === 'versions' && (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="bg-kgd-surface border border-kgd-border rounded-lg p-3 flex items-center gap-3">
                <Badge tone="sky">v{v.versionNumber}</Badge>
                <div className="flex-1 text-sm text-kgd-text">
                  {v.changeSummaryKm || v.changeSummary || 'No summary'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions panel */}
        {!['SIGNED', 'ARCHIVED', 'CANCELLED'].includes(thread.status) && (
          <div className="mt-6 bg-kgd-surface border border-kgd-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-kgd-text mb-3">Actions</h3>
            <textarea
              placeholder="Notes / comments..."
              value={actionNotes}
              onChange={e => setActionNotes(e.target.value)}
              className="w-full bg-kgd-elevated border border-kgd-border rounded px-3 py-2 text-sm text-kgd-text placeholder:text-kgd-muted/60 mb-3 focus:outline-none focus:border-kgd-blue"
              rows={2}
            />

            <div className="flex flex-wrap gap-2">
              {/* Submit up */}
              {['CREATED', 'REVISION'].includes(thread.status) && (
                <Button onClick={() => doAction('submit', { notes: actionNotes, targetHolderId: thread.currentHolderId })}
                  disabled={busy} variant="primary" size="sm">
                  Submit Up ↑
                </Button>
              )}

              {/* Approve */}
              {['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED'].includes(thread.status) && (
                <Button onClick={() => doAction('approve', { notes: actionNotes, targetHolderId: thread.currentHolderId })}
                  disabled={busy} variant="primary" size="sm">
                  Approve ✅
                </Button>
              )}

              {/* Sign */}
              {thread.status === 'PENDING_SIGN' && (
                <Button onClick={() => doAction('sign')} disabled={busy} variant="primary" size="sm">
                  Sign ✍
                </Button>
              )}

              {/* Bounce */}
              {['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED', 'PENDING_SIGN'].includes(thread.status) && (
                <div className="flex items-center gap-1 flex-wrap">
                  <select
                    value={bounceLevel}
                    onChange={e => setBounceLevel(parseInt(e.target.value))}
                    className="bg-kgd-elevated border border-kgd-border rounded px-2 py-1 text-xs text-kgd-text"
                  >
                    {[3,4,5,6,7].filter(l => l > thread.currentLevel).map(l => (
                      <option key={l} value={l}>→ L{l}</option>
                    ))}
                  </select>
                  <select
                    value={bounceReason}
                    onChange={e => setBounceReason(e.target.value)}
                    className="bg-kgd-elevated border border-kgd-border rounded px-2 py-1 text-xs text-kgd-text"
                  >
                    <option value="wrong_reference">Wrong reference</option>
                    <option value="missing_attachment">Missing attachment</option>
                    <option value="incorrect_budget">Incorrect budget</option>
                    <option value="citation_error">Citation error</option>
                    <option value="tone_wording">Tone/wording</option>
                    <option value="missing_parallel_approval">Missing approval</option>
                    <option value="factual_error">Factual error</option>
                    <option value="incomplete_info">Incomplete info</option>
                    <option value="misaligned_directive">Misaligned directive</option>
                    <option value="formatting_violation">Formatting</option>
                    <option value="other">Other</option>
                  </select>
                  <Button
                    onClick={() => doAction('bounce', {
                      toLevel: bounceLevel,
                      targetHolderId: thread.createdById,
                      notes: actionNotes || 'Please revise',
                      reasonCode: bounceReason,
                    })}
                    disabled={busy || !actionNotes}
                    variant="destructive" size="sm"
                  >
                    Bounce ↓
                  </Button>
                </div>
              )}

              {/* Resubmit */}
              {thread.status === 'REVISION' && (
                <Button onClick={() => doAction('resubmit', { notes: actionNotes, targetHolderId: thread.currentHolderId })}
                  disabled={busy} variant="primary" size="sm">
                  Resubmit ↑
                </Button>
              )}

              {/* Annotate */}
              <Button onClick={() => doAction('annotate', { notes: actionNotes })}
                disabled={busy || !actionNotes} variant="secondary" size="sm">
                Add Note 💬
              </Button>

              {/* Cancel */}
              <Button onClick={() => { if (confirm('Cancel this thread?')) doAction('cancel'); }}
                disabled={busy} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Archive */}
        {thread.status === 'SIGNED' && (
          <div className="mt-4">
            <Button onClick={() => doAction('archive')} disabled={busy} variant="secondary" size="sm">
              Archive
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
