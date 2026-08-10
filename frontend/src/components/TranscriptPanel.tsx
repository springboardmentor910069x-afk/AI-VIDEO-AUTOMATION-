import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { generateTranscript, getApiErrorDetail, getTranscript } from "@/api/client";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { AlertTriangleIcon, DocumentTextIcon } from "@/components/Icons";
import type { Transcript, Video } from "@/api/types";

interface TranscriptPanelProps {
  video: Video;
}

export default function TranscriptPanel({ video }: TranscriptPanelProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);

  const videoProcessing =
    video.upload_status === "processing" || video.upload_status === "pending";

  const loadTranscript = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTranscript(video.id);
      setTranscript(data);
      setNotFound(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setTranscript(null);
        setNotFound(true);
      } else {
        setError(getApiErrorDetail(err));
      }
    } finally {
      setLoading(false);
    }
  }, [video.id]);

  useEffect(() => {
    attempts.current = 0;
    setTranscript(null);
    setNotFound(false);
    setError(null);
    loadTranscript();
  }, [loadTranscript]);

  const transcriptPending =
    transcript?.status === "pending" || transcript?.status === "processing";

  const shouldPoll = (notFound && videoProcessing) || transcriptPending;

  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > 60) {
        clearInterval(id);
        return;
      }
      try {
        const data = await getTranscript(video.id);
        setTranscript(data);
        setNotFound(false);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status !== 404) {
          clearInterval(id);
          setError(getApiErrorDetail(err));
        }
      }
    }, 4000);
    return () => clearInterval(id);
  }, [shouldPoll, video.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateTranscript(video.id);
      setTranscript(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Spinner className="h-5 w-5 text-brand-600" />
        Loading transcript…
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Spinner className="h-5 w-5 text-brand-600" />
        Generating transcript with Whisper… this can take a few minutes.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (transcript?.status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-red-700">
          <AlertTriangleIcon className="h-4 w-4" />
          Transcription failed
        </p>
        <button
          type="button"
          onClick={handleGenerate}
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          No transcript is available for this video yet.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Generate transcript
        </button>
      </div>
    );
  }

  if (notFound || transcriptPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Spinner className="h-5 w-5 text-brand-600" />
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
          <span className="text-xs text-slate-500">Language: {transcript.language}</span>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto break-words whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
        {transcript.transcript || "Transcript content is empty."}
      </div>
    </div>
  );
}
