import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { copyToClipboard } from "@/lib/clipboard";
import { AlertTriangleIcon, CheckIcon, CopyIcon, DocumentTextIcon } from "@/components/Icons";
import type { Transcript } from "@/api/types";

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
  ru: "Russian",
  nl: "Dutch",
  sv: "Swedish",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  cs: "Czech",
  ro: "Romanian",
  hu: "Hungarian",
  el: "Greek",
  he: "Hebrew",
  uk: "Ukrainian",
  da: "Danish",
  fi: "Finnish",
  no: "Norwegian",
  ca: "Catalan",
  fa: "Persian",
  af: "Afrikaans",
  sw: "Swahili",
  tl: "Filipino",
  hr: "Croatian",
  sk: "Slovak",
  bg: "Bulgarian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  sl: "Slovenian",
  sr: "Serbian",
};

function formatLanguage(language: string | null): string {
  if (!language || language === "unknown") return "Unknown";
  const normalized = language.toLowerCase().trim();
  const name = LANGUAGE_NAMES[normalized];
  if (name) return `${name} (${normalized})`;
  if (normalized.length === 2) return `${normalized.toUpperCase()} (${normalized})`;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

interface TranscriptPanelProps {
  transcript: Transcript | null;
  loading: boolean;
  generating: boolean;
  notFound: boolean;
  error: string | null;
  videoProcessing: boolean;
  pollingTimedOut: boolean;
  onGenerate: () => void;
}

export default function TranscriptPanel({
  transcript,
  loading,
  generating,
  notFound,
  error,
  videoProcessing,
  pollingTimedOut,
  onGenerate,
}: TranscriptPanelProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!transcript?.transcript) return;
    const ok = await copyToClipboard(transcript.transcript);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Transcript copied to clipboard.");
    } else {
      toast.error("Could not copy the transcript. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Loading transcript…
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        Generating transcript with Whisper… this can take a few minutes.
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
      >
        {error}
      </div>
    );
  }

  if (transcript?.status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
        <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
          <AlertTriangleIcon className="h-4 w-4" />
          Transcription failed
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Retry transcription
        </button>
      </div>
    );
  }

  // Transcript not found and still polling — show generating state
  if (notFound && !videoProcessing && !pollingTimedOut) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        <span>Transcript is still being generated…</span>
      </div>
    );
  }

  // Transcript not found, not polling, user can manually generate
  if (notFound && !videoProcessing && pollingTimedOut) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          No transcript is available for this video yet.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Generate transcript
        </button>
      </div>
    );
  }

  if (notFound || transcript?.status === "pending" || transcript?.status === "processing") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
        <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
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

  const hasContent = Boolean(transcript.transcript);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge status={transcript.status} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Language: {formatLanguage(transcript.language)}
          </span>
          {hasContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
      <div className="scrollbar-thin max-h-96 flex-1 overflow-y-auto break-words whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
        {transcript.transcript || "Transcript content is empty."}
      </div>
    </div>
  );
}
