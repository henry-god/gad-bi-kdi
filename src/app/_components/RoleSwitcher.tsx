'use client';

import { useEffect, useState } from 'react';
import { ensureFirebase, signOutFirebase, subscribeUser } from '../../frontend/utils/firebase-client';

interface DevUser {
  id: string;
  email: string;
  name: string;
  nameKm: string | null;
  role: 'admin' | 'officer' | 'reviewer' | 'signer';
}

const ROLE_LABEL_KM: Record<string, string> = {
  admin: 'អ្នកគ្រប់គ្រង',
  officer: 'មន្ត្រី',
  reviewer: 'អ្នកពិនិត្យ',
  signer: 'អ្នកចុះហត្ថលេខា',
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export default function RoleSwitcher() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; role: string; firebaseUid?: string } | null>(null);
  const [firebaseMode, setFirebaseMode] = useState<boolean>(false);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(null);
  const [firebaseUserIsAnonymous, setFirebaseUserIsAnonymous] = useState(false);

  useEffect(() => {
    ensureFirebase().then(({ config }) => setFirebaseMode(config.firebaseEnabled));
    const unsub = subscribeUser(u => {
      setFirebaseUserEmail(u?.email ?? null);
      setFirebaseUserIsAnonymous(Boolean(u?.isAnonymous));
    });
    fetch('/api/auth/me').then(r => r.json()).then(r => r.success && setMe(r.data));
    fetch('/api/auth/users')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setUsers(res.data);
          const saved = readCookie('dev-user-id');
          const fallback = res.data.find((u: DevUser) => u.email === 'officer@kgd.local');
          setCurrentId(saved || fallback?.id || res.data[0]?.id || null);
          if (!saved && fallback) writeCookie('dev-user-id', fallback.id);
        }
      });
    return () => { unsub(); };
  }, []);

  function switchTo(id: string) {
    writeCookie('dev-user-id', id);
    setCurrentId(id);
    window.location.reload();
  }

  const current = users.find(u => u.id === currentId);

  // Firebase mode: show signed-in identity + role (+ dev role switcher only for admin)
  if (firebaseMode) {
    const label =
      firebaseUserIsAnonymous
        ? 'Anonymous'
        : firebaseUserEmail || '—';
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-kgd-text font-khmer truncate max-w-[160px]">
            {me?.email || label}
          </span>
          <span className="text-[10px] text-kgd-muted uppercase">
            {me?.role || '—'} {firebaseUserIsAnonymous && '· anon'}
          </span>
        </div>
        {me?.role === 'admin' && (
          <select
            value={currentId || ''}
            onChange={e => switchTo(e.target.value)}
            title="Dev role override (admin only)"
            className="bg-kgd-elevated/60 text-kgd-text border border-kgd-border rounded-md px-2 py-1 text-xs font-khmer"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {ROLE_LABEL_KM[u.role]} · {u.email}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => signOutFirebase().then(() => window.location.reload())}
          className="text-[10px] text-kgd-muted hover:text-kgd-red underline"
        >
          ចេញ
        </button>
      </div>
    );
  }

  // Dev mode
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-kgd-muted hidden sm:inline">Acting as</span>
      <select
        value={currentId || ''}
        onChange={e => switchTo(e.target.value)}
        className="bg-kgd-elevated/60 text-kgd-text border border-kgd-border rounded-md px-2 py-1 text-xs font-khmer focus:outline-none focus:ring-1 focus:ring-kgd-blue"
      >
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {ROLE_LABEL_KM[u.role]} · {u.email}
          </option>
        ))}
      </select>
      {current && (
        <span className="px-2 py-0.5 rounded-full bg-kgd-gold/20 text-kgd-blue text-[10px] uppercase font-bold">
          {current.role}
        </span>
      )}
    </div>
  );
}
