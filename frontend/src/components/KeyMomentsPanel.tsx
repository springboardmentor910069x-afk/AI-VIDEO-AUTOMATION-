import { useKeyMoments } from "@/hooks/useKeyMoments";
import { formatDuration } from "@/api/client";
import { Button } from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { KeyMoment, KeyMomentType, Video } from "@/api/types";
import {
  AlertTriangleIcon,
  BoltIcon,
  ClockIcon,
  PlayIcon,
  RefreshIcon,
} from "@/components/Icons";

const TYPE_META: Record<KeyMomentType, { label: string; className: string }> = {
  highlight: {
    label: "Highlight",
    className:
      "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  },
  chapter: {
    label: "Chapter",
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  important: {
    label: "Important",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
};

interface KeyMomentsPanelProps {
  video: Video;
  transcriptReady: boolean;
  onSeek: (seconds: number) => void;
}

export default function KeyMomentsPanel({
  video,
  transcriptReady,
  onSeek,
}: KeyMomentsPanelProps) {
  const {
    loading,
    analyzing,
    notFound,
    error,
    set: keyMomentSet,
    moments,
    chapters,
    highlights,
    analyze,
  } = useKeyMoments(video, transcriptReady);

  if (loading || analyzing) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Analyzing video…
      </div>
    );
  }

  const failed = keyMomentSet?.status === "failed";
  const failureMessage = keyMomentSet?.error ?? error;

  if (error || failed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
        <p className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{failureMessage ?? "Could not analyze the video for key moments."}</span>
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          icon={<RefreshIcon className="h-4 w-4" />}
          onClick={() => void analyze()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (notFound || (keyMomentSet && moments.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
        <BoltIcon className="h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No key moments found for this video.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {transcriptReady
            ? "The transcript didn't yield any notable moments."
            : "Key moments are generated from the video's transcript once it's available."}
        </p>
      </div>
    );
  }

  if (moments.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {chapters.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Chapters
          </h3>
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => onSeek(chapter.start_time)}
                  className="group flex w-full items-center gap-3 bg-white px-4 py-2.5 text-left transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <ClockIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                    {formatDuration(chapter.start_time)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-100">
                    {chapter.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {highlights.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Key moments
          </h3>
          <div className="space-y-3">
            {highlights.map((moment) => (
              <MomentCard
                key={moment.id}
                moment={moment}
                onSeek={onSeek}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MomentCard({
  moment,
  onSeek,
}: {
  moment: KeyMoment;
  onSeek: (seconds: number) => void;
}) {
  const meta = TYPE_META[moment.type] ?? TYPE_META.important;

  return (
    <article
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-card",
        "dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <BoltIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-mono text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
              {formatDuration(moment.start_time)}
            </p>
            <span
              className={cn(
                "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                meta.className,
              )}
            >
              {meta.label}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<PlayIcon className="h-3.5 w-3.5" />}
          onClick={() => onSeek(moment.start_time)}
        >
          Jump to moment
        </Button>
      </div>

      <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {moment.title}
      </h4>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {moment.description}
      </p>
    </article>
  );
}
