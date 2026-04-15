// One-shot dark-mode class sweep — V5-M6 UI refresh.
// Skips files marked with `// dark-mode-sweep:skip`.
import fs from 'node:fs';
import path from 'node:path';

const FILES = [
  'src/app/page.tsx',
  'src/app/approvals/page.tsx',
  'src/app/audit/page.tsx',
  'src/app/documents/page.tsx',
  'src/app/documents/new/page.tsx',
  'src/app/documents/new/[templateId]/page.tsx',
  'src/app/documents/[id]/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/_components/AuthBoundary.tsx',
  'src/app/_components/CommandPalette.tsx',
  'src/app/_components/DocumentDrawer.tsx',
  'src/app/_components/RoleSwitcher.tsx',
];

// Order matters: longer / more-specific patterns first.
const REPLACEMENTS = [
  // Tonal backgrounds
  [/\bbg-kgd-cream\b/g, 'bg-kgd-bg'],
  [/\bbg-slate-50\b/g, 'bg-kgd-elevated'],
  [/\bbg-slate-100\b/g, 'bg-kgd-elevated/60'],
  [/\bbg-slate-200\b/g, 'bg-kgd-elevated'],
  // bg-white → keep ONLY when wrapping a true document surface (handled by .doc-preview).
  // Generic card backgrounds become kgd-surface.
  [/\bbg-white\/90\b/g, 'bg-kgd-bg/80'],
  [/\bbg-white\b/g, 'bg-kgd-surface'],
  // Text
  [/\btext-slate-900\b/g, 'text-kgd-text'],
  [/\btext-slate-800\b/g, 'text-kgd-text'],
  [/\btext-slate-700\b/g, 'text-kgd-text'],
  [/\btext-slate-600\b/g, 'text-kgd-muted'],
  [/\btext-slate-500\b/g, 'text-kgd-muted'],
  [/\btext-slate-400\b/g, 'text-kgd-muted/80'],
  [/\btext-slate-300\b/g, 'text-kgd-border'],
  // Borders / dividers
  [/\bborder-slate-200\b/g, 'border-kgd-border'],
  [/\bborder-slate-300\b/g, 'border-kgd-border'],
  [/\bborder-slate-100\b/g, 'border-kgd-border/50'],
  [/\bdivide-slate-100\b/g, 'divide-kgd-border/50'],
  [/\bdivide-slate-200\b/g, 'divide-kgd-border'],
  // Hover states
  [/\bhover:bg-slate-50\b/g, 'hover:bg-kgd-elevated'],
  [/\bhover:bg-slate-100\b/g, 'hover:bg-kgd-elevated/70'],
];

let totalChanged = 0;
for (const rel of FILES) {
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) { console.log(`skip (missing) ${rel}`); continue; }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('// dark-mode-sweep:skip')) { console.log(`skip (opt-out) ${rel}`); continue; }
  const before = src;
  for (const [re, to] of REPLACEMENTS) src = src.replace(re, to);
  if (src !== before) {
    fs.writeFileSync(file, src);
    totalChanged++;
    console.log(`updated ${rel}`);
  } else {
    console.log(`no-op ${rel}`);
  }
}
console.log(`\ndone — ${totalChanged} files updated.`);
