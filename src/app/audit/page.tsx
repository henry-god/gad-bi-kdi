'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '../_components/AppShell';
import { Input, Button, Badge, Skeleton, EmptyState } from '../../frontend/components/atoms';

interface AuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; nameKm: string | null; role: string };
}

const ACTION_TONE: Record<string, 'emerald' | 'amber' | 'red' | 'sky' | 'neutral'> = {
  'document.create': 'sky',
  'document.submit': 'amber',
  'document.review': 'sky',
  'document.approve': 'emerald',
  'document.reject': 'red',
  'document.sign': 'emerald',
  'document.archive': 'neutral',
};

export default function AuditPage() {
  const [me, setMe] = useState<any>(null);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(r => r.success && setMe(r.data));
  }, []);

  async function load() {
    setRows(null);
    setError(null);
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    if (actionFilter) qs.set('action', actionFilter);
    const res = await fetch(`/api/audit?${qs}`).then(r => r.json());
    if (res.success) {
      setRows(res.data.rows);
      setTotal(res.data.total);
    } else {
      setError(res.error);
      setRows([]);
    }
  }

  useEffect(() => { load(); }, [offset, actionFilter]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.action.toLowerCase().includes(q) ||
      r.resourceType.toLowerCase().includes(q) ||
      (r.resourceId || '').toLowerCase().includes(q) ||
      (r.user.email || '').toLowerCase().includes(q) ||
      JSON.stringify(r.details || {}).toLowerCase().includes(q),
    );
  }, [rows, search]);

  const actions = ['', 'document.create', 'document.submit', 'document.approve', 'document.reject', 'document.sign', 'document.archive'];

  if (me && me.role !== 'admin') {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6">
          <EmptyState
            icon="🔒"
            titleKm="ត្រូវការសិទ្ធិ admin"
            title="Admin only"
            bodyKm="សូមប្តូរអ្នកប្រើទៅ admin (ប៊ូតុងជ្រុងខាងលើ) ដើម្បីមើលកំណត់ត្រាសកម្មភាព។"
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="font-khmer text-2xl font-bold text-kgd-text">កំណត់ត្រាសកម្មភាព</h1>
            <p className="text-sm text-kgd-muted">Audit log · {total} events total</p>
          </div>
          <Badge tone="neutral">append-only</Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="flex-1 min-w-[240px]">
            <Input
              placeholder="ស្វែងរកក្នុងលទ្ធផល… (search in loaded rows)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {actions.map(a => (
              <button
                key={a || 'all'}
                onClick={() => { setOffset(0); setActionFilter(a); }}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors
                  ${actionFilter === a ? 'bg-kgd-blue text-white' : 'bg-kgd-surface border border-kgd-border text-kgd-muted hover:bg-kgd-elevated'}`}
              >
                {a || 'all'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">{error}</div>
        )}

        {rows === null ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} height={48} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="🧾" titleKm="គ្មានកំណត់ត្រា" title="No events" />
        ) : (
          <div className="bg-kgd-surface border border-kgd-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-kgd-elevated text-left text-xs uppercase text-kgd-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-kgd-border/50">
                    <td className="px-4 py-3 text-xs text-kgd-muted whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-khmer text-sm">{r.user.nameKm || r.user.name}</div>
                      <div className="text-xs text-kgd-muted">{r.user.email} · {r.user.role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ACTION_TONE[r.action] || 'neutral'}>{r.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-kgd-muted">
                      {r.resourceType}
                      {r.resourceId && (
                        <>
                          <span className="text-kgd-muted/80"> · </span>
                          {r.resourceType === 'document' ? (
                            <Link href={`/documents/${r.resourceId}`} className="text-kgd-blue hover:underline font-mono">
                              #{r.resourceId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="font-mono">#{r.resourceId.slice(0, 8)}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-kgd-muted max-w-xs truncate font-mono">
                      {r.details ? JSON.stringify(r.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-kgd-muted">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(o => Math.max(0, o - limit))}
              >
                ← Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(o => o + limit)}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
