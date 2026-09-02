import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteVideo,
  getApiErrorDetail,
  getSummaries,
  getTranscript,
  getVideos,
} from "@/api/client";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useDebounce } from "@/hooks/useDebounce";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

import { cn } from "@/lib/cn";

import UploadModal from "@/components/UploadModal";
import VideoCard from "@/components/VideoCard";

import {
  AlertTriangleIcon,
  BoltIcon,
  ClockIcon,
  DocumentTextIcon,
  FilmIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/Icons";

import type { Summary, Transcript, Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;

const ACTIVE_UPLOAD_STATUSES = new Set(["pending", "processing"]);

const FINAL_STATUSES = new Set(["ready", "failed"]);

type Filter = "all" | "processing" | "ready" | "failed";
type SortOrder = "newest" | "oldest";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const [transcripts, setTranscripts] = useState<Record<string, Transcript | null>>({});
  const [summaries, setSummaries] = useState<Record<string, Summary[]>>({});

  const mounted = useRef(true);
  const debouncedSearch = useDebounce(search, 250);

  const fetchVideos = useCallback(async (): Promise<Video[]> => {
    const data = await getVideos();
    if (mounted.current) setVideos(data);
    return data;
  }, []);

  const loadAIData = useCallback(async (videoId: string) => {
    try {
      const transcript = await getTranscript(videoId);
      if (mounted.current) {
        setTranscripts((previous) => ({ ...previous, [videoId]: transcript }));
      }
      if (transcript.status === "complete" && Boolean(transcript.transcript)) {
        try {
          const data = await getSummaries(videoId);
          if (mounted.current) {
            setSummaries((previous) => ({ ...previous, [videoId]: data }));
          }
        } catch {
          // Summaries are optional — a failure here should not block the dashboard.
        }
      }
    } catch {
      if (mounted.current) {
        setTranscripts((previous) => ({ ...previous, [videoId]: null }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getVideos();
        if (!cancelled) {
          setVideos(data);
          setError(null);
          const readyVideos = data.filter((video) => FINAL_STATUSES.has(video.upload_status));
          await Promise.all(readyVideos.map((video) => loadAIData(video.id)));
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorDetail(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [loadAIData]);

  const hasActive = videos.some((video) => ACTIVE_UPLOAD_STATUSES.has(video.upload_status));

  // A video needs AI data refreshed while it is still being processed in the
  // background (upload pending/processing) OR once it is ready but its
  // transcript is not yet complete (the backend marks a video "ready" before
  // the transcript row is finalized). Terminal videos are never re-fetched.
  const needsAIData = useCallback(
    (video: Video): boolean => {
      if (ACTIVE_UPLOAD_STATUSES.has(video.upload_status)) return true;
      if (video.upload_status !== "ready") return false;
      const t = transcripts[video.id];
      if (t === undefined) return true;
      if (t === null) return true;
      return t.status !== "complete" && t.status !== "failed";
    },
    [transcripts],
  );

  const shouldPollDashboard = videos.some(needsAIData);

  useEffect(() => {
    if (!shouldPollDashboard) return;

    const intervalId = window.setInterval(async () => {
      try {
        const updatedVideos = await fetchVideos();
        // Only refresh AI data for videos that are still in flight; do not
        // re-fetch transcripts of already-completed videos on every tick.
        const pending = updatedVideos.filter(needsAIData);
        await Promise.all(pending.map((video) => loadAIData(video.id)));
      } catch {
        // Ignore temporary polling errors; polling stops via shouldPollDashboard.
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [shouldPollDashboard, fetchVideos, needsAIData, loadAIData]);

  const handleUploaded = useCallback(
    (video: Video) => {
      setVideos((previous) => [video, ...previous.filter((item) => item.id !== video.id)]);
      toast.success(`"${video.title}" uploaded — processing started.`);
    },
    [toast],
  );

  const handleDeleteVideo = useCallback(
    async (video: Video) => {
      try {
        await deleteVideo(video.id);
        if (mounted.current) {
          setVideos((previous) => previous.filter((item) => item.id !== video.id));
          setTranscripts((previous) => {
            const next = { ...previous };
            delete next[video.id];
            return next;
          });
          setSummaries((previous) => {
            const next = { ...previous };
            delete next[video.id];
            return next;
          });
        }
        toast.success(`"${video.title}" deleted.`);
      } catch (err) {
        toast.error(getApiErrorDetail(err));
        throw err;
      }
    },
    [toast],
  );

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchVideos()
      .catch((err) => setError(getApiErrorDetail(err)))
      .finally(() => setLoading(false));
  }, [fetchVideos]);

  const handleViewDetails = useCallback(
    (currentVideo: Video) => navigate(`/dashboard/videos/${currentVideo.id}`),
    [navigate],
  );

  const stats = useMemo(() => {
    const processing = videos.filter((video) => ACTIVE_UPLOAD_STATUSES.has(video.upload_status)).length;
    const ready = videos.filter((video) => video.upload_status === "ready").length;
    const transcriptCount = Object.values(transcripts).filter(
      (transcript) => transcript?.status === "complete" && Boolean(transcript.transcript),
    ).length;
    const summaryCount = Object.values(summaries)
      .flat()
      .filter((summary) => summary.status === "complete" && Boolean(summary.summary)).length;

    return {
      total: videos.length,
      processing,
      ready,
      transcripts: transcriptCount,
      summaries: summaryCount,
    };
  }, [videos, transcripts, summaries]);

  const visibleVideos = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const result = videos.filter((video) => {
      if (filter !== "all" && video.upload_status !== filter) return false;
      if (!query) return true;
      return (
        video.title.toLowerCase().includes(query) ||
        video.original_filename.toLowerCase().includes(query)
      );
    });

    return result.sort((a, b) =>
      sort === "newest" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at),
    );
  }, [videos, filter, debouncedSearch, sort]);

  const displayName = user?.full_name || user?.username || "there";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {greeting()}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload a video and let AI transcribe and summarize it for you.
          </p>
        </div>

        <Button size="lg" icon={<UploadIcon className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
          Upload video
        </Button>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total videos" value={stats.total} icon={<FilmIcon className="h-5 w-5" />} accent="indigo" />
        <StatCard label="Processing" value={stats.processing} icon={<BoltIcon className="h-5 w-5" />} accent="blue" />
        <StatCard label="Ready" value={stats.ready} icon={<ClockIcon className="h-5 w-5" />} accent="emerald" />
        <StatCard
          label="Transcripts / Summaries"
          value={`${stats.transcripts} / ${stats.summaries}`}
          icon={<DocumentTextIcon className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => {
              const count =
                item.value === "all"
                  ? videos.length
                  : videos.filter((video) => video.upload_status === item.value).length;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    filter === item.value
                      ? "bg-brand-600 text-white shadow-sm dark:bg-brand-500"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "ml-1.5 text-xs",
                      filter === item.value ? "text-white/80" : "text-slate-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <SearchIcon className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search videos…"
                className="pl-9"
                aria-label="Search videos"
              />
            </div>

            <select
              id="sort-order"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error && videos.length === 0 ? (
            <EmptyState
              icon={<AlertTriangleIcon className="h-6 w-6" />}
              title="Couldn't load your videos"
              description={error}
              action={
                <Button variant="outline" onClick={retry}>
                  Try again
                </Button>
              }
            />
          ) : videos.length === 0 ? (
            <EmptyState
              icon={<FilmIcon className="h-6 w-6" />}
              title="No videos yet"
              description="Upload your first video and it will appear here once processing begins."
              action={
                <Button icon={<UploadIcon className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                  Upload a video
                </Button>
              }
            />
          ) : visibleVideos.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title="No matching videos"
              description="Try adjusting your search or filter."
            />
          ) : (
            <>
              {hasActive && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                >
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-brand-500" />
                  Processing videos…
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleVideos.map((video) => {
                  const transcript = transcripts[video.id] ?? null;
                  return (
                    <VideoCard
                      key={video.id}
                      video={video}
                      transcriptReady={
                        transcript?.status === "complete" && Boolean(transcript.transcript)
                      }
                      summaryCount={summaries[video.id]?.length ?? 0}
                      onViewDetails={handleViewDetails}
                      onDelete={handleDeleteVideo}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />}
    </div>
  );
}
