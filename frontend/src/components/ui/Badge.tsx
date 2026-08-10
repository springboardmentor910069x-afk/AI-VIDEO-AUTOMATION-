import type { UploadStatus, TranscriptStatus, SummaryStatus } from "@/api/types";
import { cn } from "@/lib/cn";

type AnyStatus = UploadStatus | TranscriptStatus | SummaryStatus;

const STYLES: Record<AnyStatus, string> = {
  pending:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
  processing:
    "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
  ready:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  complete:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  failed:
    "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20",
};

const LABELS: Record<AnyStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  complete: "Complete",
  failed: "Failed",
};

interface BadgeProps {
  status: AnyStatus;
  className?: string;
}

export default function Badge({ status, className }: BadgeProps) {
  const isProcessing = status === "processing";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[status] ?? STYLES.pending,
        className,
      )}
    >
      {isProcessing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {LABELS[status] ?? status}
    </span>
  );
}
