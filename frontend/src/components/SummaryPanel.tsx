import { useCallback, useEffect, useState } from "react";
import { generateSummary, getApiErrorDetail, getSummaries } from "@/api/client";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { SparklesIcon } from "@/components/Icons";
import type { Summary, Video } from "@/api/types";

interface SummaryPanelProps {
  video: Video;
  transcriptReady: boolean;
}

export default function SummaryPanel({ video, transcriptReady }: SummaryPanelProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await generateSummary(video.id, "short");
      setSummaries((prev) => [created, ...prev]);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Spinner className="h-5 w-5 text-brand-600" />
        Loading summaries…
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 py-8 text-sm text-slate-600">
        <Spinner className="h-5 w-5 text-brand-600" />
        Generating summary with BART… this can take up to a minute.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {summaries.map((summary) => (
        <div key={summary.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Badge status={summary.status} />
            {summary.model_name && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                {summary.model_name}
              </span>
            )}
          </div>
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {summary.summary || "Summary is empty."}
          </p>
        </div>
      ))}

      {!summaries.length && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm text-slate-500">
            {transcriptReady
              ? "No summary generated yet for this video."
              : "A transcript is required before generating a summary."}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!transcriptReady || generating}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            Generate short summary
          </button>
        </div>
      )}
    </div>
  );
}
