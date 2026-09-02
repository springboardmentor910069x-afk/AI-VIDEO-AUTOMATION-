import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorDetail, uploadVideo } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import FileDropZone from "@/components/FileDropZone";
import Spinner from "@/components/ui/Spinner";
import { CheckIcon } from "@/components/Icons";
import type { Video } from "@/api/types";

const ACCEPTED_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm"];
const MAX_SIZE_MB = 500;

const SUCCESS_HOLD_MS = 1600;

interface UploadFormProps {
  onUploaded: (video: Video) => void;
  onCancel?: () => void;
}

export default function UploadForm({ onUploaded, onCancel }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current !== null) window.clearTimeout(successTimer.current);
    };
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFile(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateFile = (candidate: File): string | null => {
    const ext = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type ".${ext}". Please choose an MP4, MOV, AVI, MKV or WebM file.`;
    }
    if (candidate.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File exceeds the maximum size of ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFiles = useCallback((files: FileList | null) => {
    const candidate = files?.[0] ?? null;
    if (!candidate) return;
    const fileError = validateFile(candidate);
    if (fileError) {
      setError(fileError);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(candidate);
    setTitle((prev) => prev || candidate.name.replace(/\.[^.]+$/, ""));
    setError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Please select a video file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const video = await uploadVideo({
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        description: description.trim() || undefined,
        file,
        onUploadProgress: setProgress,
      });

      // Show a short success confirmation before handing the video back.
      setSuccess(true);
      successTimer.current = window.setTimeout(() => {
        onUploaded(video);
        resetForm();
      }, SUCCESS_HOLD_MS);
    } catch (err) {
      setError(getApiErrorDetail(err));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckIcon className="h-7 w-7" />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Video uploaded successfully
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Processing video…
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            You'll be able to view the transcript and AI summary once processing completes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Title" htmlFor="video-title" required>
        <Input
          id="video-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Product demo"
          disabled={uploading}
        />
      </Field>

      <Field label="Description" htmlFor="video-description" hint="Optional">
        <Textarea
          id="video-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A short description of this video"
          rows={3}
          disabled={uploading}
        />
      </Field>

      <Field label="Video file" htmlFor="video-file" required>
        <FileDropZone
          inputRef={fileInputRef}
          file={file}
          dragActive={dragActive}
          disabled={uploading}
          onDragActive={setDragActive}
          onFiles={handleFiles}
        />
      </Field>

      {progress !== null && uploading && (
        <div>
          <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={uploading}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={uploading}>
          {uploading ? "Uploading…" : "Upload video"}
        </Button>
      </div>
    </form>
  );
}
