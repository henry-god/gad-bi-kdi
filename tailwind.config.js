/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/frontend/**/*.{ts,tsx}', './src/app/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // UI font (system chrome). Aliased so existing `font-khmer` classes
        // automatically pick up Kantumruy Pro without sweeping every file.
        'ui':           ['"Kantumruy Pro"', 'system-ui', 'sans-serif'],
        'khmer':        ['"Kantumruy Pro"', 'system-ui', 'sans-serif'],
        'khmer-header': ['"Kantumruy Pro"', 'system-ui', 'sans-serif'],
        'sans':         ['"Kantumruy Pro"', 'Inter', 'system-ui', 'sans-serif'],
        // Document fonts — only used inside .doc-surface / DOCX engine
        'doc-body':     ['"Khmer OS Siemreap"', 'Noto Sans Khmer', 'sans-serif'],
        'doc-header':   ['"Khmer OS Muollight"', '"Khmer OS Siemreap"', 'serif'],
      },
      colors: {
        'kgd': {
          // Dark palette (V5-M6 refresh)
          bg:          '#0b1220',
          surface:     '#111a2e',
          elevated:    '#182238',
          border:      '#1e2a44',
          muted:       '#94a3b8',
          text:        '#e2e8f0',
          // Brand accents (lifted for dark contrast)
          blue:        '#4c8bf5',
          'blue-deep': '#1a4b8c',
          gold:        '#e6b94a',
          red:         '#ef6857',
          // Alias kept so legacy `bg-kgd-cream` stays valid → maps to dark bg.
          cream:       '#0b1220',
        },
      },
      spacing: {
        'a4-w': '210mm',
        'a4-h': '297mm',
      },
      boxShadow: {
        'kgd-glow': '0 0 0 1px rgba(76,139,245,0.25), 0 8px 24px -6px rgba(76,139,245,0.35)',
      },
    },
  },
  plugins: [],
};
