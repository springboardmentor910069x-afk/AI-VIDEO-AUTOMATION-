import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { AlertTriangleIcon, DocumentTextIcon } from "@/components/Icons";
import type { Transcript } from "@/api/types";

interface TranscriptPanelProps {
  transcript: Transcript | null;
  loading: boolean;
  generating: boolean;
  notFound: boolean;
  error: string | null;
  videoProcessing: boolean;
  onGenerate: () => void;
}

export default function TranscriptPanel({
  transcript,
  loading,
  generating,
  notFound,
  error,
  videoProcessing,
  onGenerate,
}: TranscriptPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Loading transcript…
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Generating transcript with Whisper… this can take a few minutes.
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
      >
        {error}
      </div>
    );
  }

  if (transcript?.status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
        <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangleIcon className="h-4 w-4" />
          Transcription failed
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Retry transcription
        </button>
      </div>
    );
  }

  if (notFound && !videoProcessing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          No transcript is available for this video yet.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Generate transcript
        </button>
      </div>
    );
  }

  if (notFound || transcript?.status === "pending" || transcript?.status === "processing") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        <span>
          {videoProcessing
            ? "Video is still processing — transcript will appear here when ready."
            : "Transcript is still being generated…"}
        </span>
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Badge status={transcript.status} />
        {transcript.language && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Language: {transcript.language}
          </span>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto break-words whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
        {transcript.transcript || "Transcript content is empty."}
      </div>
    </div>
  );
}
