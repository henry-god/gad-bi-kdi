'use client';

/**
 * New Document Page — 4-Step Wizard
 * 
 * Step 1: Select Template (TemplateSelector)
 * Step 2: Fill Details (DocumentForm)
 * Step 3: Preview (DocumentPreview)
 * Step 4: Generate & Download
 * 
 * TODO (Claude Code - Phase 1 PRIORITY):
 * - Implement wizard state machine (step 1→2→3→4)
 * - Step 1: Fetch templates from GET /api/templates, display as cards
 * - Step 2: Dynamically render form fields from template.sections[]
 * - Step 3: Render HTML preview using template config + user data
 * - Step 4: POST /api/documents/generate, download DOCX
 * - Add back/next navigation
 * - Add Khmer date picker component
 * - Add signature block input (name + title)
 * - Persist form state across steps (useState or useReducer)
 */

import React, { useState } from 'react';

type WizardStep = 'select' | 'fill' | 'preview' | 'generate';

export default function NewDocumentPage() {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['select', 'fill', 'preview', 'generate'] as WizardStep[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${step === s ? 'bg-kgd-blue text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            {i < 3 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {step === 'select' && (
        <div>
          <h2 className="font-khmer-header text-xl mb-4">ជ្រើសរើសគំរូ</h2>
          {/* TODO: TemplateSelector component */}
          <p className="text-gray-400">Loading templates...</p>
        </div>
      )}

      {step === 'fill' && (
        <div>
          <h2 className="font-khmer-header text-xl mb-4">បំពេញព័ត៌មាន</h2>
          {/* TODO: DocumentForm component */}
          <p className="text-gray-400">Form fields will render here based on template.sections[]</p>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <h2 className="font-khmer-header text-xl mb-4">ពិនិត្យមើល</h2>
          {/* TODO: DocumentPreview component */}
          <div className="doc-preview">
            <p className="text-gray-400">Document preview will render here</p>
          </div>
        </div>
      )}

      {step === 'generate' && (
        <div className="text-center py-12">
          <h2 className="font-khmer-header text-xl mb-4">បង្កើតឯកសារ</h2>
          {/* TODO: Generate button + download link */}
          <button className="bg-kgd-blue text-white px-8 py-3 rounded-lg font-khmer text-lg">
            ទាញយកឯកសារ DOCX
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => {
            const steps: WizardStep[] = ['select', 'fill', 'preview', 'generate'];
            const idx = steps.indexOf(step);
            if (idx > 0) setStep(steps[idx - 1]);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg font-khmer"
          disabled={step === 'select'}
        >
          ← ថយក្រោយ
        </button>
        <button
          onClick={() => {
            const steps: WizardStep[] = ['select', 'fill', 'preview', 'generate'];
            const idx = steps.indexOf(step);
            if (idx < 3) setStep(steps[idx + 1]);
          }}
          className="px-4 py-2 bg-kgd-blue text-white rounded-lg font-khmer"
          disabled={step === 'generate'}
        >
          បន្ទាប់ →
        </button>
      </div>
    </div>
  );
}
