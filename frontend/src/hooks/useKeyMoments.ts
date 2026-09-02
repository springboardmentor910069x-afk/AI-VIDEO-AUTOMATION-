import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  generateKeyMoments,
  getApiErrorDetail,
  getKeyMomentSet,
} from "@/api/client";
import type { KeyMoment, KeyMomentSet, Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 90;

const ACTIVE_KEY_MOMENT_STATUSES = new Set(["pending", "processing"]);

interface UseKeyMomentsResult {
  set: KeyMomentSet | null;
  loading: boolean;
  analyzing: boolean;
  notFound: boolean;
  error: string | null;
  moments: KeyMoment[];
  chapters: KeyMoment[];
  highlights: KeyMoment[];
  analyze: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useKeyMoments(
  video: Video | null,
  transcriptReady: boolean,
): UseKeyMomentsResult {
  const [keyMomentSet, setKeyMomentSet] = useState<KeyMomentSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);
  const triggeringRef = useRef(false);
  const autoTriggeredRef = useRef(false);

  const videoId = video?.id ?? null;

  const load = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getKeyMomentSet(videoId);
      setKeyMomentSet(data);
      setNotFound(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setKeyMomentSet(null);
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
    triggeringRef.current = false;
    autoTriggeredRef.current = false;
    setKeyMomentSet(null);
    setNotFound(false);
    setError(null);
    if (videoId) void load();
  }, [videoId, load]);

  const analyze = useCallback(async () => {
    if (!videoId || triggeringRef.current) return;
    triggeringRef.current = true;
    setError(null);
    try {
      const data = await generateKeyMoments(videoId);
      setKeyMomentSet(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorDetail(err));
      // Stop the auto-trigger loop; the user can retry from the panel.
      setNotFound(false);
    } finally {
      triggeringRef.current = false;
    }
  }, [videoId]);

  // Auto-start analysis once a complete transcript exists and no moments yet
  // (a 404 may also be produced by background polling, so only auto-trigger
  // once per video to avoid an endless re-analysis loop).
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (notFound && transcriptReady && videoId) {
      autoTriggeredRef.current = true;
      void analyze();
    }
  }, [notFound, transcriptReady, videoId, analyze]);

  const analyzing =
    keyMomentSet !== null && ACTIVE_KEY_MOMENT_STATUSES.has(keyMomentSet.status);

  // Poll while generation is in flight.
  useEffect(() => {
    if (!analyzing || !videoId) return;
    const id = window.setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > MAX_ATTEMPTS) {
        window.clearInterval(id);
        setError("Key moment generation is taking longer than expected. Please try again.");
        return;
      }
      try {
        const data = await getKeyMomentSet(videoId);
        setKeyMomentSet(data);
        setNotFound(false);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          setKeyMomentSet(null);
          setNotFound(true);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [analyzing, videoId]);

  const moments = keyMomentSet?.moments ?? [];
  const chapters = moments.filter((moment) => moment.type === "chapter");
  const highlights = moments.filter((moment) => moment.type !== "chapter");

  return {
    set: keyMomentSet,
    loading,
    analyzing,
    notFound,
    error,
    moments,
    chapters,
    highlights,
    analyze,
    reload: load,
  };
}
