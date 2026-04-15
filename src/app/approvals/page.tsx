'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '../_components/AppShell';
import DocumentDrawer from '../_components/DocumentDrawer';
import { Button, StatusChip, Skeleton, EmptyState, Badge } from '../../frontend/components/atoms';

interface PendingDoc {
  id: string;
  templateId: string;
  status: string;
  title: string;
  titleKm: string | null;
  updatedAt: string;
  user: { id: string; name: string; nameKm: string | null; department: string | null };
}

export default function ApprovalsPage() {
  const [docs, setDocs] = useState<PendingDoc[] | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/approvals/pending').then(r => r.json());
    if (res.success) setDocs(res.data);
    else setError(res.error);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (drawerId || !docs || docs.length === 0) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setDrawerId(docs[0].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docs, drawerId]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="font-khmer text-2xl font-bold text-kgd-text">បញ្ជីរង់ចាំពិនិត្យ</h1>
            <p className="text-sm text-kgd-muted">
              Pending review queue · {docs?.length ?? 0} item(s)
            </p>
          </div>
          <Badge tone="blue">j/k navigate · ↵ open</Badge>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm font-khmer mb-4">
            {error}
          </div>
        )}

        {docs === null && !error && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} height={64} />)}
          </div>
        )}

        {docs && docs.length === 0 && (
          <EmptyState
            icon="✅"
            titleKm="មិនមានឯកសាររង់ចាំពិនិត្យ"
            title="Inbox zero"
            bodyKm="ពេលនេះគ្មានឯកសារដែលត្រូវពិនិត្យ។"
          />
        )}

        {docs && docs.length > 0 && (
          <ul className="bg-kgd-surface border border-kgd-border rounded-2xl divide-y divide-kgd-border/50 overflow-hidden">
            {docs.map(d => (
              <li key={d.id}>
                <button
                  onClick={() => setDrawerId(d.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated text-left"
                >
                  <StatusChip status={d.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-khmer text-sm font-bold truncate text-kgd-text">
                      {d.titleKm || d.title}
                    </p>
                    <p className="text-xs text-kgd-muted">
                      ពី{' '}
                      <span className="font-khmer">{d.user.nameKm || d.user.name}</span>
                      {d.user.department && ` · ${d.user.department}`}
                      {' '}· {d.templateId}
                    </p>
                  </div>
                  <div className="text-xs text-kgd-muted/80 shrink-0">
                    {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DocumentDrawer documentId={drawerId} onClose={() => { setDrawerId(null); load(); }} />
    </AppShell>
  );
}
