export type Role = "creator" | "learner" | "educator" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
};

export type AdminMetrics = {
  users: number;
  videos: number;
  audit_logs: number;
};

export type Video = {
  id: string;
  user_id: string;
  title: string;
  file_url: string;
  duration: number;
  size_bytes: number;
  mime_type: string;
  status: string;
  uploaded_at: string;
};

export type TutorMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TutorReply = {
  video_id: string;
  answer: string;
  detected_language: string;
  provider_used: string;
  citations: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? "Request failed");
  }
  return response.json();
}

async function requestText(path: string, token?: string): Promise<string> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? "Request failed");
  }
  return response.text();
}

async function requestBlob(path: string, token?: string): Promise<Blob> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? "Request failed");
  }
  return response.blob();
}

export const api = {
  register: (body: { name: string; email: string; password: string; role: Role }) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string; refresh_token: string }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: (token: string) => request<User>("/auth/me", {}, token),
  videos: (token: string) => request<Video[]>("/videos", {}, token),
  upload: (token: string, data: FormData) => request<Video>("/videos", { method: "POST", body: data }, token),
  reprocess: (token: string, id: string) => request<{ video_id: string; status: string; message: string }>(`/videos/${id}/reprocess`, { method: "POST" }, token),
  deleteVideo: (token: string, id: string) => request<{ video_id: string; status: string; message: string }>(`/videos/${id}`, { method: "DELETE" }, token),
  transcript: (token: string, id: string) => request<{ full_text: string; segments: { start: number; end: number; text: string }[] }>(`/videos/${id}/transcript`, {}, token),
  summary: (token: string, id: string) => request<{ short_summary: string; detailed_summary: string }>(`/videos/${id}/summary`, {}, token),
  translateSummary: (token: string, id: string, language: "english" | "hindi" | "hinglish") =>
    request<{ short_summary: string; detailed_summary: string }>(`/videos/${id}/summary/translate`, { method: "POST", body: JSON.stringify({ language }) }, token),
  moments: (token: string, id: string) => request<{ timestamp: number; title: string; importance_score: number }[]>(`/videos/${id}/key-moments`, {}, token),
  analytics: (token: string, id: string) => request<{ watch_time: number; engagement_score: number; topics: string[]; sentiment: string }>(`/videos/${id}/analytics`, {}, token),
  exportTxt: (token: string, id: string) => requestText(`/videos/${id}/exports/txt`, token),
  exportPdf: (token: string, id: string) => requestBlob(`/videos/${id}/exports/pdf`, token),
  tutor: (token: string, id: string, body: { question: string; chat_history: TutorMessage[] }) =>
    request<TutorReply>(`/videos/${id}/tutor`, { method: "POST", body: JSON.stringify(body) }, token),
  adminMetrics: (token: string) => request<AdminMetrics>("/admin/metrics", {}, token),
  adminUsers: (token: string) => request<User[]>("/admin/users", {}, token),
  updateUserRole: (token: string, id: string, role: Role) =>
    request<User>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, token)
};
