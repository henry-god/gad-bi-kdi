/**
 * Workflow Service
 *
 * Drives document lifecycle transitions:
 *   draft → pending_review → approved → signed → archived
 *   pending_review → draft (reject, returns to owner)
 *
 * Every transition writes three rows in one transaction:
 *   - documents.status update
 *   - approval_flow row (who did what, when, comments)
 *   - audit_logs row
 *
 * Version snapshots are captured on submit so the reviewed-and-approved
 * artifact is immutable even if the owner keeps editing the draft.
 */

import { prisma } from './prisma';
import { isFirestore } from './store';
import firestore from './firestore-service';
import admin from 'firebase-admin';

type Status =
  | 'draft'
  | 'pending_review'
  | 'reviewed'
  | 'approved'
  | 'signed'
  | 'archived';

type ActorRole = 'admin' | 'officer' | 'reviewer' | 'signer';
type Action = 'submit' | 'review' | 'approve' | 'reject' | 'sign' | 'archive';

interface Actor {
  id: string;
  role: ActorRole;
}

const TRANSITIONS: Record<
  Action,
  { from: Status[]; to: Status; roles: ActorRole[]; requireComment?: boolean; ownerOnly?: boolean }
> = {
  submit:  { from: ['draft'],          to: 'pending_review', roles: ['officer', 'admin'], ownerOnly: true },
  review:  { from: ['pending_review'], to: 'reviewed',       roles: ['reviewer', 'admin'] },
  approve: { from: ['pending_review', 'reviewed'], to: 'approved', roles: ['reviewer', 'admin'] },
  reject:  { from: ['pending_review', 'reviewed'], to: 'draft',    roles: ['reviewer', 'admin'], requireComment: true },
  sign:    { from: ['approved'],       to: 'signed',         roles: ['signer', 'admin'] },
  archive: { from: ['signed'],         to: 'archived',       roles: ['admin'] },
};

