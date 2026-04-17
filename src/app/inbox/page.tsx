'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../_components/AppShell';
import { Button, Badge, Skeleton, EmptyState } from '../../frontend/components/atoms';

interface Thread {
  id: string;
  title: string;
  titleKm?: string;
  templateId: string;
  status: string;
  currentLevel: number;
  bounceCount: number;
  currentVersion: number;
  priority: string;
  direction: string;
  createdAt?: any;
  updatedAt?: any;
}

interface InboxSection {
  key: string;
  labelKm: string;
  labelEn: string;
  threads: Thread[];
}

interface InboxStats {
  drafts: number;
  pendingReview: number;
  bounced: number;
  sentUp: number;
  signed: number;
  total: number;
}

const STATUS_BADGE: Record<string, { tone: 'sky' | 'emerald' | 'amber' | 'neutral'; label: string }> = {
  CREATED:        { tone: 'neutral', label: 'Draft' },
  SUBMITTED:      { tone: 'sky',     label: 'Submitted' },
  IN_REVIEW:      { tone: 'sky',     label: 'In Review' },
  APPROVED_LEVEL: { tone: 'emerald', label: 'Approved' },
  BOUNCED:        { tone: 'amber',   label: 'Bounced' },
  REVISION:       { tone: 'amber',   label: 'Revising' },
  RESUBMITTED:    { tone: 'sky',     label: 'Resubmitted' },
  PENDING_SIGN:   { tone: 'emerald', label: 'Pending Sign' },
  SIGNED:         { tone: 'emerald', label: 'Signed' },
  ARCHIVED:       { tone: 'neutral', label: 'Archived' },
  CANCELLED:      { tone: 'neutral', label: 'Cancelled' },
};

const SECTION_ICONS: Record<string, string> = {
  drafts: '📝', bounced: '🔄', pending: '📥', sent: '📤',
  completed: '✅', awaiting: '📋', sign: '✍', review: '📥', signed: '✅',
};

const api = (path: string) => fetch(path).then(r => r.json());

export default function InboxPage() {
  const [sections, setSections] = useState<InboxSection[] | null>(null);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      api('/api/threads/inbox/mine'),
      api('/api/threads/inbox/stats'),
    ]).then(([inbox, st]) => {
      if (inbox.success) {
        setSections(inbox.data);
        // Auto-expand sections with threads
        const nonEmpty = new Set<string>(inbox.data.filter((s: InboxSection) => s.threads.length > 0).map((s: InboxSection) => s.key));
        setExpanded(nonEmpty);
      }
      if (st.success) setStats(st.data);
    });
  }, []);

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <h1 className="text-xl font-khmer-header text-kgd-text mb-4">
          ប្រអប់សំបុត្រ · <span className="text-kgd-blue">Inbox</span>
        </h1>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
            {[
              { label: 'Drafts', value: stats.drafts, icon: '📝' },
              { label: 'Pending', value: stats.pendingReview, icon: '📥' },
              { label: 'Bounced', value: stats.bounced, icon: '🔄' },
              { label: 'Sent Up', value: stats.sentUp, icon: '📤' },
              { label: 'Signed', value: stats.signed, icon: '✅' },
              { label: 'Total', value: stats.total, icon: '📊' },
            ].map(s => (
              <div key={s.label} className="bg-kgd-surface border border-kgd-border rounded-lg p-3 text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="text-2xl font-bold text-kgd-text">{s.value}</div>
                <div className="text-xs text-kgd-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sections */}
        {sections === null ? (
          <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : sections.length === 0 ? (
          <EmptyState title="Empty inbox" description="No threads assigned to you." />
        ) : (
          <div className="space-y-3">
            {sections.map(section => (
              <div key={section.key} className="bg-kgd-surface border border-kgd-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated transition-colors"
                >
                  <span className="text-lg">{SECTION_ICONS[section.key] || '📄'}</span>
                  <span className="flex-1 text-left">
                    <span className="text-sm font-khmer text-kgd-text">{section.labelKm}</span>
                    <span className="text-xs text-kgd-muted ml-2">{section.labelEn}</span>
                  </span>
                  <Badge tone={section.threads.length > 0 ? 'sky' : 'neutral'}>
                    {section.threads.length}
                  </Badge>
                  <span className="text-kgd-muted text-xs">{expanded.has(section.key) ? '▼' : '▶'}</span>
                </button>

                {expanded.has(section.key) && section.threads.length > 0 && (
                  <div className="border-t border-kgd-border/60">
                    {section.threads.map(t => {
                      const sb = STATUS_BADGE[t.status] || { tone: 'neutral' as const, label: t.status };
                      return (
                        <Link
                          key={t.id}
                          href={`/inbox/${t.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated border-b border-kgd-border/40 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-kgd-text truncate">{t.titleKm || t.title}</div>
                            <div className="text-xs text-kgd-muted">
                              L{t.currentLevel} · v{t.currentVersion}
                              {t.bounceCount > 0 && <span className="text-amber-400 ml-1">({t.bounceCount} bounces)</span>}
                            </div>
                          </div>
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                          {t.priority === 'urgent' && <span className="text-red-400 text-xs font-bold">URGENT</span>}
                          <span className="text-kgd-muted text-sm">{t.direction === 'up' ? '↑' : '↓'}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
