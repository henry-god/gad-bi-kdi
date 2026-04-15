/**
 * API Client
 * Centralized fetch wrapper for all backend API calls.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  return res.json();
}

export const api = {
  // Templates
  listTemplates: () => request('/api/templates'),
  getTemplate: (id: string) => request(`/api/templates/${id}`),

  // Documents
  generateDocument: async (templateId: string, data: Record<string, string>) => {
    const res = await fetch(`${BASE_URL}/api/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, data }),
    });
    if (!res.ok) throw new Error('Generation failed');
    return res.blob(); // Returns DOCX blob for download
  },

  // Knowledge (Phase 3+)
  listCategories: () => request('/api/knowledge/categories'),
  matchRules: (content: string, templateId: string) =>
    request('/api/knowledge/match', {
      method: 'POST',
      body: JSON.stringify({ content, templateId }),
    }),

  // AI (Phase 2+)
  processOcr: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/api/ai/ocr`, { method: 'POST', body: form }).then(r => r.json());
  },
  processAudio: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/api/ai/stt`, { method: 'POST', body: form }).then(r => r.json());
  },
};

/** Download helper — triggers browser file download from blob */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
