import { useCallback, useEffect, useState } from "react";
import {
  deleteSummary,
  formatDate,
  generateSummary,
  getApiErrorDetail,
  getSummaries,
} from "@/api/client";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { copyToClipboard } from "@/lib/clipboard";
import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  SparklesIcon,
  TrashIcon,
} from "@/components/Icons";
import type { Summary, SummaryType, Video } from "@/api/types";

const SUMMARY_TYPE_LABELS: Record<SummaryType, string> = {
  short: "Short",
  detailed: "Detailed",
};

interface SummaryPanelProps {
  video: Video;
  transcriptReady: boolean;
}

export default function SummaryPanel({ video, transcriptReady }: SummaryPanelProps) {
  const toast = useToast();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summaryType, setSummaryType] = useState<SummaryType>("short");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSummaries(video.id);
      setSummaries(data);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setLoading(false);
    }
  }, [video.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await generateSummary(video.id, summaryType);
      setSummaries((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      toast.success("Summary generated.");
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (summary: Summary) => {
    if (!summary.summary) return;
    const ok = await copyToClipboard(summary.summary);
    if (ok) {
      setCopiedId(summary.id);
      window.setTimeout(() => setCopiedId(null), 2000);
      toast.success("Summary copied to clipboard.");
    } else {
      toast.error("Could not copy the summary. Please try again.");
    }
  };

  const handleDelete = async (summary: Summary) => {
    setDeletingId(summary.id);
    setError(null);
    try {
      await deleteSummary(summary.id);
      setSummaries((prev) => prev.filter((s) => s.id !== summary.id));
      toast.success("Summary deleted.");
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Loading summaries…
      </div>
    );
  }

  if (!transcriptReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
        <SparklesIcon className="h-6 w-6 text-slate-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A complete transcript is required before generating an AI summary.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={summaryType}
          onChange={(event) => setSummaryType(event.target.value as SummaryType)}
          disabled={generating}
          aria-label="Summary type"
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="short">Short summary</option>
          <option value="detailed">Detailed summary</option>
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {generating ? <Spinner className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate summary"}
        </button>
      </div>

      {generating && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <Spinner className="h-4 w-4" />
          Generating summary with AI… this can take up to a minute.
        </div>
      )}

      {summaries.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No summary generated yet for this video.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <article
              key={summary.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={summary.status} />
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {SUMMARY_TYPE_LABELS[summary.summary_type] ?? summary.summary_type}
                  </span>
                  {summary.model_name && (
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      {summary.model_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(summary)}
                    disabled={!summary.summary}
                    className="inline-flex items-center gap-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Copy summary"
                  >
                    {copiedId === summary.id ? (
                      <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(summary)}
                    disabled={deletingId === summary.id}
                    className="inline-flex items-center gap-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    aria-label="Delete summary"
                  >
                    {deletingId === summary.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {summary.summary || "Summary is empty."}
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Created {formatDate(summary.created_at)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
