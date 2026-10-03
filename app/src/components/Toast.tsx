import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

export type ToastOptions = {
  message: ReactNode;
  /** e.g. "Undo" */
  actionLabel?: string;
  onAction?(): void;
  /** Called when the toast goes away without its action being used (timeout or replaced). */
  onDismiss?(): void;
  duration?: number;
};

type ToastState = ToastOptions & { id: number };

const Ctx = createContext<(options: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const current = useRef<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const nextId = useRef(1);

  const finish = useCallback((usedAction: boolean) => {
    const t = current.current;
    if (!t) return;
    window.clearTimeout(timer.current);
    current.current = null;
    setToast(null);
    if (usedAction) t.onAction?.();
    else t.onDismiss?.();
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      finish(false);
      const t = { ...options, id: nextId.current++ };
      current.current = t;
      setToast(t);
      timer.current = window.setTimeout(() => finish(false), options.duration ?? (options.actionLabel ? 6000 : 3500));
    },
    [finish],
  );

  // Don't lose a pending purge if the page is closed while an undo toast is up:
  // soft-deleted records are also purged on the next start.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <span className="toast__message">{toast.message}</span>
            {toast.actionLabel && (
              <button type="button" className="toast__action" onClick={() => finish(true)}>
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
