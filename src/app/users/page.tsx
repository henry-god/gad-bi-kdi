'use client';

import { useEffect, useState } from 'react';
import AppShell from '../_components/AppShell';
import { Button, Badge, Skeleton, EmptyState } from '../../frontend/components/atoms';

interface User {
  id: string;
  email: string;
  name: string;
  nameKm?: string;
  role: string;
  departmentId?: string;
  titlePosition?: string;
}

interface Dept {
  id: string;
  nameKm: string;
  nameEn?: string;
}

const ROLES = ['admin', 'officer', 'reviewer', 'signer'] as const;

const ROLE_COLORS: Record<string, 'sky' | 'emerald' | 'amber' | 'neutral'> = {
  admin: 'sky',
  officer: 'neutral',
  reviewer: 'amber',
  signer: 'emerald',
};

const api = (path: string, opts?: RequestInit) => fetch(path, opts).then(r => r.json());

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newNameKm, setNewNameKm] = useState('');
  const [newRole, setNewRole] = useState('officer');
  const [newDept, setNewDept] = useState('');
  const [newTitle, setNewTitle] = useState('');

  // Edit state
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editNameKm, setEditNameKm] = useState('');

  async function load() {
    const [uRes, dRes] = await Promise.all([
      api('/api/auth/users'),
      api('/api/auth/departments'),
    ]);
    if (uRes.success) setUsers(uRes.data);
    if (dRes.success) setDepts(dRes.data);
  }

  useEffect(() => { load(); }, []);

  function deptName(id?: string) {
    if (!id) return '—';
    const d = depts.find(d => d.id === id);
    return d?.nameKm || id;
  }

  async function createUser() {
    if (!newEmail || !newName) return;
    const res = await api('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail, name: newName, nameKm: newNameKm || undefined,
        role: newRole, departmentId: newDept || undefined,
        titlePosition: newTitle || undefined,
      }),
    });
    if (res.success) {
      setShowCreate(false);
      setNewEmail(''); setNewName(''); setNewNameKm(''); setNewRole('officer'); setNewDept(''); setNewTitle('');
      load();
    } else {
      alert(res.error);
    }
  }

  function startEdit(u: User) {
    setEditing(u.id);
    setEditRole(u.role);
    setEditDept(u.departmentId || '');
    setEditTitle(u.titlePosition || '');
    setEditNameKm(u.nameKm || '');
  }

  async function saveEdit(id: string) {
    const res = await api(`/api/auth/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: editRole, departmentId: editDept || null,
        titlePosition: editTitle || null, nameKm: editNameKm || null,
      }),
    });
    if (res.success) {
      setEditing(null);
      load();
    } else {
      alert(res.error);
    }
  }

  async function deleteUser(u: User) {
    if (!confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
    await api(`/api/auth/users/${u.id}`, { method: 'DELETE' });
    load();
  }

  const inputCls = 'bg-kgd-elevated border border-kgd-border rounded px-2 py-1.5 text-sm text-kgd-text placeholder:text-kgd-muted/60 focus:outline-none focus:border-kgd-blue w-full';
  const selectCls = 'bg-kgd-elevated border border-kgd-border rounded px-2 py-1.5 text-sm text-kgd-text focus:outline-none focus:border-kgd-blue';

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-khmer-header text-kgd-text">
            អ្នកប្រើប្រាស់ · <span className="text-kgd-blue">Users</span>
          </h1>
          <Button onClick={() => setShowCreate(v => !v)} variant="primary" size="sm">
            {showCreate ? 'Cancel' : '+ Add User'}
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-kgd-surface border border-kgd-border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className={inputCls} placeholder="Email *" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <input className={inputCls} placeholder="Name (EN) *" value={newName} onChange={e => setNewName(e.target.value)} />
              <input className={inputCls} placeholder="ឈ្មោះ (KM)" value={newNameKm} onChange={e => setNewNameKm(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select className={selectCls} value={newRole} onChange={e => setNewRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className={selectCls} value={newDept} onChange={e => setNewDept(e.target.value)}>
                <option value="">— Department —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.nameKm}</option>)}
              </select>
              <input className={inputCls} placeholder="Title / Position" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={createUser} variant="primary" size="sm">Create User</Button>
            </div>
          </div>
        )}

        {/* Users table */}
        {users === null ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users" description="Add users to manage roles and access." />
        ) : (
          <div className="bg-kgd-surface rounded-lg border border-kgd-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-kgd-elevated text-kgd-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">User</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-left px-3 py-2 font-medium">Department</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-kgd-border/60 hover:bg-kgd-elevated/60">
                    {editing === u.id ? (
                      <>
                        <td className="px-3 py-2">
                          <div className="text-kgd-text">{u.name}</div>
                          <input className={inputCls + ' mt-1'} placeholder="ឈ្មោះ (KM)" value={editNameKm} onChange={e => setEditNameKm(e.target.value)} />
                        </td>
                        <td className="px-3 py-2 text-kgd-muted">{u.email}</td>
                        <td className="px-3 py-2">
                          <select className={selectCls} value={editRole} onChange={e => setEditRole(e.target.value)}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select className={selectCls} value={editDept} onChange={e => setEditDept(e.target.value)}>
                            <option value="">—</option>
                            {depts.map(d => <option key={d.id} value={d.id}>{d.nameKm}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input className={inputCls} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button onClick={() => saveEdit(u.id)} variant="primary" size="sm">Save</Button>
                            <Button onClick={() => setEditing(null)} variant="secondary" size="sm">Cancel</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <div className="text-kgd-text">{u.name}</div>
                          {u.nameKm && <div className="text-xs text-kgd-muted font-khmer">{u.nameKm}</div>}
                        </td>
                        <td className="px-3 py-2 text-kgd-muted">{u.email}</td>
                        <td className="px-3 py-2">
                          <Badge tone={ROLE_COLORS[u.role] || 'neutral'}>{u.role}</Badge>
                        </td>
                        <td className="px-3 py-2 text-kgd-text font-khmer text-xs">{deptName(u.departmentId)}</td>
                        <td className="px-3 py-2 text-kgd-muted text-xs">{u.titlePosition || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button onClick={() => startEdit(u)} variant="secondary" size="sm">Edit</Button>
                            <Button onClick={() => deleteUser(u)} variant="destructive" size="sm">Delete</Button>
                          </div>
                        </td>
                      </>
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
