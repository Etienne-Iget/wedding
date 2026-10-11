import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-lift animate-scale-in flex flex-col`}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between border-b border-ink-100 px-6 py-4">
            <div>
              {title && <h2 className="text-lg font-semibold text-ink-800">{title}</h2>}
              {subtitle && <p className="text-sm text-ink-400 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4 bg-ink-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
