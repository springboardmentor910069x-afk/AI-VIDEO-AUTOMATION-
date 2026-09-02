import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { XMarkIcon } from "@/components/Icons";

const SIZES: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: Size;
  footer?: ReactNode;
}

export default function Modal({
  title,
  onClose,
  children,
  size = "md",
  footer,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!focusables.length) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    const autofocusEl = panelRef.current?.querySelector<HTMLElement>("[autofocus]");
    if (autofocusEl) {
      autofocusEl.focus();
    } else {
      panelRef.current?.focus();
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [onKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92vh] w-full animate-fade-in-up flex-col rounded-t-2xl border border-slate-200 bg-white shadow-modal outline-none sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900",
          SIZES[size],
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 id={titleId} className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close dialog"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
