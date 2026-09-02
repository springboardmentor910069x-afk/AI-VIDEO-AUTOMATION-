import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteVideo,
  formatDate,
  formatDuration,
  formatFileSize,
  getApiErrorDetail,
  getVideo,
} from "@/api/client";
import { useTranscript } from "@/hooks/useTranscript";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/VideoPlayer";
import ProcessingStatus from "@/components/ProcessingStatus";
import TranscriptPanel from "@/components/TranscriptPanel";
import SummaryPanel from "@/components/SummaryPanel";
import KeyMomentsPanel from "@/components/KeyMomentsPanel";
import KeywordPanel from "@/components/KeywordPanel";
import { copyToClipboard } from "@/lib/clipboard";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  DocumentTextIcon,
  InfoIcon,
  RefreshIcon,
  SparklesIcon,
  TagIcon,
  TrashIcon,
} from "@/components/Icons";
import type { Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 90;

const ACTIVE_UPLOAD_STATUSES = new Set(["pending", "processing"]);

const TABS: TabItem[] = [
  { id: "overview", label: "Overview", icon: <InfoIcon className="h-4 w-4" /> },
  { id: "transcript", label: "Transcript", icon: <DocumentTextIcon className="h-4 w-4" /> },
  { id: "summary", label: "Summary", icon: <SparklesIcon className="h-4 w-4" /> },
  { id: "moments", label: "Key moments", icon: <BoltIcon className="h-4 w-4" /> },
  { id: "keywords", label: "Keywords", icon: <TagIcon className="h-4 w-4" /> },
];

export default function VideoDetails() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const playerRef = useRef<VideoPlayerHandle>(null);

  const handleSeek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds);
  }, []);

  const loadVideo = useCallback(async () => {
    if (!videoId) return;
    setError(null);
    const data = await getVideo(videoId);
    setVideo(data);
    return data;
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadVideo()
      .catch((err) => {
        if (!cancelled) setError(getApiErrorDetail(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVideo]);

  const active = video !== null && ACTIVE_UPLOAD_STATUSES.has(video.upload_status);

  // Poll video status while it is being processed in the background.
  const pollAttempts = useRef(0);
  useEffect(() => {
    if (!active || !videoId) return;
    pollAttempts.current = 0;
    const id = window.setInterval(async () => {
      pollAttempts.current += 1;
      if (pollAttempts.current > MAX_ATTEMPTS) {
        window.clearInterval(id);
        return;
      }
      try {
        const data = await getVideo(videoId);
        setVideo(data);
      } catch {
        // Keep polling on transient errors; the page shows last known state.
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, videoId]);

  const {
    transcript,
    loading: transcriptLoading,
    generating,
    notFound,
    error: transcriptError,
    videoProcessing,
    pollingTimedOut,
    generateTranscriptNow,
  } = useTranscript(video);

  const transcriptText = transcript?.transcript ?? null;
  const transcriptReady =
    transcript?.status === "complete" && Boolean(transcriptText);

  const handleCopyTranscript = async () => {
    if (!transcriptText) return;
    const ok = await copyToClipboard(transcriptText);
    if (ok) {
      setCopiedTranscript(true);
      window.setTimeout(() => setCopiedTranscript(false), 2000);
      toast.success("Transcript copied to clipboard.");
    } else {
      toast.error("Could not copy the transcript. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!videoId) return;
    setDeleting(true);
    try {
      await deleteVideo(videoId);
      toast.success(`"${video?.title ?? "Video"}" deleted.`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(getApiErrorDetail(err));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-6 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <Skeleton className="mt-6 aspect-video w-full rounded-xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          icon={<AlertTriangleIcon className="h-6 w-6" />}
          title="Couldn't load this video"
          description={error ?? "This video could not be found."}
          action={
            <div className="flex gap-3">
              <Button
                variant="outline"
                icon={<ArrowLeftIcon className="h-4 w-4" />}
                onClick={() => navigate("/dashboard")}
              >
                Back to videos
              </Button>
              <Button
                icon={<RefreshIcon className="h-4 w-4" />}
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  loadVideo()
                    .catch((err) => setError(getApiErrorDetail(err)))
                    .finally(() => setLoading(false));
                }}
              >
                Try again
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to videos
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge status={video.upload_status} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {video.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{video.original_filename}</span>
            <span>{formatDuration(video.duration)}</span>
            <span>{formatFileSize(video.file_size)}</span>
            <span>Uploaded {formatDate(video.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VideoPlayer ref={playerRef} video={video} />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Duration: {formatDuration(video.duration)}
          </p>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Status
            </h2>
            {active ? (
              <ProcessingStatus status={video.upload_status} />
            ) : video.upload_status === "ready" ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Video ready to view
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                <AlertTriangleIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Processing failed
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Details
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">Filename</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-900 dark:text-slate-100">
                  {video.original_filename}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">File size</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {formatFileSize(video.file_size)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">Duration</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {formatDuration(video.duration)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">Uploaded</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {formatDate(video.created_at)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              icon={
                copiedTranscript ? (
                  <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )
              }
              onClick={handleCopyTranscript}
              disabled={!transcriptText}
              title={transcriptText ? "Copy transcript" : "Transcript not available yet"}
            >
              {copiedTranscript ? "Copied" : "Copy transcript"}
            </Button>
            <Button
              variant="danger"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </section>
        </aside>
      </div>

      <div className="mt-8">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="md:inline-flex md:w-auto" />

        <div className="mt-5">
          {activeTab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  About this video
                </h2>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {video.description || "No description provided for this video."}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  AI processing
                </h2>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Upload</dt>
                    <dd>
                      <Badge status={video.upload_status} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Transcript</dt>
                    <dd>
                      <Badge status={transcript?.status ?? "pending"} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">Summary</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {transcriptReady
                        ? "Ready to generate"
                        : "Requires a complete transcript"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          )}

          {activeTab === "transcript" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <DocumentTextIcon className="h-4 w-4" />
                Transcript
              </h2>
              <TranscriptPanel
                transcript={transcript}
                loading={transcriptLoading}
                generating={generating}
                notFound={notFound}
                error={transcriptError}
                videoProcessing={videoProcessing}
                pollingTimedOut={pollingTimedOut}
                onGenerate={generateTranscriptNow}
              />
            </section>
          )}

          {activeTab === "summary" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <SparklesIcon className="h-4 w-4" />
                AI Summary
              </h2>
              <SummaryPanel video={video} transcriptReady={transcriptReady} />
            </section>
          )}

          {activeTab === "moments" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <BoltIcon className="h-4 w-4" />
                Key moments
              </h2>
              <KeyMomentsPanel
                video={video}
                transcriptReady={transcriptReady}
                onSeek={handleSeek}
              />
            </section>
          )}

          {activeTab === "keywords" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <TagIcon className="h-4 w-4" />
                Keywords
              </h2>
              <KeywordPanel video={video} transcriptReady={transcriptReady} />
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete video?"
        message="This will permanently delete the video, its transcript, and all AI summaries, keywords, and key moments. This action cannot be undone."
        confirmLabel="Delete video"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
