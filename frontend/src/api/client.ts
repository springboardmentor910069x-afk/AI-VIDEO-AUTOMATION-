import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  Summary,
  SummaryType,
  TokenResponse,
  Transcript,
  User,
  Video,
} from "@/api/types";

// Resolved at build time. Empty string = same-origin (behind a reverse proxy that
// forwards /api and /uploads to the backend). Never bake secrets into this value.
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const SESSION_EXPIRED_EVENT = "clipmind:session-expired";
const SESSION_EXPIRED_FLAG = "clipmind-session-expired";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function storeTokens(tokens: TokenResponse): void {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

/** Notify the app that the session can no longer be authenticated (no hard reloads). */
export function notifySessionExpired(): void {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1");
  } catch {
    // sessionStorage unavailable — the login screen simply won't show the banner
  }
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function consumeSessionExpiredFlag(): boolean {
  try {
    const expired = sessionStorage.getItem(SESSION_EXPIRED_FLAG) === "1";
    if (expired) sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
    return expired;
  } catch {
    return false;
  }
}

export function onSessionExpired(handler: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Bare instance used for token refresh only — must never go through the response
// interceptor below (otherwise a failed refresh would trigger refresh again).
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshInFlight = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await refreshClient.post<TokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    storeTokens(res.data);
    return res.data.access_token;
  } catch {
    return null;
  }
}

function flushRefreshQueue(token: string | null): void {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;
    const url = original?.url ?? "";
    const status = error.response?.status;
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    // Anything that isn't an expired-token 401 just falls through to the caller.
    if (status !== 401 || !original || isAuthRoute || original._retried) {
      return Promise.reject(error);
    }

    // A refresh is already in flight: queue this request and replay it after.
    if (refreshInFlight) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            original._retried = true;
            resolve(client(original));
          } else {
            reject(error);
          }
        });
      });
    }

    refreshInFlight = true;
    const token = await tryRefreshToken();
    refreshInFlight = false;

    if (token) {
      flushRefreshQueue(token);
      original.headers.Authorization = `Bearer ${token}`;
      original._retried = true;
      return client(original);
    }

    // Refresh failed (or no refresh token): the session is over.
    flushRefreshQueue(null);
    clearStoredTokens();
    notifySessionExpired();
    return Promise.reject(error);
  },
);

// ---------------- AUTH ----------------

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const res = await client.post<TokenResponse>("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await client.get<User>("/auth/me");
  return res.data;
}

export async function registerUser(input: {
  email: string;
  username: string;
  full_name?: string;
  password: string;
}): Promise<User> {
  const res = await client.post<User>("/auth/register", input);
  return res.data;
}

// ---------------- VIDEOS ----------------

export async function getVideos(): Promise<Video[]> {
  const res = await client.get<Video[]>("/videos");
  return res.data;
}

export async function getVideo(videoId: string): Promise<Video> {
  const res = await client.get<Video>(`/videos/${videoId}`);
  return res.data;
}

export interface UploadVideoOptions {
  title: string;
  description?: string;
  file: File;
  onUploadProgress?: (percent: number) => void;
}

export async function uploadVideo({
  title,
  description,
  file,
  onUploadProgress,
}: UploadVideoOptions): Promise<Video> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description ?? "");
  formData.append("file", file);

  const res = await client.post<Video>("/videos/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onUploadProgress && event.total) {
        onUploadProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });
  return res.data;
}

// ---------------- TRANSCRIPTS ----------------

export async function getTranscript(videoId: string): Promise<Transcript> {
  const res = await client.get<Transcript>(`/transcripts/video/${videoId}`);
  return res.data;
}

export async function generateTranscript(videoId: string): Promise<Transcript> {
  const res = await client.post<Transcript>(`/transcripts/video/${videoId}`);
  return res.data;
}

// ---------------- SUMMARIES ----------------

export async function generateSummary(
  videoId: string,
  summaryType: SummaryType = "short",
): Promise<Summary> {
  const res = await client.post<Summary>(
    `/summaries/video/${videoId}`,
    null,
    { params: { summary_type: summaryType } },
  );
  return res.data;
}

export async function getSummaries(videoId: string): Promise<Summary[]> {
  const res = await client.get<Summary[]>(`/summaries/video/${videoId}`);
  return res.data;
}

// ---------------- HELPERS ----------------

export function getApiErrorDetail(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Network-level failure (server down, offline, CORS) — no HTTP response.
    if (!error.response) {
      return "Unable to reach the server. Check your internet connection and try again.";
    }

    const status = error.response.status;
    const detail = error.response.data?.detail;

    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (item && typeof item.msg === "string" ? item.msg : null))
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
      return "Please check your input and try again.";
    }

    if (status === 401) return "Invalid credentials. Please try again.";
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "The requested item could not be found.";
    if (status === 409) return "That item already exists.";
    if (status === 413) return "That file is too large to upload.";
    if (status >= 500) return "Something went wrong on our end. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export function thumbnailUrl(video: Pick<Video, "thumbnail_path">): string | null {
  const path = video.thumbnail_path;
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (!API_ORIGIN) return path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}/${path.replace(/^\/+/, "")}`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const unit = units[i] ?? "B";
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${unit}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
