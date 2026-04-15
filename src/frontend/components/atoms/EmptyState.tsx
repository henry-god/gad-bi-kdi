import React from 'react';

interface Props {
  icon?: React.ReactNode;
  title: string;
  titleKm?: string;
  body?: string;
  bodyKm?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, titleKm, body, bodyKm, description, action, className = '' }: Props) {
  const desc = body ?? description;
  return (
    <div
      className={`bg-kgd-surface border border-kgd-border rounded-2xl p-10 text-center ${className}`}
    >
      {icon && <div className="text-4xl mb-3" aria-hidden>{icon}</div>}
      {titleKm && <h3 className="font-ui text-lg font-semibold text-kgd-text">{titleKm}</h3>}
      <p className={`text-sm text-kgd-muted ${titleKm ? 'mt-1' : 'font-semibold text-kgd-text'}`}>
        {title}
      </p>
      {(desc || bodyKm) && (
        <div className="mt-2 text-sm text-kgd-muted space-y-0.5">
          {bodyKm && <p>{bodyKm}</p>}
          {desc && <p className="text-xs text-kgd-muted/80">{desc}</p>}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
