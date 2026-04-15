import React from 'react';
import { Badge } from './Badge';

export type DocumentStatus =
  | 'draft'
  | 'pending_review'
  | 'reviewed'
  | 'approved'
  | 'signed'
  | 'archived';

const META: Record<
  DocumentStatus,
  { tone: 'neutral' | 'amber' | 'sky' | 'emerald' | 'teal'; glyph: string; km: string; en: string }
> = {
  draft:          { tone: 'neutral', glyph: '◯',   km: 'ព្រាង',           en: 'Draft' },
  pending_review: { tone: 'amber',   glyph: '⏳',  km: 'កំពុងពិនិត្យ',      en: 'Pending review' },
  reviewed:       { tone: 'sky',     glyph: '◎',   km: 'បានពិនិត្យ',        en: 'Reviewed' },
  approved:       { tone: 'emerald', glyph: '✓',   km: 'បានអនុម័ត',        en: 'Approved' },
  signed:         { tone: 'teal',    glyph: '✎',   km: 'បានចុះហត្ថលេខា',   en: 'Signed' },
  archived:       { tone: 'neutral', glyph: '📦',  km: 'រក្សាទុក',          en: 'Archived' },
};

interface Props {
  status: DocumentStatus | string;
  showEnglish?: boolean;
  className?: string;
}

export function StatusChip({ status, showEnglish = false, className }: Props) {
  const meta = (META as any)[status] ?? { tone: 'neutral', glyph: '?', km: status, en: status };
  return (
    <Badge tone={meta.tone} icon={meta.glyph} className={className}>
      {meta.km}
      {showEnglish && <span className="text-[10px] opacity-70 ml-1">· {meta.en}</span>}
    </Badge>
  );
}

export default StatusChip;
