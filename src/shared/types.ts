/**
 * Shared Types — used by both frontend and backend
 */

// === Template Types ===
export interface TemplateConfig {
  id: string;
  name: string;
  nameKm: string;
  category: TemplateCategory;
  page: PageConfig;
  fonts: FontConfig;
  letterhead: LetterheadConfig;
  footer: FooterConfig;
  sections: SectionConfig[];
  placeholders: Record<string, string>;
}

export type TemplateCategory =
  | 'letter' | 'memo' | 'minutes' | 'report'
  | 'decree' | 'notification' | 'request'
  | 'certificate' | 'contract' | 'other';

export interface PageConfig {
  size: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; bottom: number; left: number; right: number };
}

export interface FontConfig {
  title: { family: string; size: number; bold: boolean };
  body: { family: string; size: number; lineSpacing: number };
  header: { family: string; size: number };
  footer: { family: string; size: number };
}

export interface LetterheadConfig {
  enabled: boolean;
  logoPosition: 'left' | 'center' | 'right';
  ministryName: boolean;
  departmentName: boolean;
  emblem: boolean;
}

export interface FooterConfig {
  enabled: boolean;
  pageNumber: boolean;
  address: boolean;
}

export interface SectionConfig {
  id: string;
  label: string;
  labelKm: string;
  type: 'text' | 'richtext' | 'date' | 'select' | 'table' | 'signature';
  required: boolean;
  order: number;
}

// === Document Types ===
export interface DocumentData {
  [key: string]: string | string[] | Record<string, string>[];
}

export interface GenerateRequest {
  templateId: string;
  data: DocumentData;
  outputFormat?: 'docx' | 'pdf';
  knowledgeCategories?: string[];
  useAI?: boolean;
}

export interface GenerateResponse {
  success: boolean;
  data?: {
    documentId: string;
    downloadUrl: string;
    previewUrl?: string;
  };
  error?: string;
}

// === Knowledge Types ===
export interface DocumentRules {
  templateId: string;
  documentType: string;
  documentTypeKm: string;
  mustWrite: string[];
  mustNotWrite: string[];
  toneGuidelines: ToneGuidelines;
  structureRules: Record<string, any>;
  complianceChecks: string[];
}

export interface ToneGuidelines {
  register: 'formal' | 'semi-formal' | 'informal';
  honorifics: string;
  voice: string;
  politeness: string;
}

// === User Types ===
export type UserRole = 'admin' | 'officer' | 'reviewer' | 'signer';

export interface User {
  uid: string;
  email: string;
  name: string;
  nameKm?: string;
  role: UserRole;
  department?: string;
  titlePosition?: string;
}

// === API Types ===
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// === Workflow Types (Phase 5+) ===
export type DocumentStatus =
  | 'draft' | 'pending_review' | 'reviewed'
  | 'approved' | 'signed' | 'archived';

export type ApprovalAction =
  | 'submit' | 'review' | 'approve' | 'reject' | 'sign';
