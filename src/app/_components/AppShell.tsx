'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import RoleSwitcher from './RoleSwitcher';
import CommandPalette from './CommandPalette';

interface NavItem {
  href: string;
  icon: string;
  labelKm: string;
  labelEn: string;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/',              icon: '🏠', labelKm: 'ផ្ទាំង',     labelEn: 'Dashboard' },
  { href: '/documents',     icon: '📄', labelKm: 'ឯកសារ',       labelEn: 'My Docs',
    match: (p) => p.startsWith('/documents') && !p.startsWith('/documents/new') },
  { href: '/documents/new', icon: '➕', labelKm: 'បង្កើត',      labelEn: 'New' },
  { href: '/approvals',     icon: '✅', labelKm: 'ពិនិត្យ',      labelEn: 'Approvals' },
  { href: '/vault',          icon: '📦', labelKm: 'ឃ្លាំង',        labelEn: 'Vault',
    match: (p) => p.startsWith('/vault') },
  { href: '/templates',     icon: '📋', labelKm: 'គំរូ',         labelEn: 'Templates',
    match: (p) => p.startsWith('/templates') },
  { href: '/users',          icon: '👥', labelKm: 'អ្នកប្រើ',      labelEn: 'Users',
    match: (p) => p.startsWith('/users') },
  { href: '/settings',      icon: '⚙',  labelKm: 'ការកំណត់',    labelEn: 'Settings' },
  { href: '/audit',         icon: '🧾', labelKm: 'កំណត់ត្រា',    labelEn: 'Audit' },
];

function NavLink({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const pathname = usePathname();
  const active = item.match ? item.match(pathname) : pathname === item.href;
  return (
    <Link
      href={item.href}
      className={`group flex ${compact ? 'flex-col items-center gap-0.5 px-1 py-3' : 'items-center gap-3 px-3 py-2'} rounded-lg transition-colors
        ${active ? 'bg-kgd-blue/20 text-kgd-blue shadow-[inset_0_0_0_1px_rgba(76,139,245,0.4)]' : 'text-kgd-muted hover:bg-white/5 hover:text-kgd-text'}`}
    >
      <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
      <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-khmer`}>{item.labelKm}</span>
    </Link>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return <span className="text-sm text-kgd-muted">ផ្ទាំងគ្រប់គ្រង</span>;
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    return { href, label: decodeURIComponent(seg) };
  });
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-kgd-muted">
      <Link href="/" className="hover:text-kgd-blue">ផ្ទាំង</Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          <span className="text-kgd-border">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-kgd-text truncate max-w-[200px]">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-kgd-blue">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setMobileOpen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="min-h-screen bg-kgd-bg text-kgd-text">
      {/* Left rail — desktop */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-[88px] bg-kgd-surface border-r border-kgd-border flex-col z-30">
        <div className="p-3 pt-4 text-kgd-text text-center">
          <div className="text-2xl" aria-hidden>🇰🇭</div>
          <div className="text-[10px] font-khmer-header mt-1 text-kgd-blue tracking-wide">KGD</div>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {NAV.map(item => <NavLink key={item.href} item={item} compact />)}
        </nav>
        <div className="p-3 text-[9px] text-kgd-muted/60 text-center">v5.6</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 bottom-0 w-64 bg-kgd-surface border-r border-kgd-border z-50 md:hidden p-4 flex flex-col gap-1">
            <button
              className="text-kgd-muted hover:text-kgd-text text-sm self-end mb-2"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >✕</button>
            {NAV.map(item => (
              <div key={item.href} onClick={() => setMobileOpen(false)}>
                <NavLink item={item} />
              </div>
            ))}
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="md:pl-[88px]">
        <header className="sticky top-0 z-20 bg-kgd-bg/80 backdrop-blur border-b border-kgd-border">
          <div className="flex items-center gap-3 px-4 md:px-6 py-3">
            <button
              className="md:hidden text-kgd-muted hover:text-kgd-text"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >☰</button>
            <div className="flex-1 min-w-0">
              <Breadcrumb />
            </div>
            <CommandPalette />
            <RoleSwitcher />
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