export class WorkflowError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function transition(opts: {
  documentId: string;
  actor: Actor;
  action: Action;
  comments?: string;
  ipAddress?: string;
}) {
  const rule = TRANSITIONS[opts.action];
  if (!rule) throw new WorkflowError(`Unknown action: ${opts.action}`);
  if (!rule.roles.includes(opts.actor.role)) {
    throw new WorkflowError(`Role '${opts.actor.role}' cannot ${opts.action}`, 403);
  }
  if (rule.requireComment && !opts.comments?.trim()) {
    throw new WorkflowError(`Action '${opts.action}' requires comments`);
  }

  if (isFirestore()) {
    return firestore.runTransaction(async (tx) => {
      const db = firestore.db();
      const docRef = db.collection('documents').doc(opts.documentId);
      const docSnap = await tx.get(docRef);
      if (!docSnap.exists) throw new WorkflowError('Document not found', 404);
      const doc = { id: docSnap.id, ...(docSnap.data() as any) };

      if (rule.ownerOnly && doc.userId !== opts.actor.id) {
        throw new WorkflowError('Only the document owner can perform this action', 403);
      }
      if (!rule.from.includes(doc.status as Status)) {
        throw new WorkflowError(
          `Cannot ${opts.action} from status '${doc.status}' (must be one of ${rule.from.join(', ')})`,
        );
      }

      // step order = 1 + max existing; computed via a pre-transaction read
      // (Firestore requires all reads before writes inside a txn)
      const flowSnap = await db.collection('approvalFlow')
        .where('documentId', '==', doc.id)
        .orderBy('stepOrder', 'desc')
        .limit(1)
        .get();
      const stepOrder = (flowSnap.empty ? 0 : (flowSnap.docs[0].data().stepOrder ?? 0)) + 1;

      const now = admin.firestore.FieldValue.serverTimestamp();

      if (opts.action === 'submit') {
        const versionRef = docRef.collection('versions').doc(String(doc.version ?? 1));
        tx.set(versionRef, {
          version: doc.version ?? 1,
          contentSnapshot: doc.inputData || {},
          changedById: opts.actor.id,
          changeSummary: `Submitted v${doc.version ?? 1} for review`,
          createdAt: now,
        });
      }

      tx.update(docRef, { status: rule.to, updatedAt: now });
      tx.set(db.collection('approvalFlow').doc(), {
        documentId: doc.id, stepOrder, action: opts.action, actorId: opts.actor.id,
        status: 'completed', comments: opts.comments ?? null,
        createdAt: now, updatedAt: now,
      });
      tx.set(db.collection('auditLogs').doc(), {
        userId: opts.actor.id, action: `document.${opts.action}`,
        resourceType: 'document', resourceId: doc.id,
        details: { from: doc.status, to: rule.to, comments: opts.comments ?? null },
        ipAddress: opts.ipAddress ?? null,
        createdAt: now, updatedAt: now,
      });
      return { ...doc, status: rule.to };
    });
  }

  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id: opts.documentId } });
    if (!doc) throw new WorkflowError('Document not found', 404);

    if (rule.ownerOnly && doc.userId !== opts.actor.id) {
      throw new WorkflowError('Only the document owner can perform this action', 403);
    }
    if (!rule.from.includes(doc.status as Status)) {
      throw new WorkflowError(
        `Cannot ${opts.action} from status '${doc.status}' (must be one of ${rule.from.join(', ')})`,
      );
    }

    const lastStep = await tx.approvalFlow.aggregate({
      where: { documentId: doc.id },
      _max: { stepOrder: true },
    });
    const stepOrder = (lastStep._max.stepOrder ?? 0) + 1;

    // Snapshot on submit so the version being reviewed is immutable
    if (opts.action === 'submit') {
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: doc.version,
          contentSnapshot: doc.inputData as any,
          changedById: opts.actor.id,
          changeSummary: `Submitted v${doc.version} for review`,
        },
      });
    }

    const updated = await tx.document.update({
      where: { id: doc.id },
      data: { status: rule.to },
    });

    await tx.approvalFlow.create({
      data: {
        documentId: doc.id,
        stepOrder,
        action: opts.action as any,
        actorId: opts.actor.id,
        status: 'completed',
        comments: opts.comments,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: opts.actor.id,
        action: `document.${opts.action}`,
        resourceType: 'document',
        resourceId: doc.id,
        details: { from: doc.status, to: rule.to, comments: opts.comments } as any,
        ipAddress: opts.ipAddress,
      },
    });

    return updated;
  });
}

export async function listApprovalHistory(documentId: string) {
  if (isFirestore()) {
    return firestore.list<any>('approvalFlow', {
      where: [['documentId', '==', documentId]],
      orderBy: [['stepOrder', 'asc']],
    });
  }
  return prisma.approvalFlow.findMany({
    where: { documentId },
    orderBy: { stepOrder: 'asc' },
    include: { actor: { select: { id: true, name: true, nameKm: true, role: true } } },
  });
}

export async function listDocumentVersions(documentId: string) {
  if (isFirestore()) {
    return firestore.sublist<any>('documents', documentId, 'versions', {
      orderBy: [['version', 'desc']],
    });
  }
  return prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
    include: { changedBy: { select: { id: true, name: true, nameKm: true } } },
  });
}

export async function listPendingReview(actor: Actor) {
  if (!['reviewer', 'admin'].includes(actor.role)) {
    throw new WorkflowError('Role cannot view approval queue', 403);
  }
  if (isFirestore()) {
    return firestore.list<any>('documents', {
      where: [['status', 'in', ['pending_review', 'reviewed']]],
      orderBy: [['updatedAt', 'asc']],
      limit: 100,
    });
  }
  return prisma.document.findMany({
    where: { status: { in: ['pending_review', 'reviewed'] } },
    orderBy: { updatedAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, nameKm: true, department: true } },
    },
  });
}
