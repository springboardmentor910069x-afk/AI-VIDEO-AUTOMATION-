export type UploadStatus = "pending" | "processing" | "ready" | "failed";
export type TranscriptStatus = "pending" | "processing" | "complete" | "failed";
export type SummaryStatus = "pending" | "processing" | "complete" | "failed";
export type SummaryType = "short" | "detailed";
export type KeyMomentType = "highlight" | "chapter" | "important";
export type KeyMomentSetStatus = "pending" | "processing" | "complete" | "failed";
export type KeywordSetStatus = "pending" | "processing" | "complete" | "failed";
export type UserRole = "learner" | "educator" | "content_creator" | "administrator";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  learner: "Learner",
  educator: "Educator",
  content_creator: "Content Creator",
  administrator: "Administrator",
};

export const USER_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "learner", label: "Learner" },
  { value: "educator", label: "Educator" },
  { value: "content_creator", label: "Content Creator" },
  { value: "administrator", label: "Administrator" },
];

export type PublicRegistrationRole = "learner" | "educator" | "content_creator";

export const PUBLIC_REGISTRATION_ROLES: { value: PublicRegistrationRole; label: string }[] = [
  { value: "learner", label: "Learner" },
  { value: "educator", label: "Educator" },
  { value: "content_creator", label: "Content Creator" },
];

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MediaTokenResponse {
  token: string;
  expires_in: number;
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

export interface KeyMoment {
  id: string;
  start_time: number;
  end_time: number;
  title: string;
  description: string;
  type: KeyMomentType;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KeyMomentSet {
  id: string;
  video_id: string;
  status: KeyMomentSetStatus;
  model_name: string | null;
  error: string | null;
  moments: KeyMoment[];
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  keyword: string;
  score: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KeywordSet {
  id: string;
  video_id: string;
  status: KeywordSetStatus;
  model_name: string | null;
  error: string | null;
  keywords: Keyword[];
  created_at: string;
  updated_at: string;
}

export interface ProcessingCounts {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
}

export interface SummaryTypeCounts {
  short: number;
  detailed: number;
}

export interface RecentVideo {
  id: string;
  title: string;
  status: UploadStatus;
  duration: number | null;
  file_size: number | null;
  created_at: string;
}

export interface RecentActivity {
  type: "transcript" | "summary" | "key_moments" | "keywords";
  video_id: string;
  video_title: string;
  status: TranscriptStatus | SummaryStatus | KeyMomentSetStatus | KeywordSetStatus;
  occurred_at: string;
}

export interface AnalyticsDashboard {
  total_videos: number;
  processed_videos: number;
  total_transcripts: number;
  total_summaries: number;
  total_key_moments: number;
  total_keywords: number;
  processing: ProcessingCounts;
  summary_types: SummaryTypeCounts;
  failed_transcripts: number;
  failed_summaries: number;
  failed_key_moment_sets: number;
  failed_keyword_sets: number;
  recent_videos: RecentVideo[];
  recent_activity: RecentActivity[];
}

export const TERMINAL_UPLOAD_STATUSES: UploadStatus[] = ["ready", "failed"];
export const TERMINAL_TRANSCRIPT_STATUSES: TranscriptStatus[] = ["complete", "failed"];
export const ACTIVE_KEY_MOMENT_STATUSES: KeyMomentSetStatus[] = ["pending", "processing"];
export const ACTIVE_KEYWORD_STATUSES: KeywordSetStatus[] = ["pending", "processing"];
