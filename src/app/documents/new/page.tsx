'use client';

import { useRouter } from 'next/navigation';
import AppShell from '../../_components/AppShell';
import TemplateSelector from '../../../frontend/components/organisms/TemplateSelector';

export default function ChooseTemplatePage() {
  const router = useRouter();
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-kgd-muted">ជំហានទី ១ / ៤ · Step 1 of 4</p>
          <h1 className="font-khmer text-2xl md:text-3xl font-bold text-kgd-text mt-1">
            ជ្រើសរើសគំរូ
          </h1>
          <p className="text-sm text-kgd-muted">
            Pick the document type you're drafting. All 13 templates produce pixel-perfect Khmer
            DOCX.
          </p>
        </div>
        <TemplateSelector onSelect={(id) => router.push(`/documents/new/${id}`)} />
      </div>
    </AppShell>
  );
}
