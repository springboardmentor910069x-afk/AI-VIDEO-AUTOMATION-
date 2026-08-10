import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorDetail, getTranscript, getVideos } from "@/api/client";
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
import VideoDetailModal from "@/components/VideoDetailModal";
import {
  AlertTriangleIcon,
  BoltIcon,
  ClockIcon,
  DocumentTextIcon,
  FilmIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/Icons";
import type { Video } from "@/api/types";

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

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<Video | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const [transcriptReady, setTranscriptReady] = useState<Record<string, boolean>>({});
  const checkedTranscripts = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  const debouncedSearch = useDebounce(search, 250);

  const fetchVideos = useCallback(async (): Promise<Video[]> => {
    const data = await getVideos();
    if (mounted.current) setVideos(data);
    return data;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await getVideos();
        if (!cancelled) {
          setVideos(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorDetail(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const hasActive = videos.some((v) => ACTIVE_UPLOAD_STATUSES.has(v.upload_status));

  useEffect(() => {
    if (!hasActive) return;
    const id = window.setInterval(() => {
      fetchVideos().catch(() => {
        // transient polling errors are ignored; keep last known state
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [hasActive, fetchVideos]);

  useEffect(() => {
    const readyVideos = videos.filter(
      (v) => FINAL_STATUSES.has(v.upload_status) && !checkedTranscripts.current.has(v.id),
    );
    if (!readyVideos.length) return;

    readyVideos.forEach(async (video) => {
      checkedTranscripts.current.add(video.id);
      try {
        const transcript = await getTranscript(video.id);
        if (mounted.current && transcript.status === "complete") {
          setTranscriptReady((prev) => ({ ...prev, [video.id]: true }));
        }
      } catch {
        // transcript not available yet — leave marked as not ready
      }
    });
  }, [videos]);

  const handleUploaded = useCallback(
    (video: Video) => {
      setVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)]);
      toast.success(`"${video.title}" uploaded — processing started.`);
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

  const stats = useMemo(() => {
    const processing = videos.filter((v) => ACTIVE_UPLOAD_STATUSES.has(v.upload_status)).length;
    const ready = videos.filter((v) => v.upload_status === "ready").length;
    const transcripts = videos.filter((v) => transcriptReady[v.id]).length;
    return { total: videos.length, processing, ready, transcripts };
  }, [videos, transcriptReady]);

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
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
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
          label="Transcripts"
          value={stats.transcripts}
          icon={<DocumentTextIcon className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const count = f.value === "all" ? videos.length : videos.filter((v) => v.upload_status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    filter === f.value
                      ? "bg-brand-600 text-white shadow-sm dark:bg-brand-500"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  {f.label}
                  <span className={cn("ml-1.5 text-xs", filter === f.value ? "text-white/80" : "text-slate-400")}>
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
            <label className="sr-only" htmlFor="sort-order">
              Sort order
            </label>
            <select
              id="sort-order"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
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
                  Polling for updates while videos process…
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    transcriptReady={transcriptReady[video.id] ?? false}
                    onViewDetails={(v) => setSelected(v)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />}
      {selected && <VideoDetailModal video={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
