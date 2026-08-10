export type UploadStatus = "pending" | "processing" | "ready" | "failed";
export type TranscriptStatus = "pending" | "processing" | "complete" | "failed";
export type SummaryStatus = "pending" | "processing" | "complete" | "failed";
export type SummaryType = "short" | "detailed";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string | null;
  duration: number | null;
  file_size: number | null;
  upload_status: UploadStatus;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  video_id: string;
  transcript: string | null;
  language: string | null;
  status: TranscriptStatus;
  created_at: string;
  updated_at: string;
}

export interface Summary {
  id: string;
  video_id: string;
  summary: string | null;
  summary_type: SummaryType;
  model_name: string | null;
  status: SummaryStatus;
  created_at: string;
  updated_at: string;
}

export const TERMINAL_UPLOAD_STATUSES: UploadStatus[] = ["ready", "failed"];
export const TERMINAL_TRANSCRIPT_STATUSES: TranscriptStatus[] = ["complete", "failed"];
