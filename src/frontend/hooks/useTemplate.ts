/**
 * useTemplate Hook
 * Fetch and cache template config + rules for a given templateId.
 * 
 * TODO (Claude Code): Add error handling, loading states, caching
 */

import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export function useTemplate(templateId: string | null) {
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    api.getTemplate(templateId)
      .then((res: any) => { if (res.success) setTemplate(res.data); else setError(res.error || 'Failed'); })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [templateId]);

  return { template, loading, error };
}

export function useTemplateList() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTemplates()
      .then((res: any) => { if (res.success) setTemplates(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { templates, loading };
}
