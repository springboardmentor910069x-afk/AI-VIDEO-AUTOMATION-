import { memo, useState } from "react";
import type { Video } from "@/api/types";
import { formatDate, formatDuration, formatFileSize } from "@/api/client";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import {
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  FilmIcon,
  SparklesIcon,
  TrashIcon,
} from "@/components/Icons";

interface VideoCardProps {
  video: Video;
  transcriptReady: boolean;
  summaryCount: number;
  onViewDetails: (video: Video) => void;
  onDelete: (video: Video) => Promise<void>;
}

export default memo(function VideoCard({
  video,
  transcriptReady,
  summaryCount,
  onViewDetails,
  onDelete,
}: VideoCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const thumb = useMediaUrl(video.thumbnail_path ? video.id : null, "thumbnail");
  const processing = video.upload_status === "processing" || video.upload_status === "pending";

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(video);
      setDeleteOpen(false);
    } catch {
      // Keep the dialog open so the user can retry or cancel.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900 dark:bg-slate-950">
        {thumb ? (
          <button
            type="button"
            onClick={() => onViewDetails(video)}
            className="block h-full w-full text-left"
            aria-label={`View details for ${video.title}`}
          >
            <img
              src={thumb}
              alt={video.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onViewDetails(video)}
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950"
            aria-label={`View details for ${video.title}`}
          >
            <FilmIcon className="h-12 w-12 text-slate-600" />
          </button>
        )}

        {processing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/50">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-800 shadow">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-brand-600" />
              Processing…
            </span>
          </div>
        )}

        <div className="absolute bottom-2 right-2">
          <Badge status={video.upload_status} />
        </div>

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/60 text-slate-200 opacity-100 transition hover:bg-red-600 hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Delete ${video.title}`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <button type="button" onClick={() => onViewDetails(video)} className="text-left">
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 transition group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
            {video.title}
          </h3>
        </button>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {video.original_filename}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex min-w-0 items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{formatDuration(video.duration)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <FilmIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{formatFileSize(video.file_size)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{formatDate(video.created_at)}</span>
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {transcriptReady ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <DocumentTextIcon className="h-3 w-3" />
              Transcript ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <DocumentTextIcon className="h-3 w-3" />
              No transcript
            </span>
          )}
          {summaryCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <SparklesIcon className="h-3 w-3" />
              {summaryCount} {summaryCount === 1 ? "summary" : "summaries"}
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onViewDetails(video)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            {transcriptReady ? "View transcript" : "View details"}
          </button>
          <button
            type="button"
            onClick={() => onViewDetails(video)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            AI summary
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete video?"
        message={`"${video.title}" and its transcript and AI summaries will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete video"
        danger
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
});
