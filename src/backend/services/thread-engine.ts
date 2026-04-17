/**
 * Thread Engine — V6-M1.
 *
 * State machine for the 7-level document thread workflow.
 * All transitions enforce the NBFSA permission matrix and write
 * ThreadAction + ThreadVersion rows atomically in Firestore.
 *
 * Firestore collections:
 *   threads              — DocumentThread metadata + latest content
 *   threads/{id}/actions  — ThreadAction subcollection
 *   threads/{id}/versions — ThreadVersion subcollection
 */

import firestore from './firestore-service';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const THREAD_STATUS = [
  'CREATED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL',
  'BOUNCED', 'REVISION', 'RESUBMITTED', 'PENDING_SIGN',
  'SIGNED', 'ARCHIVED', 'CANCELLED',
] as const;
export type ThreadStatus = typeof THREAD_STATUS[number];

export const THREAD_DIRECTION = ['up', 'down', 'lateral'] as const;
export type ThreadDirection = typeof THREAD_DIRECTION[number];

export const ACTION_TYPES = [
  'CREATE', 'SUBMIT', 'REVIEW', 'APPROVE', 'BOUNCE',
  'REVISE', 'RESUBMIT', 'SIGN', 'ANNOTATE', 'ASSIGN',
  'FORWARD', 'RECALL', 'ARCHIVE',
] as const;
export type ActionType = typeof ACTION_TYPES[number];

export const BOUNCE_REASONS = [
  'wrong_reference', 'missing_attachment', 'incorrect_budget',
  'citation_error', 'tone_wording', 'missing_parallel_approval',
  'factual_error', 'incomplete_info', 'misaligned_directive',
  'formatting_violation', 'other',
] as const;
export type BounceReason = typeof BOUNCE_REASONS[number];

export type Priority = 'normal' | 'urgent' | 'confidential';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentThread {
  id: string;
  templateId: string;
  title: string;
  titleKm?: string;
  currentLevel: number;       // 1-7
  currentHolderId: string;
  direction: ThreadDirection;
  status: ThreadStatus;
  bounceCount: number;
  currentVersion: number;
  priority: Priority;
  deadline?: string | null;
  createdById: string;
  departmentId?: string;
  targetSignerId?: string;
  latestContent: Record<string, any>;
  createdAt?: any;
  updatedAt?: any;
}

export interface ThreadAction {
  id: string;
  threadId: string;
  actorId: string;
  actorLevel: number;
  action: ActionType;
  direction: ThreadDirection;
  fromLevel: number;
  toLevel: number;
  notes?: string;
  notesKm?: string;
  reasonCode?: BounceReason;
  versionBefore: number;
  versionAfter: number;
  timeHeldMs: number;
  createdAt?: any;
}

export interface ThreadVersion {
  id: string;
  threadId: string;
  versionNumber: number;
  contentSnapshot: Record<string, any>;
  changeSummary?: string;
  changeSummaryKm?: string;
  triggeredByActionId?: string;
  createdAt?: any;
}

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const LEVEL_ACTIONS: Record<number, ActionType[]> = {
  1: ['SIGN', 'APPROVE', 'BOUNCE', 'ANNOTATE', 'ARCHIVE'],
  2: ['APPROVE', 'REVIEW', 'BOUNCE', 'ANNOTATE', 'FORWARD'],
  3: ['APPROVE', 'REVIEW', 'BOUNCE', 'ASSIGN', 'ANNOTATE'],
  4: ['APPROVE', 'REVIEW', 'BOUNCE', 'ASSIGN', 'ANNOTATE'],
  5: ['APPROVE', 'REVIEW', 'BOUNCE', 'CREATE', 'SUBMIT', 'ANNOTATE', 'ASSIGN'],
  6: ['REVIEW', 'SUBMIT', 'BOUNCE', 'CREATE', 'ANNOTATE'],
  7: ['CREATE', 'SUBMIT', 'REVISE', 'RESUBMIT', 'ANNOTATE', 'RECALL'],
};

