'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../_components/AppShell';
import { Button, Badge, Skeleton, EmptyState } from '../../frontend/components/atoms';

interface Row {
  id: string;
  name: string;
  nameKm: string;
  category: string;
  isActive?: boolean;
  isBuiltin?: boolean;
  sectionsCount?: number;
  updatedAt?: string;
}

export default function TemplatesPage() {
  const [me, setMe] = useState<any>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(r => r.success && setMe(r.data));
  }, []);

  async function load() {
    setRows(null);
    setError(null);
    const url = isAdmin ? '/api/templates/admin' : '/api/templates';
    const res = await fetch(url).then(r => r.json());
    if (res.success) setRows(res.data);
    else {
      setError(res.error);
      setRows([]);
    }
  }

  useEffect(() => { if (me) load(); }, [me]);

  async function toggleActive(id: string, active: boolean) {
    setBusy(id);
    const res = await fetch(`/api/templates/admin/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    }).then(r => r.json());
    setBusy(null);
    if (!res.success) alert(res.error);
    else load();
  }

  async function duplicate(id: string) {
    const newId = prompt(`Duplicate "${id}" as new id (lowercase, hyphens):`, `${id}-copy`);
    if (!newId) return;
    setBusy(id);
    const res = await fetch(`/api/templates/admin/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newId }),
    }).then(r => r.json());
    setBusy(null);
    if (!res.success) alert(res.error);
    else load();
  }

  async function del(id: string, isBuiltin?: boolean) {
    if (isBuiltin) {
      alert('Builtin templates cannot be deleted. Deactivate instead.');
      return;
    }
    if (!confirm(`Delete template "${id}"? This is permanent.`)) return;
    setBusy(id);
    const res = await fetch(`/api/templates/admin/${id}`, { method: 'DELETE' }).then(r => r.json());
    setBusy(null);
    if (!res.success) alert(res.error);
    else load();
  }

  async function syncFromDisk() {
    if (!confirm('Sync templates from files? User edits newer than the file will be preserved.')) return;
    setBusy('__sync__');
    const res = await fetch('/api/templates/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(r => r.json());
    setBusy(null);
    if (!res.success) alert(res.error);
    else {
      alert(`Inserted ${res.data.inserted} · Updated ${res.data.updated} · Skipped ${res.data.skipped}`);
      load();
    }
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-khmer-header text-kgd-text">ឃ្លាំងគំរូ · <span className="text-kgd-blue">Template Vault</span></h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={syncFromDisk} disabled={busy === '__sync__'} variant="secondary">
                Sync from files
              </Button>
            </div>
          )}
        </div>

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

        {rows === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No templates" description="Sync from files to populate the vault." />
        ) : (
          <div className="bg-kgd-surface rounded-lg border border-kgd-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-kgd-elevated text-kgd-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">ឈ្មោះ</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Sections</th>
                  <th className="text-left px-3 py-2 font-medium">State</th>
                  {isAdmin && <th className="text-right px-3 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-kgd-border/60 hover:bg-kgd-elevated/60">
                    <td className="px-3 py-2 font-mono text-xs text-kgd-muted">{r.id}</td>
                    <td className="px-3 py-2">{r.nameKm}<div className="text-xs text-kgd-muted">{r.name}</div></td>
                    <td className="px-3 py-2 text-kgd-text">{r.category}</td>
                    <td className="px-3 py-2 text-kgd-text">{r.sectionsCount ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.isActive === false ? <Badge tone="neutral">inactive</Badge> : <Badge tone="emerald">active</Badge>}
                      {r.isBuiltin && <span className="ml-1"><Badge tone="sky">builtin</Badge></span>}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <Link href={`/templates/${r.id}`}><Button variant="secondary" size="sm">Edit</Button></Link>
                          <Button variant="secondary" size="sm" disabled={busy === r.id} onClick={() => duplicate(r.id)}>Duplicate</Button>
                          <Button variant="secondary" size="sm" disabled={busy === r.id} onClick={() => toggleActive(r.id, r.isActive !== false)}>
                            {r.isActive === false ? 'Activate' : 'Deactivate'}
                          </Button>
                          {!r.isBuiltin && (
                            <Button variant="destructive" size="sm" disabled={busy === r.id} onClick={() => del(r.id, r.isBuiltin)}>Delete</Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
