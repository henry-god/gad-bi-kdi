import React from 'react';

type Tone = 'neutral' | 'blue' | 'amber' | 'sky' | 'emerald' | 'teal' | 'red' | 'gold';

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-700/60 text-slate-200',
  blue:    'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30',
  amber:   'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
  sky:     'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  teal:    'bg-teal-500/15 text-teal-200 ring-1 ring-kgd-gold/40',
  red:     'bg-red-500/15 text-red-300 ring-1 ring-red-400/30',
  gold:    'bg-kgd-gold/20 text-kgd-gold ring-1 ring-kgd-gold/40',
};

export function Badge({ tone = 'neutral', children, icon, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-ui ${TONES[tone]} ${className}`}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
