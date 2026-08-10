import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const ACCENTS: Record<string, string> = {
  indigo: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: keyof typeof ACCENTS;
  hint?: string;
}

export default function StatCard({ label, value, icon, accent = "indigo", hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              ACCENTS[accent],
            )}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
