'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '../_components/AppShell';
import DocumentDrawer from '../_components/DocumentDrawer';
import {
  Button,
  Input,
  Skeleton,
  EmptyState,
  StatusChip,
  type DocumentStatus,
} from '../../frontend/components/atoms';
import { downloadAuthed } from '../../frontend/utils/authFetch';

interface DocRow {
  id: string;
  templateId: string;
  status: string;
  title: string;
  titleKm: string | null;
  version: number;
  updatedAt: string;
  createdAt: string;
}

const STATUS_FILTERS: Array<'' | DocumentStatus> = [
  '',
  'draft',
  'pending_review',
  'reviewed',
  'approved',
  'signed',
  'archived',
];

export default function DocumentsListPage() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | DocumentStatus>('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(r => {
        if (r.success) setDocs(r.data);
        else setError(r.error);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!docs) return [];
    return docs.filter(d => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (d.title ?? '').toLowerCase().includes(q) ||
          (d.titleKm ?? '').toLowerCase().includes(q) ||
          d.templateId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [docs, search, statusFilter]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="font-khmer text-2xl font-bold text-kgd-text">ឯកសាររបស់ខ្ញុំ</h1>
            <p className="text-sm text-kgd-muted">My documents · {filtered.length} item(s)</p>
          </div>
          <Link href="/documents/new">
            <Button variant="gold">+ ឯកសារថ្មី</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="ស្វែងរក… (search title or template)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-khmer transition-colors
                  ${statusFilter === s
                    ? 'bg-kgd-blue text-white'
                    : 'bg-kgd-surface text-kgd-muted border border-kgd-border hover:bg-kgd-elevated'}`}
              >
                {s === '' ? 'ទាំងអស់' : <StatusChip status={s} />}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4 font-khmer">
            {error}
          </div>
        )}

        {/* Table / list */}
        {docs === null ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height={60} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📄"
            titleKm={search || statusFilter ? 'មិនមានលទ្ធផល' : 'មិនទាន់មានឯកសារ'}
            title={search || statusFilter ? 'No matches' : 'No documents yet'}
            action={
              !search && !statusFilter ? (
                <Link href="/documents/new"><Button>បង្កើតឯកសារ</Button></Link>
              ) : undefined
            }
          />
        ) : (
          <div className="bg-kgd-surface border border-kgd-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-kgd-elevated text-left text-xs uppercase text-kgd-muted">
                <tr>
                  <th className="px-4 py-3 font-khmer">ចំណងជើង · Title</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3 font-khmer">ស្ថានភាព</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">ទាញយក</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr
                    key={d.id}
                    className="border-t border-kgd-border/50 hover:bg-kgd-elevated cursor-pointer"
                    onClick={() => setDrawerId(d.id)}
                  >
                    <td className="px-4 py-3 font-khmer max-w-md truncate">
                      {d.titleKm || d.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-kgd-muted">{d.templateId}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-kgd-muted">
                      {new Date(d.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          downloadAuthed(
                            `/api/documents/${d.id}/download`,
                            `${d.templateId}-${d.id.slice(0, 8)}.docx`,
                          ).catch(err => alert(err.message));
                        }}
                        className="text-xs text-kgd-blue hover:underline font-khmer"
                      >
                        ⬇ DOCX
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentDrawer
        documentId={drawerId}
        onClose={() => setDrawerId(null)}
      />
    </AppShell>
  );
}
