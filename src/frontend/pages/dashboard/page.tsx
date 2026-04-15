'use client';

/**
 * Dashboard Page
 * 
 * Main landing after login. Shows:
 * - Quick action: New Document button
 * - Recent documents list (Phase 2+)
 * - Pending approvals count (Phase 5+)
 * 
 * TODO (Claude Code):
 * - Wire up TemplateSelector for quick-start
 * - Add recent documents table (Phase 2+)
 * - Add stats cards: documents generated today, pending review
 * - Bilingual: switch between Khmer/English
 */

import React from 'react';

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="font-khmer-header text-2xl mb-6">ផ្ទាំងគ្រប់គ្រង</h1>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <a
          href="/documents/new"
          className="bg-kgd-blue text-white rounded-lg p-6 hover:opacity-90 transition"
        >
          <h2 className="font-khmer text-lg font-bold">ឯកសារថ្មី</h2>
          <p className="text-sm opacity-80 mt-1">បង្កើតឯកសារថ្មីពីគំរូ</p>
        </a>
        
        <a
          href="/templates"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:border-kgd-blue transition"
        >
          <h2 className="font-khmer text-lg font-bold">គំរូឯកសារ</h2>
          <p className="text-sm text-gray-500 mt-1">មើល និងគ្រប់គ្រងគំរូ</p>
        </a>
        
        <a
          href="/knowledge"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:border-kgd-blue transition"
        >
          <h2 className="font-khmer text-lg font-bold">មូលដ្ឋានចំណេះដឹង</h2>
          <p className="text-sm text-gray-500 mt-1">គ្រប់គ្រងច្បាប់ និងគោលនយោបាយ</p>
        </a>
      </div>

      {/* Recent Documents - Phase 2+ */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-khmer text-lg font-bold mb-4">ឯកសារថ្មីៗ</h2>
        <p className="text-gray-400 text-sm">មិនទាន់មានឯកសារ — បង្កើតឯកសារដំបូងរបស់អ្នក!</p>
      </div>
    </div>
  );
}
