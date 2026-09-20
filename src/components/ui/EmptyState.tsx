import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-white/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <h3 className="text-base font-medium text-ink-600">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
