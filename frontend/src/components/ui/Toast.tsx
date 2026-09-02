/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { CheckCircleIcon, InfoIcon, AlertTriangleIcon, XMarkIcon } from "@/components/Icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircleIcon className="h-5 w-5" />,
  error: <AlertTriangleIcon className="h-5 w-5" />,
  info: <InfoIcon className="h-5 w-5" />,
};

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-brand-500",
};

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg shadow-slate-900/10",
              "dark:bg-slate-800",
              toast.type === "error"
                ? "border-red-200 dark:border-red-500/30"
                : toast.type === "success"
                  ? "border-emerald-200 dark:border-emerald-500/30"
                  : "border-slate-200 dark:border-slate-700",
            )}
          >
            <span className={cn("mt-0.5 shrink-0", ICON_COLORS[toast.type])}>
              {ICONS[toast.type]}
            </span>
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Dismiss notification"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
