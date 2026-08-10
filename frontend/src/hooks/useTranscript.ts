import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { generateTranscript, getApiErrorDetail, getTranscript } from "@/api/client";
import type { Transcript, Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 60;

interface UseTranscriptResult {
  transcript: Transcript | null;
  loading: boolean;
  generating: boolean;
  notFound: boolean;
  error: string | null;
  videoProcessing: boolean;
  loadTranscript: () => Promise<void>;
  generateTranscriptNow: () => Promise<void>;
}

export function useTranscript(video: Video): UseTranscriptResult {
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
    void loadTranscript();
  }, [loadTranscript]);

  const transcriptPending =
    transcript?.status === "pending" || transcript?.status === "processing";

  const shouldPoll = (notFound && videoProcessing) || transcriptPending;

  useEffect(() => {
    if (!shouldPoll) return;
    const id = window.setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > MAX_ATTEMPTS) {
        window.clearInterval(id);
        return;
      }
      try {
        const data = await getTranscript(video.id);
        setTranscript(data);
        setNotFound(false);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status !== 404) {
          window.clearInterval(id);
          setError(getApiErrorDetail(err));
        }
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [shouldPoll, video.id]);

  const generateTranscriptNow = useCallback(async () => {
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
  }, [video.id]);

  return {
    transcript,
    loading,
    generating,
    notFound,
    error,
    videoProcessing,
    loadTranscript,
    generateTranscriptNow,
  };
}
