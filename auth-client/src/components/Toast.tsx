import { useEffect, useState, createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  msg: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (msg: string, variant?: ToastVariant) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Single toast item ────────────────────────────────────────────────────────

const DURATION = 3500;

const VARIANT_STYLES: Record<ToastVariant, { wrap: string; icon: ReactNode; bar: string }> = {
  success: {
    wrap: 'border-green-500/30 bg-slate-900',
    icon: <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />,
    bar: 'bg-green-500',
  },
  error: {
    wrap: 'border-red-500/30 bg-slate-900',
    icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
    bar: 'bg-red-500',
  },
  info: {
    wrap: 'border-slate-600 bg-slate-900',
    icon: <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />,
    bar: 'bg-slate-500',
  },
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));

    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleDismiss();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  const s = VARIANT_STYLES[item.variant];

  return (
    <div
      className={`relative w-80 overflow-hidden rounded-xl border shadow-lg shadow-black/40 transition-all duration-200
        ${s.wrap}
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {s.icon}
        <p className="flex-1 text-sm text-slate-200 leading-snug">{item.msg}</p>
        <button
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 transition-none ${s.bar}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((msg: string, variant: ToastVariant = 'success') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, msg, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Portal-like fixed container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItemView item={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
