import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  helper?: string;
  error?: string;
}

const BASE =
  'w-full border rounded-lg px-3 py-2 font-ui text-sm outline-none transition-colors ' +
  'bg-kgd-elevated text-kgd-text placeholder:text-kgd-muted/60 ' +
  'focus:border-kgd-blue focus:ring-1 focus:ring-kgd-blue';

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { invalid, helper, error, className = '', id, ...rest },
  ref,
) {
  const helperId = helper || error ? `${id ?? 'input'}-helper` : undefined;
  const showError = Boolean(error);
  return (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        id={id}
        aria-invalid={showError || invalid || undefined}
        aria-describedby={helperId}
        className={`${BASE} ${
          showError || invalid
            ? 'border-kgd-red focus:border-kgd-red focus:ring-kgd-red'
            : 'border-kgd-border'
        } ${className}`}
        {...rest}
      />
      {(helper || error) && (
        <p
          id={helperId}
          className={`text-xs font-ui ${showError ? 'text-kgd-red' : 'text-kgd-muted'}`}
        >
          {error || helper}
        </p>
      )}
    </div>
  );
});

export default Input;
