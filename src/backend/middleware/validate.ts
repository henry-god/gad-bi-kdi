/**
 * Request Validation Middleware
 * Uses Zod schemas to validate API request bodies.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

// === Schemas ===

export const generateDocumentSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.string()),
  outputFormat: z.enum(['docx', 'pdf']).default('docx'),
  knowledgeCategories: z.array(z.string()).optional(),
  useAI: z.boolean().default(false),
});

export const matchKnowledgeSchema = z.object({
  content: z.string().min(1),
  documentType: z.string().min(1),
});
