export const BACKEND_URL = (
  import.meta.env?.VITE_BACKEND_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
).replace(/\/$/, '')
export const API_BASE_URL = `${BACKEND_URL}/api/v1`

export interface User {
  id: string
  email: string
  name: string
  role: string
  is_active: boolean
  avatar_url?: string
  verification_status?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface VideoItem {
  id: string
  user_id: string
  title: string
  filename: string
  duration_sec: number
  file_path?: string
  thumbnail_url?: string
  status: string
  stage: string
  progress: number
  size_bytes: number
  language: string
  word_count: number
  wer_accuracy: number
  category: string
  summary_depth: string
  domain: string
  created_at: string
}

export type VideoData = VideoItem


export interface WordInfo {
  word: string
  start: number
  end: number
  conf: number
}

export interface Segment {
  id: number
  start: number
  end: number
  timestamp: string
  speaker: string
  text: string
  confidence: number
  words?: WordInfo[]
}

export interface SummarySection {
  id: string
  title: string
  timeRange: string
  summary: string
  bulletPoints: string[]
  keyEquations?: string[]
}

export interface SummaryData {
  id: string
  video_id: string
  depth: string
  tldr: string
  sections: SummarySection[]
  key_takeaways: string[]
  keywords: string[]
  sentiment: string
  created_at: string
}

export interface KeyMomentItem {
  id: string
  timestamp: string
  timeSeconds: number
  title: string
  importance: string
  summary: string
  thumbnailUrl?: string
  tags: string[]
}

export interface Bookmark {
  id: string
  user_id: string
  video_id: string
  timestamp_sec: number
  timestamp_str: string
  label: string
  note?: string
  created_at: string
  video_title?: string
}

export interface LearnerLectureProgress {
  id: string
  title: string
  category: string
  duration_sec: number
  watch_seconds: number
  progress_pct: number
  completed: boolean
  thumbnail_url?: string
  last_studied?: string
  cards_mastered: number
  quiz_attempts_count: number
}

export interface LearnerStudyNote {
  id: string
  video_id: string
  video_title: string
  timestamp_str: string
  timestamp_sec: number
  label: string
  note: string
  created_at?: string
}

export interface LearnerMilestone {
  id: string
  title: string
  desc: string
  icon: string
  unlocked: boolean
  progress: number
  target: number
}

export interface LearnerDashboardData {
  total_study_minutes: number
  lectures_studied: number
  total_lectures: number
  flashcards_mastered: number
  flashcards_total: number
  flashcard_mastery_pct: number
  quizzes_taken: number
  quiz_accuracy_pct: number
  streak_days: number
  today_study_minutes: number
  recent_lectures: LearnerLectureProgress[]
  recent_notes: LearnerStudyNote[]
  milestones: LearnerMilestone[]
}

// Helper headers with auth token
function getHeaders(): HeadersInit {
  const token = localStorage.getItem('clipmind_access_token')
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export const api = {
  // Auth
  async register(email: string, password: string, name: string, role = 'Creator'): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Registration failed')
    }
    const data: AuthResponse = await res.json()
    // Only store credentials when a real token is returned (Learner gets immediate token;
    // Creator/Educator get empty token since they need admin approval first)
    if (data.access_token && data.access_token.trim()) {
      localStorage.setItem('clipmind_access_token', data.access_token)
      localStorage.setItem('clipmind_user', JSON.stringify(data.user))
    }
    return data
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Invalid email or password')
    }
    const data: AuthResponse = await res.json()
    if (data.access_token && data.access_token.trim()) {
      localStorage.setItem('clipmind_access_token', data.access_token)
      localStorage.setItem('clipmind_user', JSON.stringify(data.user))
    }
    return data
  },

  async loginDemo(role = 'Learner'): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Demo login failed')
    }
    const data: AuthResponse = await res.json()
    if (data.access_token && data.access_token.trim()) {
      localStorage.setItem('clipmind_access_token', data.access_token)
      localStorage.setItem('clipmind_user', JSON.stringify(data.user))
    }
    return data
  },

  async loginWithGoogle(credential: string, role = 'Creator'): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, role }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Google sign-in failed')
    }
    const data: AuthResponse = await res.json()
    localStorage.setItem('clipmind_access_token', data.access_token)
    localStorage.setItem('clipmind_user', JSON.stringify(data.user))
    return data
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() })
    if (!res.ok) {
      const err: any = new Error(`Failed to fetch user profile (${res.status})`)
      err.status = res.status
      throw err
    }
    return res.json()
  },

  // Videos
  uploadVideoWithProgress(formData: FormData, onProgress?: (pct: number) => void): Promise<VideoItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE_URL}/videos/upload`)
      
      const token = localStorage.getItem('clipmind_access_token')
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 85) // 0-85% for upload transfer
            onProgress(Math.max(10, pct))
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data: VideoItem = JSON.parse(xhr.responseText)
            if (onProgress) onProgress(90)
            resolve(data)
          } catch (e) {
            reject(new Error('Invalid response from server'))
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            reject(new Error(err.detail || 'Upload failed'))
          } catch (e) {
            reject(new Error(`Upload failed (${xhr.status})`))
          }
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.ontimeout = () => reject(new Error('Upload request timed out'))

      xhr.send(formData)
    })
  },

  async uploadVideo(formData: FormData): Promise<VideoItem> {
    return this.uploadVideoWithProgress(formData)
  },

  async getVideos(search?: string, category?: string): Promise<VideoItem[]> {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (category) params.append('category', category)

    const res = await fetch(`${API_BASE_URL}/videos?${params.toString()}`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async listVideos(search?: string, category?: string): Promise<VideoItem[]> {
    return this.getVideos(search, category)
  },


  async getVideo(id: string): Promise<VideoItem> {
    const res = await fetch(`${API_BASE_URL}/videos/${id}`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Video not found')
    return res.json()
  },

  async deleteVideo(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/videos/${id}`, { method: 'DELETE', headers: getHeaders() })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to delete video' }))
      throw new Error(data.detail || 'Failed to delete video')
    }
  },

  async getTranscript(videoId: string): Promise<{ segments: Segment[]; word_count: number }> {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/transcript`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Transcript not found')
    return res.json()
  },

  async searchTranscript(videoId: string, query: string) {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/transcript/search?query=${encodeURIComponent(query)}`, { headers: getHeaders() })
    if (!res.ok) return { total_matches: 0, matches: [] }
    return res.json()
  },

  async renameSpeaker(videoId: string, oldSpeaker: string, newSpeaker: string) {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/transcript/speaker-rename`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, old_speaker: oldSpeaker, new_speaker: newSpeaker }),
    })
    if (!res.ok) throw new Error('Failed to rename speaker')
    return res.json()
  },

  async getSummary(videoId: string): Promise<SummaryData> {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/summary`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Summary not found')
    return res.json()
  },

  async regenerateSummary(videoId: string, depth: string, focusPrompt?: string): Promise<SummaryData> {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/summary/regenerate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, depth, focus_prompt: focusPrompt }),
    })
    if (!res.ok) throw new Error('Failed to regenerate summary')
    return res.json()
  },

  async getEvaluation(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/evaluation`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Evaluation not found')
    return res.json()
  },

  async getKeyMoments(videoId: string): Promise<{ moments: KeyMomentItem[] }> {
    const res = await fetch(`${API_BASE_URL}/videos/${videoId}/key-moments`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Key moments not found')
    return res.json()
  },

  getExportUrl(videoId: string, format: 'pdf' | 'docx' | 'srt' | 'vtt' | 'txt'): string {
    return `${API_BASE_URL}/videos/${videoId}/export/${format}`
  },

  async downloadExport(videoId: string, format: 'pdf' | 'docx' | 'srt' | 'vtt' | 'txt', title: string = 'Video_Summary') {
    const url = this.getExportUrl(videoId, format)
    const token = localStorage.getItem('clipmind_access_token')
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}
    const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : format === 'srt' ? 'srt' : format === 'vtt' ? 'vtt' : 'txt'
    const safeTitle = (title || 'ClipMind_Video').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `${safeTitle}_Summary.${ext}`

    try {
      const response = await fetch(url, { headers })
      if (!response.ok) throw new Error(`Export download failed with status ${response.status}`)
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)
      }, 3000)
    } catch (err) {
      console.warn('[Export Download] Blob fetch encountered notice, falling back to direct stream:', err)
      // Direct stream download fallback
      const directLink = document.createElement('a')
      directLink.href = url
      directLink.download = filename
      directLink.target = '_blank'
      directLink.rel = 'noopener noreferrer'
      document.body.appendChild(directLink)
      directLink.click()
      setTimeout(() => {
        if (directLink.parentNode) directLink.parentNode.removeChild(directLink)
      }, 3000)
    }
  },

  // Search
  async search(query: string) {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() })
    if (!res.ok) return { results: [] }
    return res.json()
  },

  // Analytics
  async getAnalyticsOverview(range: string = '7d') {
    const res = await fetch(`${API_BASE_URL}/analytics/overview?range=${range}`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Analytics failed')
    return res.json()
  },

  async getSystemEvaluationMetrics() {
    const res = await fetch(`${API_BASE_URL}/analytics/evaluation-metrics`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Failed to fetch evaluation metrics')
    return res.json()
  },

  // Learner
  async getLearnerDashboard(): Promise<LearnerDashboardData> {
    const res = await fetch(`${API_BASE_URL}/learner/dashboard`, { headers: getHeaders() })
    if (!res.ok) throw new Error('Failed to load learner dashboard data')
    return res.json()
  },

  async recordStudySession(videoId: string, seconds: number, currentPositionSec: number = 0) {
    const res = await fetch(`${API_BASE_URL}/learner/study-session`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, seconds, current_position_sec: currentPositionSec })
    })
    if (!res.ok) return { success: false }
    return res.json()
  },

  async saveFlashcardMastery(videoId: string, cardId: string, status: 'know' | 'review') {
    const res = await fetch(`${API_BASE_URL}/learner/flashcard-mastery`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, card_id: cardId, status })
    })
    if (!res.ok) return { success: false }
    return res.json()
  },

  async submitQuizResult(videoId: string, score: number, total: number, answers?: any[]) {
    const res = await fetch(`${API_BASE_URL}/learner/quiz-submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, score, total, answers })
    })
    if (!res.ok) return { success: false }
    return res.json()
  },

  async sendLearnerChat(videoId: string, question: string) {
    const res = await fetch(`${API_BASE_URL}/learner/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, question }),
    })
    if (!res.ok) throw new Error('AI Chat response failed')
    return res.json()
  },

  async getFlashcards(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/learner/flashcards/${videoId}`, { headers: getHeaders() })
    if (!res.ok) return { flashcards: [] }
    return res.json()
  },

  async getQuizzes(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/learner/quizzes/${videoId}`, { headers: getHeaders() })
    if (!res.ok) return { questions: [] }
    return res.json()
  },

  // Educator
  async updateEducatorTranscript(videoId: string, segments: Segment[]) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/transcript`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, segments }),
    })
    if (!res.ok) throw new Error('Failed to update transcript')
    return res.json()
  },

  async updateEducatorChapters(videoId: string, sections: any[]) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/chapters`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ sections }),
    })
    if (!res.ok) throw new Error('Failed to update chapters')
    return res.json()
  },

  async getEducatorQuiz(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/quizzes`, { headers: getHeaders() })
    if (!res.ok) return { questions: [] }
    return res.json()
  },

  async getEducatorQuizzes(videoId: string) {
    return this.getEducatorQuiz(videoId)
  },

  async saveEducatorQuiz(videoId: string, questions: any[], title?: string) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/quizzes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, title: title || 'Lecture Quiz', questions }),
    })
    if (!res.ok) throw new Error('Failed to save quiz')
    return res.json()
  },

  async getEducatorFlashcards(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/flashcards`, { headers: getHeaders() })
    if (!res.ok) return { flashcards: [] }
    return res.json()
  },

  async saveEducatorFlashcards(videoId: string, flashcards: any[], title?: string) {
    const res = await fetch(`${API_BASE_URL}/educator/lectures/${videoId}/flashcards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, title: title || 'Lecture Flashcards', flashcards }),
    })
    if (!res.ok) throw new Error('Failed to save flashcards')
    return res.json()
  },


  // Bookmarks
  async getBookmarks(videoId?: string): Promise<Bookmark[]> {
    const url = videoId ? `${API_BASE_URL}/bookmarks?video_id=${encodeURIComponent(videoId)}` : `${API_BASE_URL}/bookmarks`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async createBookmark(videoId: string, timestampSec: number, timestampStr: string, label: string, note?: string): Promise<Bookmark> {
    const res = await fetch(`${API_BASE_URL}/bookmarks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ video_id: videoId, timestamp_sec: timestampSec, timestamp_str: timestampStr, label, note }),
    })
    if (!res.ok) throw new Error('Failed to create bookmark')
    return res.json()
  },

  async deleteBookmark(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/bookmarks/${id}`, { method: 'DELETE', headers: getHeaders() })
  },

  // Admin
  async getAdminUsers(role?: string) {
    const url = role ? `${API_BASE_URL}/admin/users?role=${role}` : `${API_BASE_URL}/admin/users`
    const res = await fetch(url, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async getPendingUsers() {
    const res = await fetch(`${API_BASE_URL}/admin/pending-users`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async verifyAdminUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
      method: 'POST',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to verify user')
    return res.json()
  },

  async rejectAdminUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to reject user')
    return res.json()
  },

  async getSystemHealth() {
    const res = await fetch(`${API_BASE_URL}/admin/system-health`, { headers: getHeaders() })
    if (!res.ok) throw new Error('System health failed')
    return res.json()
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async getAdminJobs() {
    const res = await fetch(`${API_BASE_URL}/admin/jobs`, { headers: getHeaders() })
    if (!res.ok) return { active_jobs: [] }
    return res.json()
  },

  async updateUserRole(userId: string, data: { role: string; is_active?: boolean } | string) {
    const rolePayload = typeof data === 'string' ? { role: data } : data
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rolePayload),
    })
    if (!res.ok) throw new Error('Failed to update user role')
    return res.json()
  },

  async deleteAdminUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete user')
    return res.json()
  },

  async createAdminUser(data: { email: string; name: string; role: string; password?: string }) {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create user')
    }
    return res.json()
  },

  async getAdminVideos() {
    const res = await fetch(`${API_BASE_URL}/admin/videos`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async deleteAdminVideo(videoId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/videos/${videoId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete video')
    return res.json()
  },

  async cleanPlatformCache() {
    const res = await fetch(`${API_BASE_URL}/admin/clean-cache`, {
      method: 'POST',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to clean cache')
    return res.json()
  },

  async getNotifications() {
    const res = await fetch(`${API_BASE_URL}/videos/notifications/feed`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  // Settings
  async getSettings() {
    const res = await fetch(`${API_BASE_URL}/settings`, { headers: getHeaders() })
    if (!res.ok) return {}
    return res.json()
  },

  async updateSettings(settings: any) {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    })
    if (!res.ok) throw new Error('Failed to update settings')
    return res.json()
  },

  // API Keys
  async getApiKeys() {
    const res = await fetch(`${API_BASE_URL}/settings/api-keys`, { headers: getHeaders() })
    if (!res.ok) return []
    return res.json()
  },

  async createApiKey(name: string) {
    const res = await fetch(`${API_BASE_URL}/settings/api-keys`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Failed to create API key')
    return res.json()
  },

  async revokeApiKey(id: string) {
    const res = await fetch(`${API_BASE_URL}/settings/api-keys/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error('Failed to revoke API key')
    return res.json()
  },

  // Educator
  async getEducatorLectures() {
    const res = await fetch(`${API_BASE_URL}/educator/lectures`, { headers: getHeaders() })
    if (!res.ok) return { lectures: [] }
    return res.json()
  },

  getVideoStreamUrl(videoId?: string, filename?: string): string {
    if (videoId) {
      return `${API_BASE_URL}/videos/${videoId}/stream`
    }
    if (filename) {
      return `${BACKEND_URL}/uploads/${filename}`
    }
    return ''
  },

  getThumbnailUrl(thumbUrl?: string): string {
    if (!thumbUrl) return ''
    if (thumbUrl.startsWith('http://') || thumbUrl.startsWith('https://')) return thumbUrl
    const path = thumbUrl.startsWith('/') ? thumbUrl : `/${thumbUrl}`
    return `${BACKEND_URL}${path}`
  }
}


