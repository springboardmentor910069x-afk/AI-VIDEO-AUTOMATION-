import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAnalyticsDashboard, getApiErrorDetail, formatDate } from "@/api/client";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangleIcon,
  BoltIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  FilmIcon,
  RefreshIcon,
  SparklesIcon,
  TagIcon,
} from "@/components/Icons";
import type { AnalyticsDashboard, RecentActivity } from "@/api/types";

const ACTIVITY_LABELS: Record<RecentActivity["type"], string> = {
  transcript: "Transcript",
  summary: "Summary",
  key_moments: "Key moments",
  keywords: "Keywords",
};

export default function Analytics() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalyticsDashboard();
      setDashboard(data);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () =>
      dashboard
        ? [
            {
              label: "Total videos",
              value: dashboard.total_videos,
              icon: <FilmIcon className="h-5 w-5" />,
              accent: "indigo" as const,
              hint: `${dashboard.processing.ready} ready`,
            },
            {
              label: "Transcripts",
              value: dashboard.total_transcripts,
              icon: <DocumentTextIcon className="h-5 w-5" />,
              accent: "blue" as const,
              hint: `${dashboard.failed_transcripts} failed`,
            },
            {
              label: "Summaries",
              value: dashboard.total_summaries,
              icon: <SparklesIcon className="h-5 w-5" />,
              accent: "amber" as const,
              hint: `${dashboard.summary_types.detailed} detailed / ${dashboard.summary_types.short} short`,
            },
            {
              label: "Key moments",
              value: dashboard.total_key_moments,
              icon: <BoltIcon className="h-5 w-5" />,
              accent: "blue" as const,
              hint: `${dashboard.failed_key_moment_sets} failed sets`,
            },
            {
              label: "Keywords",
              value: dashboard.total_keywords,
              icon: <TagIcon className="h-5 w-5" />,
              accent: "emerald" as const,
              hint: `${dashboard.failed_keyword_sets} failed sets`,
            },
            {
              label: "Processed",
              value: dashboard.processed_videos,
              icon: <ClockIcon className="h-5 w-5" />,
              accent: "emerald" as const,
              hint: "videos with a transcript",
            },
          ]
        : [],
    [dashboard],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">Analytics</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Usage overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A summary of transcripts, summaries, key moments, and keywords across the workspace.
          </p>
        </div>

        <Button variant="outline" icon={<RefreshIcon className="h-4 w-4" />} onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {loading && !dashboard ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-8 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-8">
          <EmptyState
            icon={<AlertTriangleIcon className="h-6 w-6" />}
            title="Couldn't load analytics"
            description={error}
            action={
              <Button variant="outline" icon={<RefreshIcon className="h-4 w-4" />} onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : dashboard ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                accent={stat.accent}
                hint={stat.hint}
              />
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Processing pipeline
              </h2>
              <dl className="space-y-3 text-sm">
                {(
                  [
                    ["Pending", dashboard.processing.pending, "pending"],
                    ["Processing", dashboard.processing.processing, "processing"],
                    ["Ready", dashboard.processing.ready, "ready"],
                    ["Failed", dashboard.processing.failed, "failed"],
                  ] as const
                ).map(([label, value, status]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="flex items-center gap-2">
                      <Badge status={status} />
                      <span className="w-8 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {value}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recent videos
              </h2>
              {dashboard.recent_videos.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No videos uploaded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                        <th className="pb-2 pr-4 font-medium">Title</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dashboard.recent_videos.map((video) => (
                        <tr key={video.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="max-w-[18rem] truncate py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">
                            <Link
                              to={`/dashboard/videos/${video.id}`}
                              className="transition hover:text-brand-600 dark:hover:text-brand-400"
                            >
                              {video.title || "Untitled video"}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge status={video.status} />
                          </td>
                          <td className="whitespace-nowrap py-2.5 text-slate-500 dark:text-slate-400">
                            {formatDate(video.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ChartBarIcon className="h-4 w-4" />
              Recent activity
            </h2>
            {dashboard.recent_activity.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No AI activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.recent_activity.map((activity, index) => (
                  <li key={`${activity.video_id}-${activity.type}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Badge status={activity.status} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {ACTIVITY_LABELS[activity.type]}
                    </span>
                    <Link
                      to={`/dashboard/videos/${activity.video_id}`}
                      className="min-w-0 flex-1 truncate text-sm text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
                    >
                      {activity.video_title || "Untitled video"}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(activity.occurred_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}