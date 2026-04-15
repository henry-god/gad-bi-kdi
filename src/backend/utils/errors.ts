/**
 * Application Error Types
 * Use these throughout the app for consistent error handling.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public messageKm: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, messageKm: string, public fields?: Record<string, string>) {
    super(message, messageKm, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class TemplateNotFoundError extends AppError {
  constructor(templateId: string) {
    super(
      `Template not found: ${templateId}`,
      `រកមិនឃើញគំរូឯកសារ: ${templateId}`,
      404,
      'TEMPLATE_NOT_FOUND'
    );
    this.name = 'TemplateNotFoundError';
  }
}

export class MissingFieldError extends AppError {
  constructor(fieldId: string, fieldLabel: string, fieldLabelKm: string) {
    super(
      `Required field missing: ${fieldLabel}`,
      `ខ្វះព័ត៌មានចាំបាច់: ${fieldLabelKm}`,
      400,
      'MISSING_FIELD'
    );
    this.name = 'MissingFieldError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', messageKm = 'គ្មានសិទ្ធិចូលប្រើ') {
    super(message, messageKm, 401, 'UNAUTHORIZED');
    this.name = 'AuthError';
  }
}

export class GenerationError extends AppError {
  constructor(message: string) {
    super(message, 'កំហុសក្នុងការបង្កើតឯកសារ', 500, 'GENERATION_ERROR');
    this.name = 'GenerationError';
  }
}
