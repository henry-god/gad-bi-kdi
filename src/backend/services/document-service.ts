/**
 * Document Service
 *
 * Persists generated documents to the configured store (Firestore in
 * production, Postgres locally) and the DOCX blob to storage. Emits
 * auditLogs rows on every mutating call.
 */

import { prisma } from './prisma';
import { saveDocument, readDocument } from './storage-service';
import { getSetting } from './settings-service';
import TemplateEngine from './template-engine';
import { templateStore } from './template-store';
import { isFirestore } from './store';
import firestore from './firestore-service';

const engine = new TemplateEngine();

type InputData = Record<string, string>;

export async function resolveLetterhead(userId: string): Promise<{ ministry_name: string; department_name: string }> {
  const ministryFromSetting = (await getSetting('MINISTRY_NAME_KM')) ?? '';
  if (isFirestore()) {
    try {
      const user = await firestore.getOne<any>('users', userId);
      let deptNameKm = '';
      let orgNameKm = '';
      if (user?.departmentId) {
        const dept = await firestore.getOne<any>('departments', user.departmentId);
        deptNameKm = dept?.nameKm || '';
        if (dept?.organizationId) {
          const org = await firestore.getOne<any>('organizations', dept.organizationId);
          orgNameKm = org?.nameKm || '';
        }
      }
      return {
        ministry_name: orgNameKm || ministryFromSetting,
        department_name: deptNameKm,
      };
    } catch {
      return { ministry_name: ministryFromSetting, department_name: '' };
    }
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { departmentRef: { include: { organization: true } } },
  });
  const ministryFromOrg = user?.departmentRef?.organization?.nameKm;
  const ministry_name = ministryFromOrg || ministryFromSetting;
  const department_name = user?.departmentRef?.nameKm || '';
  return { ministry_name, department_name };
}

export async function createDocument(opts: {
  userId: string;
  templateId: string;
  data: InputData;
  ipAddress?: string;
}) {
  const config = await templateStore.getTemplate(opts.templateId);
  const resolved = await resolveLetterhead(opts.userId);
  const mergedData: InputData = {
    ministry_name: resolved.ministry_name,
    department_name: resolved.department_name,
    ...opts.data,
  };
  const buffer = await engine.generate(opts.templateId, mergedData);

  const title =
    opts.data.subject || opts.data.meeting_title || opts.data.title || config.name;
  const titleKm =
    opts.data.subject || opts.data.meeting_title || opts.data.title || config.nameKm;

  if (isFirestore()) {
    const docRef = await firestore.create<any>('documents', null, {
      userId: opts.userId,
      templateId: opts.templateId,
      status: 'draft',
      title, titleKm,
      inputData: opts.data,
      version: 1,
      outputFilePath: null,
    });
    const filePath = await saveDocument(docRef.id, buffer);
    const updated = await firestore.update<any>('documents', docRef.id, { outputFilePath: filePath });
    try {
      await firestore.create('auditLogs', null, {
        userId: opts.userId,
        action: 'document.create',
        resourceType: 'document',
        resourceId: docRef.id,
        details: { templateId: opts.templateId, title },
        ipAddress: opts.ipAddress ?? null,
      });
    } catch { /* audit is non-fatal */ }
    return { document: updated, buffer };
  }

  const doc = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        userId: opts.userId, templateId: opts.templateId, status: 'draft',
        title, titleKm, inputData: opts.data as any, version: 1,
      },
    });
    const filePath = await saveDocument(doc.id, buffer);
    const updated = await tx.document.update({ where: { id: doc.id }, data: { outputFilePath: filePath } });
    await tx.auditLog.create({
      data: {
        userId: opts.userId, action: 'document.create', resourceType: 'document',
        resourceId: doc.id, details: { templateId: opts.templateId, title } as any,
        ipAddress: opts.ipAddress,
      },
    });
    return updated;
  });

  return { document: doc, buffer };
}

export async function listDocuments(userId: string) {
  if (isFirestore()) {
    return firestore.list<any>('documents', {
      where: [['userId', '==', userId]],
      orderBy: [['updatedAt', 'desc']],
      limit: 100,
    });
  }
  return prisma.document.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, templateId: true, status: true, title: true, titleKm: true,
      version: true, createdAt: true, updatedAt: true,
    },
  });
}

export async function getDocument(userId: string, id: string) {
  if (isFirestore()) {
    const doc = await firestore.getOne<any>('documents', id);
    if (!doc || (doc.userId !== userId && userId !== 'guest' && userId !== 'admin')) {
      throw new Error('Document not found');
    }
    return doc;
  }
  const doc = await prisma.document.findFirst({ where: { id, userId } });
  if (!doc) throw new Error('Document not found');
  return doc;
}

export async function readDocumentFile(userId: string, id: string): Promise<Buffer> {
  const doc = await getDocument(userId, id);
  return await readDocument((doc as any).id);
}