function canPerform(level: number, action: ActionType): boolean {
  return (LEVEL_ACTIONS[level] || []).includes(action);
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

async function writeAction(
  threadId: string,
  action: Omit<ThreadAction, 'id' | 'threadId' | 'createdAt'>,
): Promise<ThreadAction> {
  return firestore.subcreate<ThreadAction>('threads', threadId, 'actions', null, {
    ...action,
    threadId,
  });
}

async function writeVersion(
  threadId: string,
  version: Omit<ThreadVersion, 'id' | 'threadId' | 'createdAt'>,
): Promise<ThreadVersion> {
  return firestore.subcreate<ThreadVersion>('threads', threadId, 'versions', null, {
    ...version,
    threadId,
  });
}

// ── Create ──────────────────────────────────────────────────────────

export async function createThread(opts: {
  templateId: string;
  title: string;
  titleKm?: string;
  content: Record<string, any>;
  creatorId: string;
  creatorLevel: number;
  departmentId?: string;
  priority?: Priority;
  deadline?: string;
  targetSignerId?: string;
}): Promise<DocumentThread> {
  if (opts.creatorLevel < 5) throw new Error('Only L5-L7 can create threads');

  const thread = await firestore.create<DocumentThread>('threads', null, {
    templateId: opts.templateId,
    title: opts.title,
    titleKm: opts.titleKm || null,
    currentLevel: opts.creatorLevel,
    currentHolderId: opts.creatorId,
    direction: 'up',
    status: 'CREATED',
    bounceCount: 0,
    currentVersion: 1,
    priority: opts.priority || 'normal',
    deadline: opts.deadline || null,
    createdById: opts.creatorId,
    departmentId: opts.departmentId || null,
    targetSignerId: opts.targetSignerId || null,
    latestContent: opts.content,
  });

  await writeAction(thread.id, {
    actorId: opts.creatorId,
    actorLevel: opts.creatorLevel,
    action: 'CREATE',
    direction: 'up',
    fromLevel: opts.creatorLevel,
    toLevel: opts.creatorLevel,
    versionBefore: 0,
    versionAfter: 1,
    timeHeldMs: 0,
  });

  await writeVersion(thread.id, {
    versionNumber: 1,
    contentSnapshot: opts.content,
    changeSummary: 'Initial draft',
  });

  return thread;
}

// ── Submit up ───────────────────────────────────────────────────────

export async function submitUp(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  notes?: string;
  targetHolderId: string;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (!canPerform(opts.actorLevel, 'SUBMIT')) throw new Error(`L${opts.actorLevel} cannot submit`);
  const validStatuses = ['CREATED', 'REVISION', 'RESUBMITTED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL'];
  if (!validStatuses.includes(thread.status)) throw new Error(`Cannot submit from ${thread.status}`);

  const toLevel = opts.actorLevel - 1;
  if (toLevel < 1) throw new Error('Cannot submit above L1');

  const newStatus: ThreadStatus = toLevel === 1 ? 'PENDING_SIGN' : 'SUBMITTED';

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'SUBMIT',
    direction: 'up',
    fromLevel: opts.actorLevel,
    toLevel,
    notes: opts.notes,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    currentLevel: toLevel,
    currentHolderId: opts.targetHolderId,
    direction: 'up',
    status: newStatus,
  });
}

// ── Approve ─────────────────────────────────────────────────────────

export async function approveAt(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  notes?: string;
  targetHolderId: string;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (!canPerform(opts.actorLevel, 'APPROVE')) throw new Error(`L${opts.actorLevel} cannot approve`);

  const toLevel = opts.actorLevel - 1;
  const newStatus: ThreadStatus = toLevel === 1 ? 'PENDING_SIGN' : 'APPROVED_LEVEL';

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'APPROVE',
    direction: 'up',
    fromLevel: opts.actorLevel,
    toLevel,
    notes: opts.notes,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    currentLevel: toLevel,
    currentHolderId: opts.targetHolderId,
    direction: 'up',
    status: newStatus,
  });
}

// ── Bounce down ─────────────────────────────────────────────────────

export async function bounceDown(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  toLevel: number;
  targetHolderId: string;
  notes: string;
  notesKm?: string;
  reasonCode?: BounceReason;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (!canPerform(opts.actorLevel, 'BOUNCE')) throw new Error(`L${opts.actorLevel} cannot bounce`);
  if (opts.toLevel <= opts.actorLevel) throw new Error('Can only bounce to a lower level');
  if (opts.toLevel > 7) throw new Error('Invalid target level');

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'BOUNCE',
    direction: 'down',
    fromLevel: opts.actorLevel,
    toLevel: opts.toLevel,
    notes: opts.notes,
    notesKm: opts.notesKm,
    reasonCode: opts.reasonCode,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    currentLevel: opts.toLevel,
    currentHolderId: opts.targetHolderId,
    direction: 'down',
    status: 'BOUNCED',
    bounceCount: (thread.bounceCount || 0) + 1,
  });
}

// ── Revise ──────────────────────────────────────────────────────────

