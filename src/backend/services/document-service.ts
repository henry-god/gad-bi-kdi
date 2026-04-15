/**
 * Document Service
 *
 * Persists generated documents to Postgres (documents table) and
 * the generated DOCX blob to storage. Emits audit_logs rows on every
 * mutating call so record + log can't diverge.
 */

import { prisma } from './prisma';
import { saveDocument, readDocument } from './storage-service';
import { getSetting } from './settings-service';
import TemplateEngine from './template-engine';
import { templateStore } from './template-store';

const engine = new TemplateEngine();

type InputData = Record<string, string>;

export async function resolveLetterhead(userId: string): Promise<{ ministry_name: string; department_name: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { departmentRef: { include: { organization: true } } },
  });
  const ministryFromOrg = user?.departmentRef?.organization?.nameKm;
  const ministryFromSetting = (await getSetting('MINISTRY_NAME_KM')) ?? '';
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
    opts.data.subject ||
    opts.data.meeting_title ||
    opts.data.title ||
    config.name;
  const titleKm =
    opts.data.subject ||
    opts.data.meeting_title ||
    opts.data.title ||
    config.nameKm;

  const doc = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        userId: opts.userId,
        templateId: opts.templateId,
        status: 'draft',
        title,
        titleKm,
        inputData: opts.data as any,
        version: 1,
      },
    });

    const filePath = await saveDocument(doc.id, buffer);

    const updated = await tx.document.update({
      where: { id: doc.id },
      data: { outputFilePath: filePath },
    });

    await tx.auditLog.create({
      data: {
        userId: opts.userId,
        action: 'document.create',
        resourceType: 'document',
        resourceId: doc.id,
        details: { templateId: opts.templateId, title } as any,
        ipAddress: opts.ipAddress,
      },
    });

    return updated;
  });

  return { document: doc, buffer };
}

export async function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      templateId: true,
      status: true,
      title: true,
      titleKm: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getDocument(userId: string, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId },
  });
  if (!doc) throw new Error('Document not found');
  return doc;
}

export async function readDocumentFile(userId: string, id: string): Promise<Buffer> {
  const doc = await getDocument(userId, id);
  return await readDocument(doc.id);
}
