'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import AppShell from '../_components/AppShell';
import { Button, Skeleton, EmptyState } from '../../frontend/components/atoms';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Workspace { id: string; name: string; nameKm?: string; slug: string; }
interface Folder    { id: string; workspaceId: string; parentId: string | null; name: string; nameKm?: string; path: string; }
interface RFile     { id: string; name: string; mimeType: string; sizeBytes: number; folderId: string; workspaceId: string; createdAt?: any; }

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼';
  if (mime.includes('pdf'))     return '📕';
  if (mime.includes('word') || mime.includes('docx')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('xlsx')) return '📊';
  if (mime.includes('presentation') || mime.includes('pptx')) return '📈';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '📦';
  return '📄';
}

const api = (path: string, opts?: RequestInit) => fetch(path, opts).then(r => r.json());

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function VaultPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderStack, setFolderStack] = useState<Folder[]>([]); // breadcrumb
  const [files, setFiles] = useState<RFile[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<RFile[] | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load workspaces ──
  const loadWorkspaces = useCallback(async () => {
    const res = await api('/api/vault/workspaces');
    if (res.success) {
      setWorkspaces(res.data);
      if (res.data.length > 0 && !activeWs) setActiveWs(res.data[0]);
    } else {
      setWorkspaces([]);
    }
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  // ── Load folder contents ──
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  const loadContents = useCallback(async () => {
    if (!activeWs) return;
    setLoading(true);
    const [fRes, fiRes] = await Promise.all([
      api(`/api/vault/folders?workspaceId=${activeWs.id}${currentFolderId ? `&parentId=${currentFolderId}` : ''}`),
      currentFolderId
        ? api(`/api/vault/files?folderId=${currentFolderId}`)
        : api(`/api/vault/files?workspaceId=${activeWs.id}`),
    ]);
    if (fRes.success) setFolders(fRes.data);
    if (fiRes.success) setFiles(fiRes.data);
    setLoading(false);
  }, [activeWs, currentFolderId]);

  useEffect(() => {
    setSearchResults(null);
    setSearchQ('');
    loadContents();
  }, [loadContents]);

  // ── Actions ──

  async function createWs() {
    const name = prompt('Workspace name:');
    if (!name) return;
    const res = await api('/api/vault/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.success) {
      await loadWorkspaces();
      setActiveWs(res.data);
      setFolderStack([]);
    }
  }

  async function createFolderAction() {
    if (!activeWs) return;
    const name = prompt('Folder name:');
    if (!name) return;
    await api('/api/vault/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: activeWs.id, parentId: currentFolderId, name }),
    });
    loadContents();
  }

  async function delFolder(f: Folder) {
    if (!confirm(`Delete folder "${f.name}" and all contents?`)) return;
    await api(`/api/vault/folders/${f.id}`, { method: 'DELETE' });
    loadContents();
  }

  async function delFile(f: RFile) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    await api(`/api/vault/files/${f.id}`, { method: 'DELETE' });
    loadContents();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || !fileList.length || !activeWs) return;

    // If no folder selected, require one
    if (!currentFolderId) {
      alert('Navigate into a folder before uploading.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const form = new FormData();
      form.append('file', f);
      form.append('workspaceId', activeWs.id);
      form.append('folderId', currentFolderId);
      await fetch('/api/vault/upload', { method: 'POST', body: form });
    }
    setUploading(false);
    e.target.value = '';
    loadContents();
  }

  async function doSearch() {
    if (!activeWs || !searchQ.trim()) { setSearchResults(null); return; }
    const res = await api(`/api/vault/search?workspaceId=${activeWs.id}&q=${encodeURIComponent(searchQ)}`);
    if (res.success) setSearchResults(res.data);
  }

  function openFolder(f: Folder) {
    setFolderStack(prev => [...prev, f]);
  }

  function goUp() {
    setFolderStack(prev => prev.slice(0, -1));
  }

  function goToRoot() {
    setFolderStack([]);
  }

  function switchWorkspace(ws: Workspace) {
    setActiveWs(ws);
    setFolderStack([]);
  }

  async function delWorkspace() {
    if (!activeWs) return;
    if (!confirm(`Delete workspace "${activeWs.name}" and ALL its contents? This cannot be undone.`)) return;
    await api(`/api/vault/workspaces/${activeWs.id}`, { method: 'DELETE' });
    setActiveWs(null);
    setFolderStack([]);
    loadWorkspaces();
  }

  // ── Render ──

  const displayFiles = searchResults ?? files;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-khmer-header text-kgd-text">
            ឃ្លាំងធនធាន · <span className="text-kgd-blue">Resource Vault</span>
          </h1>
          <div className="flex gap-2">
            <Button onClick={createWs} variant="secondary" size="sm">+ Workspace</Button>
          </div>
        </div>

        {/* Workspace selector */}
        {workspaces === null ? (
          <Skeleton className="h-10 mb-4" />
        ) : workspaces.length === 0 ? (
          <EmptyState
            title="No workspaces"
            description="Create a workspace to start organising files."
          />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-khmer transition-colors
                    ${activeWs?.id === ws.id
                      ? 'bg-kgd-blue/20 text-kgd-blue border border-kgd-blue/40'
                      : 'bg-kgd-surface text-kgd-muted border border-kgd-border hover:bg-kgd-elevated'}`}
                >
                  {ws.nameKm || ws.name}
                </button>
              ))}
              {activeWs && (
                <button onClick={delWorkspace} className="text-xs text-red-400 hover:text-red-300 ml-2" title="Delete workspace">
                  Delete
                </button>
              )}
            </div>

            {activeWs && (
              <>
                {/* Breadcrumb + actions */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1 text-sm text-kgd-muted">
                    <button onClick={goToRoot} className="hover:text-kgd-blue">{activeWs.name}</button>
                    {folderStack.map((f, i) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-kgd-border">/</span>
                        {i === folderStack.length - 1 ? (
                          <span className="text-kgd-text">{f.name}</span>
                        ) : (
                          <button
                            onClick={() => setFolderStack(prev => prev.slice(0, i + 1))}
                            className="hover:text-kgd-blue"
                          >{f.name}</button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doSearch()}
                      className="bg-kgd-elevated border border-kgd-border rounded px-2 py-1 text-sm text-kgd-text placeholder:text-kgd-muted/60 w-40 focus:outline-none focus:border-kgd-blue"
                    />
                    <Button onClick={createFolderAction} variant="secondary" size="sm">+ Folder</Button>
                    <Button onClick={() => fileRef.current?.click()} variant="primary" size="sm" disabled={!currentFolderId || uploading}>
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
                  </div>
                </div>

                {/* Content area */}
                {loading ? (
                  <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                ) : (
                  <div className="bg-kgd-surface rounded-lg border border-kgd-border overflow-hidden">
                    {/* Back button */}
                    {folderStack.length > 0 && !searchResults && (
                      <button
                        onClick={goUp}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-kgd-muted hover:bg-kgd-elevated border-b border-kgd-border/60"
                      >
                        <span className="text-lg">⬆</span>
                        <span>.. (back)</span>
                      </button>
                    )}

                    {/* Folders */}
                    {!searchResults && folders.map(f => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated border-b border-kgd-border/60 group cursor-pointer"
                        onClick={() => openFolder(f)}
                      >
                        <span className="text-lg">📁</span>
                        <span className="flex-1 text-sm text-kgd-text font-khmer">{f.nameKm || f.name}</span>
                        <button
                          onClick={e => { e.stopPropagation(); delFolder(f); }}
                          className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >Delete</button>
                      </div>
                    ))}

                    {/* Files */}
                    {displayFiles.map(f => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-kgd-elevated border-b border-kgd-border/60 group"
                      >
                        <span className="text-lg">{mimeIcon(f.mimeType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-kgd-text truncate">{f.name}</div>
                          <div className="text-xs text-kgd-muted">{fmtSize(f.sizeBytes)} · {f.mimeType.split('/')[1]}</div>
                        </div>
                        <a
                          href={`/api/vault/files/${f.id}/download`}
                          className="text-xs text-kgd-blue hover:underline"
                          onClick={e => e.stopPropagation()}
                        >Download</a>
                        <button
                          onClick={() => delFile(f)}
                          className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >Delete</button>
                      </div>
                    ))}

                    {/* Empty state */}
                    {!searchResults && folders.length === 0 && files.length === 0 && (
                      <div className="px-4 py-12 text-center text-kgd-muted text-sm">
                        {currentFolderId
                          ? 'Empty folder. Upload files or create subfolders.'
                          : 'Create a folder to start organising resources.'}
                      </div>
                    )}
                    {searchResults && searchResults.length === 0 && (
                      <div className="px-4 py-12 text-center text-kgd-muted text-sm">
                        No files matched &ldquo;{searchQ}&rdquo;.{' '}
                        <button onClick={() => setSearchResults(null)} className="text-kgd-blue hover:underline">Clear search</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
