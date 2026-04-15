'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from './_components/AppShell';
import TemplateSelector from '../frontend/components/organisms/TemplateSelector';
import {
  Button, StatusChip, Skeleton, EmptyState, Badge,
  type DocumentStatus,
} from '../frontend/components/atoms';

interface DocRow {
  id: string;
  templateId: string;
  status: string;
  title: string;
  titleKm: string | null;
  updatedAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  user: { name: string; nameKm: string | null; role: string; email: string };
}

interface Stats {
  scope: 'self' | 'all';
  counts: Record<string, number>;
  totalDocs: number;
  pendingReview: number;
  recentDocs: DocRow[];
  recentAudit: AuditRow[];
}

const KPI_STATUSES: { status: DocumentStatus; labelKm: string }[] = [
  { status: 'draft',          labelKm: 'ព្រាង' },
  { status: 'pending_review', labelKm: 'កំពុងពិនិត្យ' },
  { status: 'signed',         labelKm: 'បានចុះហត្ថលេខា' },
  { status: 'archived',       labelKm: 'រក្សាទុក' },
];

const ACTION_LABEL_KM: Record<string, string> = {
  'document.create':  'បង្កើត',
  'document.submit':  'ដាក់ស្នើ',
  'document.approve': 'អនុម័ត',
  'document.reject':  'បដិសេធ',
  'document.sign':    'ចុះហត្ថលេខា',
  'document.archive': 'រក្សាទុក',
};

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(r => r.success && setStats(r.data));
    fetch('/api/auth/me').then(r => r.json()).then(r => r.success && setMe(r.data));
  }, []);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <section className="mb-6 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-khmer text-2xl md:text-3xl font-bold text-kgd-text">
              សួស្តី, {me?.email ?? '…'}
            </h1>
            <p className="text-sm text-kgd-muted">
              Welcome back — {stats?.scope === 'all' ? 'ministry-wide view' : 'your documents'}.
            </p>
          </div>
          {stats && me && ['reviewer', 'admin'].includes(me.role) && stats.pendingReview > 0 && (
            <Link href="/approvals">
              <Badge tone="amber">⏳ {stats.pendingReview} រង់ចាំពិនិត្យ</Badge>
            </Link>
          )}
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {KPI_STATUSES.map(k => (
            <div key={k.status} className="bg-kgd-surface border border-kgd-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <StatusChip status={k.status} />
                <span className="text-2xl font-bold text-kgd-text tabular-nums">
                  {stats === null ? (
                    <Skeleton width={24} height={24} />
                  ) : (
                    stats.counts[k.status] || 0
                  )}
                </span>
              </div>
              <p className="text-xs text-kgd-muted mt-2 font-khmer">{k.labelKm}</p>
            </div>
          ))}
        </section>

        {/* Primary action */}
        <section className="bg-gradient-to-r from-kgd-blue to-kgd-blue/80 text-white rounded-2xl p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-khmer text-xl font-bold">ចាប់ផ្តើមឯកសារថ្មី</h2>
            <p className="text-sm opacity-80">
              Start from a template, upload a scan, or transcribe a meeting.
            </p>
          </div>
          <Button variant="gold" onClick={() => router.push('/documents/new')}>
            ➕ បង្កើតឯកសារ
          </Button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left: template grid */}
          <section className="lg:col-span-2">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-khmer text-lg font-bold text-kgd-text">ជ្រើសរើសគំរូ</h2>
              <p className="text-xs text-kgd-muted">Choose a template</p>
            </div>
            <TemplateSelector onSelect={id => router.push(`/documents/new/${id}`)} />
          </section>

          {/* Right: recent activity */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-khmer text-lg font-bold text-kgd-text">សកម្មភាពថ្មីៗ</h2>
              {me?.role === 'admin' && (
                <Link href="/audit" className="text-xs text-kgd-blue hover:underline">
                  ទាំងអស់ →
                </Link>
              )}
            </div>
            <div className="bg-kgd-surface border border-kgd-border rounded-2xl overflow-hidden">
              {stats === null ? (
                <div className="p-4 space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} height={40} />)}
                </div>
              ) : stats.recentAudit.length === 0 ? (
                <p className="p-6 text-center text-sm text-kgd-muted/80 font-khmer">
                  មិនទាន់មានសកម្មភាព
                </p>
              ) : (
                <ul className="divide-y divide-kgd-border/50">
                  {stats.recentAudit.slice(0, 8).map(a => (
                    <li key={a.id} className="px-4 py-2.5 text-sm">
                      <div className="flex items-start gap-2">
                        <Badge tone="blue" className="!px-1.5 !py-0 shrink-0 text-[10px]">
                          {ACTION_LABEL_KM[a.action] || a.action}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-khmer text-xs truncate text-kgd-text">
                            {a.user.nameKm || a.user.name}
                          </p>
                          <p className="text-[10px] text-kgd-muted/80">
                            {new Date(a.createdAt).toLocaleString()}
                            {a.resourceType === 'document' && a.resourceId && (
                              <>
                                {' · '}
                                <Link
                                  href={`/documents/${a.resourceId}`}
                                  className="text-kgd-blue hover:underline font-mono"
                                >
                                  #{a.resourceId.slice(0, 6)}
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Recent drafts table */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-khmer text-lg font-bold text-kgd-text">ឯកសារថ្មីៗ</h2>
            <Link href="/documents" className="text-xs text-kgd-blue hover:underline">
              មើលទាំងអស់ →
            </Link>
          </div>
          {stats === null && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} height={48} />)}
            </div>
          )}
          {stats !== null && stats.recentDocs.length === 0 && (
            <EmptyState
              icon="📄"
              titleKm="មិនទាន់មានឯកសារ"
              title="No documents yet"
              action={<Button onClick={() => router.push('/documents/new')}>បង្កើតឯកសារ</Button>}
            />
          )}
          {stats !== null && stats.recentDocs.length > 0 && (
            <ul className="bg-kgd-surface border border-kgd-border rounded-2xl divide-y divide-kgd-border/50 overflow-hidden">
              {stats.recentDocs.map(d => (
                <li key={d.id}>
                  <Link
                    href={`/documents/${d.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-khmer text-sm truncate text-kgd-text">
                        {d.titleKm || d.title}
                      </p>
                      <p className="text-xs text-kgd-muted">
                        {d.templateId} · {new Date(d.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusChip status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
