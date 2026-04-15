import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-ui rounded-lg transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kgd-blue focus-visible:ring-offset-2 focus-visible:ring-offset-kgd-bg ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-kgd-blue text-white hover:bg-kgd-blue/90 shadow-kgd-glow',
  secondary:
    'bg-kgd-elevated text-kgd-text border border-kgd-border hover:bg-kgd-border/60',
  ghost: 'text-kgd-muted hover:bg-white/5 hover:text-kgd-text',
  destructive: 'bg-kgd-red text-white hover:bg-kgd-red/90',
  gold: 'bg-kgd-gold text-kgd-bg font-bold hover:bg-kgd-gold/90',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

export default Button;
