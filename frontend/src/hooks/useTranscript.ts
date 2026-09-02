import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { generateTranscript, getApiErrorDetail, getTranscript } from "@/api/client";
import type { Transcript, Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 60;

const ACTIVE_UPLOAD_STATUSES = new Set(["pending", "processing"]);

interface UseTranscriptResult {
  transcript: Transcript | null;
  loading: boolean;
  generating: boolean;
  notFound: boolean;
  error: string | null;
  videoProcessing: boolean;
  pollingTimedOut: boolean;
  loadTranscript: () => Promise<void>;
  generateTranscriptNow: () => Promise<void>;
}

export function useTranscript(video: Video | null): UseTranscriptResult {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const attempts = useRef(0);

  const videoId = video?.id ?? null;
  const videoProcessing =
    video !== null && ACTIVE_UPLOAD_STATUSES.has(video.upload_status);
  const videoFailed = video?.upload_status === "failed";

  const loadTranscript = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTranscript(videoId);
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
  }, [videoId]);

  useEffect(() => {
    attempts.current = 0;
    setTranscript(null);
    setNotFound(false);
    setError(null);
    setPollingTimedOut(false);
    if (videoId) void loadTranscript();
  }, [videoId, loadTranscript]);

  const wasProcessing = useRef(videoProcessing);
  useEffect(() => {
    if (wasProcessing.current && !videoProcessing && videoId) {
      void loadTranscript();
    }
    wasProcessing.current = videoProcessing;
  }, [videoProcessing, videoId, loadTranscript]);

  const transcriptPending =
    transcript?.status === "pending" || transcript?.status === "processing";

  // Poll whenever the transcript is not found (background pipeline may still
  // be generating it after the video transitions to "ready") or when the
  // transcript is in a pending/processing state.  Stop if the video itself
  // has failed.
  const shouldPoll = !videoFailed && (notFound || transcriptPending);

  useEffect(() => {
    if (!shouldPoll || !videoId) return;
    const id = window.setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > MAX_ATTEMPTS) {
        window.clearInterval(id);
        setPollingTimedOut(true);
        return;
      }
      try {
        const data = await getTranscript(videoId);
        setTranscript(data);
        setNotFound(false);
        setPollingTimedOut(false);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status !== 404) {
          window.clearInterval(id);
          setError(getApiErrorDetail(err));
        }
      }
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [shouldPoll, videoId]);

  const generateTranscriptNow = useCallback(async () => {
    if (!videoId) return;
    setGenerating(true);
    setError(null);
    setPollingTimedOut(false);
    try {
      const data = await generateTranscript(videoId);
      setTranscript(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setGenerating(false);
    }
  }, [videoId]);

  return {
    transcript,
    loading,
    generating,
    notFound,
    error,
    videoProcessing,
    pollingTimedOut,
    loadTranscript,
    generateTranscriptNow,
  };
}
