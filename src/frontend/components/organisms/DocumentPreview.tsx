'use client';

/**
 * DocumentPreview — pixel preview iframe.
 *
 * Renders via the backend /api/templates/:id/preview endpoint so the
 * preview matches the DOCX layout (shared constants in
 * src/shared/docx-constants.ts). Debounces data changes to keep the
 * iframe from thrashing while the user types.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  templateId: string;
  data: Record<string, string>;
  debounceMs?: number;
}

const encodeData = (data: Record<string, string>): string => {
  const json = JSON.stringify(data ?? {});
  if (typeof window === 'undefined') return '';
  return btoa(unescape(encodeURIComponent(json)));
};

export default function DocumentPreview({ templateId, data, debounceMs = 400 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string>('');

  const encoded = useMemo(() => encodeData(data), [data]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSrc(`/api/templates/${encodeURIComponent(templateId)}/preview?data=${encoded}`);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [templateId, encoded, debounceMs]);

  return (
    <div className="doc-preview-wrap bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      {src ? (
        <iframe
          ref={iframeRef}
          src={src}
          className="w-full h-[80vh] bg-white"
          title="Document preview"
        />
      ) : (
        <div className="h-[80vh] flex items-center justify-center text-slate-400 text-sm">
          កំពុងរៀបចំ preview…
        </div>
      )}
    </div>
  );
}
