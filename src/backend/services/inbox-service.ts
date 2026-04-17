/**
 * Inbox Service — V6-M2.
 *
 * Per-level inbox views for the thread workflow.
 * Scopes visibility per user level (L1-L7).
 */

import firestore from './firestore-service';
import type { DocumentThread, ThreadAction, ThreadStatus } from './thread-engine';

export interface InboxSection {
  key: string;
  labelKm: string;
  labelEn: string;
  threads: DocumentThread[];
}

export interface InboxStats {
  drafts: number;
  pendingReview: number;
  bounced: number;
  sentUp: number;
  signed: number;
  overdue: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Inbox for a specific user
// ---------------------------------------------------------------------------

export async function getMyInbox(userId: string, userLevel: number): Promise<InboxSection[]> {
  const sections: InboxSection[] = [];

  // Threads I currently hold
  const myThreads = await firestore.list<DocumentThread>('threads', {
    where: [['currentHolderId', '==', userId]],
    orderBy: [['updatedAt', 'desc']],
    limit: 100,
  });

  // Threads I created (for tracking)
  const created = await firestore.list<DocumentThread>('threads', {
    where: [['createdById', '==', userId]],
    orderBy: [['updatedAt', 'desc']],
    limit: 100,
  });

  if (userLevel >= 5) {
    // L5-L7: Officer/chief view
    sections.push({
      key: 'drafts',
      labelKm: 'សេចក្តីព្រាង',
      labelEn: 'Active Drafts',
      threads: myThreads.filter(t => t.status === 'CREATED' || t.status === 'REVISION'),
    });
    sections.push({
      key: 'bounced',
      labelKm: 'បានបញ្ជូនត្រឡប់',
      labelEn: 'Revision Requests',
      threads: myThreads.filter(t => t.status === 'BOUNCED'),
    });
    sections.push({
      key: 'pending',
      labelKm: 'កំពុងរង់ចាំ',
      labelEn: 'Pending Review',
      threads: myThreads.filter(t => ['SUBMITTED', 'IN_REVIEW', 'RESUBMITTED'].includes(t.status)),
    });
    sections.push({
      key: 'sent',
      labelKm: 'បានបញ្ជូន',
      labelEn: 'Sent Up',
      threads: created.filter(t =>
        t.currentHolderId !== userId &&
        !['SIGNED', 'ARCHIVED', 'CANCELLED'].includes(t.status)
      ),
    });
    sections.push({
      key: 'completed',
      labelKm: 'បានបញ្ចប់',
      labelEn: 'Completed',
      threads: created.filter(t => ['SIGNED', 'ARCHIVED'].includes(t.status)),
    });
  } else if (userLevel >= 3) {
    // L3-L4: Department director view
    sections.push({
      key: 'awaiting',
      labelKm: 'រង់ចាំការអនុម័ត',
      labelEn: 'Awaiting Approval',
      threads: myThreads.filter(t => ['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED'].includes(t.status)),
    });
    sections.push({
      key: 'bounced',
      labelKm: 'បានបញ្ជូនត្រឡប់',
      labelEn: 'Bounced Back',
      threads: myThreads.filter(t => t.status === 'BOUNCED'),
    });
    sections.push({
      key: 'sent',
      labelKm: 'បានបញ្ជូនឡើង',
      labelEn: 'Sent Up',
      threads: created.filter(t =>
        t.currentHolderId !== userId &&
        t.currentLevel < userLevel &&
        !['SIGNED', 'ARCHIVED', 'CANCELLED'].includes(t.status)
      ),
    });
  } else {
    // L1-L2: Secretary General view
    sections.push({
      key: 'sign',
      labelKm: 'រង់ចាំហត្ថលេខា',
      labelEn: 'Ready for Signature',
      threads: myThreads.filter(t => t.status === 'PENDING_SIGN'),
    });
    sections.push({
      key: 'review',
      labelKm: 'រង់ចាំពិនិត្យ',
      labelEn: 'Pending Review',
      threads: myThreads.filter(t => ['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED'].includes(t.status)),
    });
    sections.push({
      key: 'signed',
      labelKm: 'បានចុះហត្ថលេខា',
      labelEn: 'Recently Signed',
      threads: await firestore.list<DocumentThread>('threads', {
        where: [['status', '==', 'SIGNED']],
        orderBy: [['updatedAt', 'desc']],
        limit: 20,
      }),
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getInboxStats(userId: string): Promise<InboxStats> {
  const myThreads = await firestore.list<DocumentThread>('threads', {
    where: [['currentHolderId', '==', userId]],
    limit: 200,
  });

  const created = await firestore.list<DocumentThread>('threads', {
    where: [['createdById', '==', userId]],
    limit: 200,
  });

  return {
    drafts: myThreads.filter(t => t.status === 'CREATED' || t.status === 'REVISION').length,
    pendingReview: myThreads.filter(t => ['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED', 'PENDING_SIGN'].includes(t.status)).length,
    bounced: myThreads.filter(t => t.status === 'BOUNCED').length,
    sentUp: created.filter(t => t.currentHolderId !== userId && !['SIGNED', 'ARCHIVED', 'CANCELLED'].includes(t.status)).length,
    signed: created.filter(t => t.status === 'SIGNED').length,
    overdue: 0, // TODO: SLA check
    total: myThreads.length,
  };
}
