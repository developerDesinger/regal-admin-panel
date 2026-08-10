import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastContext, type ToastItem, type ToastTone, type ToastContextValue } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** Live regions announce async results — export ready, action saved, error (§21). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const toast = React.useCallback<ToastContextValue['toast']>((t) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...t, tone: t.tone ?? 'info', id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5000);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE_META: Record<ToastTone, { icon: typeof Info; className: string; iconClass: string }> = {
  success: { icon: CheckCircle2, className: 'border-success-500/30 bg-success-50', iconClass: 'text-success-500' },
  danger: { icon: XCircle, className: 'border-danger-500/30 bg-danger-50', iconClass: 'text-danger-500' },
  warning: { icon: AlertTriangle, className: 'border-warning-500/30 bg-warning-50', iconClass: 'text-warning-500' },
  info: { icon: Info, className: 'border-neutral-200 bg-neutral-0', iconClass: 'text-info-500' },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { t } = useTranslation();
  const meta = TONE_META[item.tone];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-e2 animate-slide-up',
        meta.className,
      )}
    >
      <Icon className={cn('mt-px h-4 w-4 shrink-0', meta.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-5 text-neutral-900">{item.title}</p>
        {item.description && (
          <p className="mt-1 text-caption text-neutral-500">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label={t('common.dismissNotification')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
