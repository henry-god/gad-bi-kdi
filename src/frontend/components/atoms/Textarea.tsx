import React from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  helper?: string;
  error?: string;
  showCount?: boolean;
}

const BASE =
  'w-full border rounded-lg px-3 py-2 font-ui text-sm outline-none transition-colors ' +
  'bg-kgd-elevated text-kgd-text placeholder:text-kgd-muted/60 ' +
  'focus:border-kgd-blue focus:ring-1 focus:ring-kgd-blue resize-y';

export const Textarea = React.forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { invalid, helper, error, showCount, className = '', id, maxLength, value, ...rest },
  ref,
) {
  const helperId = helper || error ? `${id ?? 'ta'}-helper` : undefined;
  const showError = Boolean(error);
  const count = typeof value === 'string' ? value.length : 0;
  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        id={id}
        aria-invalid={showError || invalid || undefined}
        aria-describedby={helperId}
        maxLength={maxLength}
        value={value}
        className={`${BASE} ${
          showError || invalid
            ? 'border-kgd-red focus:border-kgd-red focus:ring-kgd-red'
            : 'border-kgd-border'
        } ${className}`}
        {...rest}
      />
      <div className="flex items-start justify-between gap-2">
        {(helper || error) && (
          <p
            id={helperId}
            className={`text-xs font-ui ${showError ? 'text-kgd-red' : 'text-kgd-muted'}`}
          >
            {error || helper}
          </p>
        )}
        {showCount && maxLength && (
          <p className="text-xs text-kgd-muted ml-auto">
            {count}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
});

export default Textarea;
