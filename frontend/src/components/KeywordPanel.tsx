import { useKeywords } from "@/hooks/useKeywords";
import { Button } from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { Keyword, Video } from "@/api/types";
import {
  AlertTriangleIcon,
  RefreshIcon,
  TagIcon,
} from "@/components/Icons";

interface KeywordPanelProps {
  video: Video;
  transcriptReady: boolean;
}

export default function KeywordPanel({ video, transcriptReady }: KeywordPanelProps) {
  const {
    loading,
    generating,
    notFound,
    error,
    set: keywordSet,
    keywords,
    generate,
  } = useKeywords(video, transcriptReady);

  if (loading || generating) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Extracting keywords…
      </div>
    );
  }

  const failed = keywordSet?.status === "failed";
  const failureMessage = keywordSet?.error ?? error;

  if (error || failed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
        <p className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{failureMessage ?? "Could not extract keywords for this video."}</span>
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          icon={<RefreshIcon className="h-4 w-4" />}
          onClick={() => void generate()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (notFound || (keywordSet && keywords.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
        <TagIcon className="h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No keywords found for this video.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {transcriptReady
            ? "The transcript didn't yield any notable keywords."
            : "Keywords are extracted from the video's transcript once it's available."}
        </p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return null;
  }

  const maxScore = keywords[0]?.score ?? 1;

  return (
    <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {keywords.map((keyword) => (
        <KeywordRow key={keyword.id} keyword={keyword} maxScore={maxScore} />
      ))}
    </ol>
  );
}

function KeywordRow({ keyword, maxScore }: { keyword: Keyword; maxScore: number }) {
  const barWidth = Math.max(4, Math.round((keyword.score / maxScore) * 100));

  return (
    <li className="flex items-center gap-3 bg-white px-4 py-2.5 transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
      <span className="w-6 shrink-0 text-center font-mono text-xs font-semibold tabular-nums text-slate-400">
        {keyword.position + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {keyword.keyword}
      </span>
      <span className="hidden w-28 shrink-0 sm:block">
        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className="block h-full rounded-full bg-brand-500 dark:bg-brand-400"
            style={{ width: `${barWidth}%` }}
          />
        </span>
      </span>
      <span
        className={cn(
          "w-12 shrink-0 text-right font-mono text-xs font-semibold tabular-nums",
        )}
      >
        {keyword.score.toFixed(2)}
      </span>
    </li>
  );
}