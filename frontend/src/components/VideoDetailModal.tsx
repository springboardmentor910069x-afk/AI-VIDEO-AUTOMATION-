import { formatDate, formatDuration, formatFileSize, thumbnailUrl } from "@/api/client";
import { useTranscript } from "@/hooks/useTranscript";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import TranscriptPanel from "@/components/TranscriptPanel";
import SummaryPanel from "@/components/SummaryPanel";
import { DocumentTextIcon, FilmIcon, SparklesIcon } from "@/components/Icons";
import type { Video } from "@/api/types";

interface VideoDetailModalProps {
  video: Video;
  onClose: () => void;
}

export default function VideoDetailModal({ video, onClose }: VideoDetailModalProps) {
  const {
    transcript,
    loading,
    generating,
    notFound,
    error,
    videoProcessing,
    generateTranscriptNow,
  } = useTranscript(video);
  const thumb = thumbnailUrl(video);
  const transcriptReady = transcript?.status === "complete";

  return (
    <Modal title={video.title} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:w-56">
            {thumb ? (
              <img src={thumb} alt={video.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FilmIcon className="h-10 w-10 text-slate-600" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge status={video.upload_status} />
            </div>
            <p className="truncate text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-slate-100">File:</span>{" "}
              {video.original_filename}
            </p>
            {video.description && (
              <p className="line-clamp-2 text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-slate-100">Description:</span>{" "}
                {video.description}
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-500 dark:text-slate-400">
              <span>Duration: {formatDuration(video.duration)}</span>
              <span>Size: {formatFileSize(video.file_size)}</span>
              <span>Uploaded: {formatDate(video.created_at)}</span>
            </div>
          </div>
        </div>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <DocumentTextIcon className="h-4 w-4" />
            Transcript
          </h3>
          <TranscriptPanel
            transcript={transcript}
            loading={loading}
            generating={generating}
            notFound={notFound}
            error={error}
            videoProcessing={videoProcessing}
            onGenerate={generateTranscriptNow}
          />
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <SparklesIcon className="h-4 w-4" />
            AI Summary
          </h3>
          <SummaryPanel video={video} transcriptReady={transcriptReady} />
        </section>
      </div>
    </Modal>
  );
}
