'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd, StatusChip } from '../../frontend/components/atoms';

interface Template { id: string; name: string; nameKm: string; category: string; }
interface Doc { id: string; templateId: string; status: string; title: string; titleKm: string | null; updatedAt: string; }
interface User { id: string; email: string; name: string; nameKm: string | null; role: string; }

interface Results {
  templates: Template[];
  documents: Doc[];
  users: User[];
}

interface Item {
  kind: 'new' | 'go' | 'doc' | 'user';
  id: string;
  primary: string;
  secondary?: string;
  href: string;
  hint?: React.ReactNode;
}

const NAV_ITEMS: Array<{ labelKm: string; labelEn: string; href: string; icon: string }> = [
  { labelKm: 'ផ្ទាំងគ្រប់គ្រង',      labelEn: 'Dashboard',        href: '/',            icon: '🏠' },
  { labelKm: 'ឯកសាររបស់ខ្ញុំ',     labelEn: 'My Documents',     href: '/documents',   icon: '📄' },
  { labelKm: 'ឯកសារថ្មី',            labelEn: 'New document',     href: '/documents/new', icon: '➕' },
  { labelKm: 'បញ្ជីពិនិត្យ',        labelEn: 'Approval queue',   href: '/approvals',   icon: '✅' },
  { labelKm: 'ការកំណត់ API',       labelEn: 'Settings',         href: '/settings',    icon: '⚙' },
  { labelKm: 'កំណត់ត្រា',            labelEn: 'Audit log',        href: '/audit',       icon: '🧾' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>({ templates: [], documents: [], users: [] });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global Cmd/Ctrl+K + 'n' + '/' shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Search debounce
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(res => res.success && setResults(res.data))
        .catch(() => { /* ignore */ });
    }, 120);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const needle = q.trim().toLowerCase();

    // Section: New (templates)
    for (const t of results.templates.slice(0, 5)) {
      out.push({
        kind: 'new',
        id: t.id,
        primary: `+ ${t.nameKm}`,
        secondary: `New · ${t.name}`,
        href: `/documents/new/${t.id}`,
      });
    }

    // Section: Go to (nav)
    const nav = NAV_ITEMS.filter(n =>
      !needle ||
      n.labelEn.toLowerCase().includes(needle) ||
      n.labelKm.toLowerCase().includes(needle) ||
      n.href.includes(needle),
    );
    for (const n of nav) {
      out.push({
        kind: 'go',
        id: n.href,
        primary: `${n.icon}  ${n.labelKm}`,
        secondary: `Go to · ${n.labelEn}`,
        href: n.href,
      });
    }

    // Section: Recent (documents)
    for (const d of results.documents.slice(0, 5)) {
      out.push({
        kind: 'doc',
        id: d.id,
        primary: d.titleKm || d.title,
        secondary: `${d.templateId} · updated ${new Date(d.updatedAt).toLocaleDateString()}`,
        href: `/documents/${d.id}`,
        hint: <StatusChip status={d.status} />,
      });
    }

    // Users (admin only — api returns empty otherwise)
    for (const u of results.users.slice(0, 4)) {
      out.push({
        kind: 'user',
        id: u.id,
        primary: u.nameKm || u.name,
        secondary: `${u.email} · ${u.role}`,
        href: `/settings`,
      });
    }
    return out;
  }, [results, q]);

  useEffect(() => {
    setCursor(0);
  }, [q, items.length]);

  function choose(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  if (!open) {
    return (
      <CommandButton onOpen={() => setOpen(true)} />
    );
  }

  return (
    <>
      <CommandButton onOpen={() => setOpen(true)} />
      <div
        className="fixed inset-0 z-[60] bg-slate-900/40 flex items-start justify-center pt-[10vh] px-4"
        onClick={() => setOpen(false)}
      >
        <div
          role="dialog"
          aria-label="Command palette"
          className="bg-kgd-surface w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-kgd-border">
            <span className="text-kgd-muted/80" aria-hidden>🔍</span>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
                if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
                if (e.key === 'Enter' && items[cursor]) { e.preventDefault(); choose(items[cursor]); }
              }}
              placeholder="ស្វែងរក…  (Type a command or search — Cmd+K)"
              className="flex-1 outline-none font-khmer text-sm"
            />
            <Kbd>Esc</Kbd>
          </div>

          <ul className="max-h-[60vh] overflow-auto py-1">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-kgd-muted/80 font-khmer">
                មិនមានលទ្ធផល · No matches
              </li>
            )}

            {renderSections(items, cursor, choose)}
          </ul>

          <div className="px-4 py-2 text-[10px] text-kgd-muted border-t border-kgd-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate · <Kbd>↵</Kbd> select · <Kbd>Esc</Kbd> close
            </div>
            <span>v3 Cmd+K</span>
          </div>
        </div>
      </div>
    </>
  );
}

function renderSections(items: Item[], cursor: number, choose: (i: Item) => void) {
  const sectionLabels: Record<Item['kind'], string> = {
    new: 'New · បង្កើតថ្មី',
    go: 'Go to · ទៅកាន់',
    doc: 'Recent documents · ថ្មីៗ',
    user: 'Users · អ្នកប្រើប្រាស់',
  };
  const out: React.ReactNode[] = [];
  let last: Item['kind'] | null = null;
  items.forEach((item, idx) => {
    if (item.kind !== last) {
      last = item.kind;
      out.push(
        <li
          key={`h-${item.kind}`}
          className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wide text-kgd-muted/80 font-khmer"
        >
          {sectionLabels[item.kind]}
        </li>,
      );
    }
    const active = idx === cursor;
    out.push(
      <li key={`${item.kind}-${item.id}`}>
        <button
          className={`w-full text-left flex items-center gap-3 px-4 py-2 ${
            active ? 'bg-kgd-blue text-white' : 'hover:bg-kgd-elevated'
          }`}
          onClick={() => choose(item)}
          onMouseEnter={() => { /* optional cursor sync */ }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-khmer text-sm truncate">{item.primary}</p>
            {item.secondary && (
              <p className={`text-xs truncate ${active ? 'opacity-80' : 'text-kgd-muted'}`}>
                {item.secondary}
              </p>
            )}
          </div>
          {item.hint && <span className="shrink-0">{item.hint}</span>}
          {active && <span className="text-xs" aria-hidden>↵</span>}
        </button>
      </li>,
    );
  });
  return out;
}

function CommandButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="hidden md:flex items-center gap-2 text-xs text-kgd-muted bg-kgd-elevated/60 border border-kgd-border rounded-lg px-3 py-1.5 hover:bg-kgd-elevated transition-colors"
      aria-label="Open command palette"
    >
      <span aria-hidden>🔍</span>
      <span>Search or jump</span>
      <Kbd>⌘</Kbd><Kbd>K</Kbd>
    </button>
  );
}
