import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  generateKeywords,
  getApiErrorDetail,
  getKeywordSet,
} from "@/api/client";
import type { Keyword, KeywordSet, Video } from "@/api/types";

const POLL_INTERVAL_MS = 4000;
const MAX_ATTEMPTS = 60;

const ACTIVE_KEYWORD_STATUSES = new Set(["pending", "processing"]);

interface UseKeywordsResult {
  set: KeywordSet | null;
  loading: boolean;
  generating: boolean;
  notFound: boolean;
  error: string | null;
  keywords: Keyword[];
  generate: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useKeywords(
  video: Video | null,
  transcriptReady: boolean,
): UseKeywordsResult {
  const [keywordSet, setKeywordSet] = useState<KeywordSet | null>(null);
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
      const data = await getKeywordSet(videoId);
      setKeywordSet(data);
      setNotFound(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setKeywordSet(null);
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
    setKeywordSet(null);
    setNotFound(false);
    setError(null);
    if (videoId) void load();
  }, [videoId, load]);

  const generate = useCallback(async () => {
    if (!videoId || triggeringRef.current) return;
    triggeringRef.current = true;
    setError(null);
    try {
      const data = await generateKeywords(videoId);
      setKeywordSet(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorDetail(err));
      setNotFound(false);
    } finally {
      triggeringRef.current = false;
    }
  }, [videoId]);

  // Auto-start extraction once a complete transcript exists and no keywords yet
  // (a 404 may also be produced by background polling, so only auto-trigger
  // once per video to avoid an endless re-analysis loop).
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (notFound && transcriptReady && videoId) {
      autoTriggeredRef.current = true;
      void generate();
    }
  }, [notFound, transcriptReady, videoId, generate]);

  const generating =
    keywordSet !== null && ACTIVE_KEYWORD_STATUSES.has(keywordSet.status);

  // Poll while generation is in flight.
  useEffect(() => {
    if (!generating || !videoId) return;
    const id = window.setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > MAX_ATTEMPTS) {
        window.clearInterval(id);
        setError("Keyword extraction is taking longer than expected. Please try again.");
        return;
      }
      try {
        const data = await getKeywordSet(videoId);
        setKeywordSet(data);
        setNotFound(false);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          setKeywordSet(null);
          setNotFound(true);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [generating, videoId]);

  const keywords = keywordSet?.keywords ?? [];

  return {
    set: keywordSet,
    loading,
    generating,
    notFound,
    error,
    keywords,
    generate,
    reload: load,
  };
}