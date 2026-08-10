import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import { FilmIcon, UploadIcon } from "@/components/Icons";

const ACCEPT = ".mp4,.mov,.avi,.mkv,.webm";

interface FileDropZoneProps {
  inputRef: RefObject<HTMLInputElement>;
  file: File | null;
  dragActive: boolean;
  disabled?: boolean;
  onDragActive: (active: boolean) => void;
  onFiles: (files: FileList | null) => void;
}

export default function FileDropZone({
  inputRef,
  file,
  dragActive,
  disabled,
  onDragActive,
  onFiles,
}: FileDropZoneProps) {
  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-800/50">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <FilmIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {file.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(file.size / (1024 * 1024)).toFixed(1)} MB · ready to upload
          </p>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        onDragOver={(event) => {
          event.preventDefault();
          onDragActive(true);
        }}
        onDragLeave={() => onDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragActive(false);
          onFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
          "focus:outline-none focus:ring-2 focus:ring-brand-600/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          dragActive
            ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
            : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/60 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-brand-500 dark:hover:bg-brand-500/5",
        )}
      >
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200 transition dark:bg-slate-900 dark:text-brand-400 dark:ring-slate-700",
            dragActive && "scale-105",
          )}
        >
          <UploadIcon className="h-6 w-6" />
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Choose a video or drag &amp; drop
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          MP4, MOV, AVI, MKV or WebM · up to 500 MB
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
