import React from 'react';

export function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex items-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 shadow-sm ${className}`}
    >
      {children}
    </kbd>
  );
}

export default Kbd;