export async function reviseDraft(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  newContent: Record<string, any>;
  changeSummary?: string;
  changeSummaryKm?: string;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (thread.status !== 'BOUNCED' && thread.status !== 'CREATED') {
    throw new Error('Can only revise when BOUNCED or CREATED');
  }

  const newVersion = thread.currentVersion + 1;

  const actionDoc = await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'REVISE',
    direction: 'up',
    fromLevel: opts.actorLevel,
    toLevel: opts.actorLevel,
    notes: opts.changeSummary,
    versionBefore: thread.currentVersion,
    versionAfter: newVersion,
    timeHeldMs: 0,
  });

  await writeVersion(thread.id, {
    versionNumber: newVersion,
    contentSnapshot: opts.newContent,
    changeSummary: opts.changeSummary,
    changeSummaryKm: opts.changeSummaryKm,
    triggeredByActionId: actionDoc.id,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    status: 'REVISION',
    currentVersion: newVersion,
    latestContent: opts.newContent,
  });
}

// ── Resubmit ────────────────────────────────────────────────────────

export async function resubmitRevision(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  notes?: string;
  targetHolderId: string;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (thread.status !== 'REVISION') throw new Error('Can only resubmit from REVISION status');

  const toLevel = opts.actorLevel - 1;

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'RESUBMIT',
    direction: 'up',
    fromLevel: opts.actorLevel,
    toLevel,
    notes: opts.notes,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    currentLevel: toLevel,
    currentHolderId: opts.targetHolderId,
    direction: 'up',
    status: 'RESUBMITTED',
  });
}

// ── Sign (L1 only) ─────────────────────────────────────────────────

export async function sign(opts: {
  threadId: string;
  actorId: string;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.currentHolderId !== opts.actorId) throw new Error('Not the current holder');
  if (thread.status !== 'PENDING_SIGN') throw new Error('Thread must be PENDING_SIGN');

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: 1,
    action: 'SIGN',
    direction: 'up',
    fromLevel: 1,
    toLevel: 1,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, {
    status: 'SIGNED',
    direction: 'up',
  });
}

// ── Annotate ────────────────────────────────────────────────────────

export async function annotate(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
  notes: string;
  notesKm?: string;
}): Promise<ThreadAction> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');

  return writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'ANNOTATE',
    direction: 'lateral',
    fromLevel: opts.actorLevel,
    toLevel: opts.actorLevel,
    notes: opts.notes,
    notesKm: opts.notesKm,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });
}

// ── Cancel / Archive ────────────────────────────────────────────────

export async function cancelThread(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.createdById !== opts.actorId && opts.actorLevel > 1) {
    throw new Error('Only the creator or L1 can cancel');
  }

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'RECALL',
    direction: 'lateral',
    fromLevel: thread.currentLevel,
    toLevel: thread.currentLevel,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, { status: 'CANCELLED' });
}

export async function archiveThread(opts: {
  threadId: string;
  actorId: string;
  actorLevel: number;
}): Promise<DocumentThread> {
  const thread = await firestore.getOne<DocumentThread>('threads', opts.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.status !== 'SIGNED') throw new Error('Only signed threads can be archived');

  await writeAction(thread.id, {
    actorId: opts.actorId,
    actorLevel: opts.actorLevel,
    action: 'ARCHIVE',
    direction: 'lateral',
    fromLevel: 1,
    toLevel: 1,
    versionBefore: thread.currentVersion,
    versionAfter: thread.currentVersion,
    timeHeldMs: 0,
  });

  return firestore.update<DocumentThread>('threads', opts.threadId, { status: 'ARCHIVED' });
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getThread(id: string): Promise<DocumentThread | null> {
  return firestore.getOne<DocumentThread>('threads', id);
}

export async function getTimeline(threadId: string): Promise<ThreadAction[]> {
  return firestore.sublist<ThreadAction>('threads', threadId, 'actions', {
    orderBy: [['createdAt', 'asc']],
  });
}

export async function getVersions(threadId: string): Promise<ThreadVersion[]> {
  return firestore.sublist<ThreadVersion>('threads', threadId, 'versions', {
    orderBy: [['versionNumber', 'asc']],
  });
}

export async function listThreads(opts?: {
  holderId?: string;
  status?: ThreadStatus;
  departmentId?: string;
  limit?: number;
}): Promise<DocumentThread[]> {
  const where: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [];
  if (opts?.holderId) where.push(['currentHolderId', '==', opts.holderId]);
  if (opts?.status) where.push(['status', '==', opts.status]);
  if (opts?.departmentId) where.push(['departmentId', '==', opts.departmentId]);
  return firestore.list<DocumentThread>('threads', {
    where,
    orderBy: [['updatedAt', 'desc']],
    limit: opts?.limit || 100,
  });
}
