'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, StatusChip, Skeleton } from '../../frontend/components/atoms';
import { downloadAuthed } from '../../frontend/utils/authFetch';

interface Doc {
  id: string;
  templateId: string;
  status: string;
  title: string;
  titleKm: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  inputData: Record<string, any>;
}

interface HistoryStep {
  id: string;
  stepOrder: number;
  action: string;
  comments: string | null;
  createdAt: string;
  actor: { id: string; name: string; nameKm: string | null; role: string };
}

const ACTION_LABEL: Record<string, string> = {
  submit: 'ដាក់ស្នើ',
  review: 'បានពិនិត្យ',
  approve: 'អនុម័ត',
  reject: 'បដិសេធ',
  sign: 'ចុះហត្ថលេខា',
  archive: 'រក្សាទុក',
};

export default function DocumentDrawer({
  documentId,
  onClose,
}: {
  documentId: string | null;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryStep[]>([]);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setHistory([]);
      return;
    }
    Promise.all([
      fetch(`/api/documents/${documentId}`).then(r => r.json()),
      fetch(`/api/documents/${documentId}/history`).then(r => r.json()),
    ]).then(([dRes, hRes]) => {
      if (dRes.success) setDoc(dRes.data);
      if (hRes.success) setHistory(hRes.data);
    });
  }, [documentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (documentId) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [documentId, onClose]);

  if (!documentId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Document preview"
        className="fixed top-0 right-0 bottom-0 w-full md:w-[min(720px,60vw)] bg-kgd-surface z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-kgd-border">
          <div className="min-w-0">
            <p className="text-xs text-kgd-muted">{doc?.templateId ?? '…'}</p>
            <h2 className="font-khmer text-lg font-bold truncate text-kgd-text">
              {doc ? (doc.titleKm || doc.title) : 'កំពុងផ្ទុក…'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-kgd-muted hover:text-kgd-text text-xl"
            aria-label="Close"
          >✕</button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!doc ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} height={44} />)}
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-kgd-border/50 flex items-center gap-3 flex-wrap">
                <StatusChip status={doc.status} showEnglish />
                <span className="text-xs text-kgd-muted">v{doc.version}</span>
                <span className="text-xs text-kgd-muted">
                  · Updated {new Date(doc.updatedAt).toLocaleString()}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadAuthed(
                      `/api/documents/${doc.id}/download`,
                      `${doc.templateId}-${doc.id.slice(0, 8)}.docx`,
                    )}
                  >⬇ DOCX</Button>
                  <Link href={`/documents/${doc.id}`} onClick={onClose}>
                    <Button size="sm">បើកពេញ</Button>
                  </Link>
                </div>
              </div>

              <section className="p-5">
                <h3 className="font-khmer font-bold text-kgd-text mb-2">ព័ត៌មានឯកសារ</h3>
                <dl className="text-sm bg-kgd-elevated rounded-lg p-3">
                  {Object.entries(doc.inputData || {}).slice(0, 8).map(([k, v]) => (
                    <div key={k} className="py-1 grid grid-cols-[120px_1fr] gap-3">
                      <dt className="text-xs uppercase text-kgd-muted">{k}</dt>
                      <dd className="font-khmer text-kgd-text break-words whitespace-pre-wrap line-clamp-2">
                        {String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="px-5 pb-5">
                <h3 className="font-khmer font-bold text-kgd-text mb-2">ប្រវត្តិ</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-kgd-muted/80 font-khmer">មិនទាន់មានសកម្មភាព</p>
                ) : (
                  <ol className="space-y-2">
                    {history.map(h => (
                      <li
                        key={h.id}
                        className="flex items-start gap-2 text-sm border border-kgd-border rounded-lg p-2"
                      >
                        <span className="text-kgd-blue font-mono text-xs mt-1">{h.stepOrder}</span>
                        <div className="flex-1">
                          <div className="font-khmer font-bold">{ACTION_LABEL[h.action] || h.action}</div>
                          <div className="text-xs text-kgd-muted">
                            {h.actor.nameKm || h.actor.name} · {h.actor.role} · {new Date(h.createdAt).toLocaleString()}
                          </div>
                          {h.comments && (
                            <div className="mt-1 bg-kgd-elevated border border-kgd-border rounded p-2 text-xs font-khmer">
                              {h.comments}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
