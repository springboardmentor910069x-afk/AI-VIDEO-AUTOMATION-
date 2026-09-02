import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";
import type { UploadStatus } from "@/api/types";

const HINTS: Record<UploadStatus, string> = {
  pending: "Waiting to start processing…",
  processing: "Processing video…",
  ready: "Video ready",
  failed: "Video processing failed",
};

interface ProcessingStatusProps {
  status: UploadStatus;
  className?: string;
}

export default function ProcessingStatus({ status, className }: ProcessingStatusProps) {
  const hint = HINTS[status];
  const active = status === "pending" || status === "processing";

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        status === "failed"
          ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
          : status === "ready"
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {active ? (
        <Spinner className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
      ) : status === "ready" ? (
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : status === "failed" ? (
        <AlertTriangleIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      ) : (
        <ClockIcon className="h-5 w-5 shrink-0 text-slate-400" />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            status === "failed"
              ? "text-red-800 dark:text-red-300"
              : status === "ready"
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-slate-900 dark:text-slate-100",
          )}
        >
          {hint}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This may take a moment depending on the video length.
        </p>
      </div>

      <Badge status={status} className="shrink-0" />
    </div>
  );
}
