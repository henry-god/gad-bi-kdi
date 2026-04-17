/**
 * Notification Service — V6.
 *
 * Fan-out notifications on thread transitions.
 * Stored in Firestore `notifications` collection.
 */

import firestore from './firestore-service';

export interface Notification {
  id: string;
  userId: string;
  threadId?: string;
  kind: string;       // thread.submitted, thread.bounced, thread.signed, etc.
  title: string;
  titleKm?: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt?: any;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createNotification(opts: {
  userId: string;
  threadId?: string;
  kind: string;
  title: string;
  titleKm?: string;
  body?: string;
  link?: string;
}): Promise<Notification> {
  return firestore.create<Notification>('notifications', null, {
    userId: opts.userId,
    threadId: opts.threadId || null,
    kind: opts.kind,
    title: opts.title,
    titleKm: opts.titleKm || null,
    body: opts.body || null,
    link: opts.link || null,
    read: false,
  });
}

// ---------------------------------------------------------------------------
// Fan-out helpers (call from thread-engine transitions)
// ---------------------------------------------------------------------------

export async function notifyThreadArrived(opts: {
  targetUserId: string;
  threadId: string;
  threadTitle: string;
  threadTitleKm?: string;
  fromLevel: number;
  action: string;
}): Promise<void> {
  const actionLabel = opts.action === 'BOUNCE' ? 'bounced to you' :
    opts.action === 'SUBMIT' ? 'submitted to you' :
    opts.action === 'APPROVE' ? 'approved and forwarded to you' :
    `moved to you (${opts.action})`;

  await createNotification({
    userId: opts.targetUserId,
    threadId: opts.threadId,
    kind: `thread.${opts.action.toLowerCase()}`,
    title: `Thread from L${opts.fromLevel}: ${actionLabel}`,
    titleKm: opts.threadTitleKm || opts.threadTitle,
    body: opts.threadTitle,
    link: `/inbox/${opts.threadId}`,
  });
}

export async function notifyThreadSigned(opts: {
  creatorId: string;
  threadId: string;
  threadTitle: string;
  threadTitleKm?: string;
}): Promise<void> {
  await createNotification({
    userId: opts.creatorId,
    threadId: opts.threadId,
    kind: 'thread.signed',
    title: 'Your document has been signed',
    titleKm: 'ឯកសាររបស់អ្នកត្រូវបានចុះហត្ថលេខា',
    body: opts.threadTitle,
    link: `/inbox/${opts.threadId}`,
  });
}

export async function notifyThreadBounced(opts: {
  targetUserId: string;
  threadId: string;
  threadTitle: string;
  threadTitleKm?: string;
  fromLevel: number;
  notes: string;
}): Promise<void> {
  await createNotification({
    userId: opts.targetUserId,
    threadId: opts.threadId,
    kind: 'thread.bounced',
    title: `Revision needed from L${opts.fromLevel}`,
    titleKm: `ត្រូវការកែប្រែពី L${opts.fromLevel}`,
    body: opts.notes,
    link: `/inbox/${opts.threadId}`,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  return firestore.count('notifications', [
    ['userId', '==', userId],
    ['read', '==', false],
  ]);
}

export async function listNotifications(userId: string, limit = 20): Promise<Notification[]> {
  return firestore.list<Notification>('notifications', {
    where: [['userId', '==', userId]],
    orderBy: [['createdAt', 'desc']],
    limit,
  });
}

export async function markRead(userId: string, ids: string[]): Promise<void> {
  for (const id of ids) {
    const n = await firestore.getOne<Notification>('notifications', id);
    if (n && n.userId === userId) {
      await firestore.update('notifications', id, { read: true });
    }
  }
}

export async function markAllRead(userId: string): Promise<void> {
  const unread = await firestore.list<Notification>('notifications', {
    where: [['userId', '==', userId], ['read', '==', false]],
    limit: 200,
  });
  for (const n of unread) {
    await firestore.update('notifications', n.id, { read: true });
  }
}
