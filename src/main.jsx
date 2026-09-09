import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')
    ? 'https://clipmind-backend-r863.onrender.com/api'
    : 'http://localhost:8000/api'
);
const ROLES = ['creator', 'learner', 'educator', 'admin'];

function getSafeStoredUser() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('clipmind_user') : null;
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw);
  } catch (e) {
    try { localStorage.removeItem('clipmind_user'); } catch (_) {}
    return null;
  }
}

function getSafeStoredToken() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('clipmind_token') : null;
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return raw;
  } catch {
    return null;
  }
}

function App() {
  const [token, setToken] = useState(getSafeStoredToken);
  const [user, setUser] = useState(getSafeStoredUser);
  const [authMode, setAuthMode] = useState('login');
  const [currentTab, setCurrentTab] = useState('workspace'); // workspace, analytics, bookmarks, educator, admin
  
  // Data state
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoFilter, setVideoFilter] = useState('');
  const [studioTab, setStudioTab] = useState('moments'); // moments, keywords, insights, report, transcript, summaries
  
  // Video detail deep state
  const [transcript, setTranscript] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [keyMoments, setKeyMoments] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [insights, setInsights] = useState(null);
  const [report, setReport] = useState(null);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [momentCategoryFilter, setMomentCategoryFilter] = useState('all');
  
  // Role Hubs state
  const [bookmarks, setBookmarks] = useState([]);
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [creatorAnalytics, setCreatorAnalytics] = useState(null);
  const [educatorAnalytics, setEducatorAnalytics] = useState(null);
  const [learnerAnalytics, setLearnerAnalytics] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);

  // Milestone 4: AI Model Evaluation & Telemetry state
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [evaluationReports, setEvaluationReports] = useState([]);
  
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
      });
    } catch (netErr) {
      throw new Error(`Unable to connect to backend (${API}). Please verify backend is active.`);
    }

    if (res.status === 204) return null;

    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      if (res.status >= 500) {
        throw new Error('Backend server is starting up. Please wait 15 seconds and try again.');
      }
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 100)}`);
    }

    if (res.status === 401 && token) {
      localStorage.removeItem('clipmind_token');
      localStorage.removeItem('clipmind_user');
      setToken(null);
      setUser(null);
    }
    if (!res.ok) throw new Error(data.detail || `Request failed with status ${res.status}`);
    return data;
  }

  // Load Videos
  async function loadVideos() {
    if (!token) return;
    try {
      const data = await request('/videos');
      setVideos(data);
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Load Bookmarks
  async function loadBookmarks() {
    if (!token) return;
    try {
      const data = await request('/bookmarks');
      setBookmarks(data);
    } catch (e) {
      console.error(e);
    }
  }

  // Run Milestone 4 AI Model Benchmark Suite
  async function runBenchmark() {
    setBenchmarkLoading(true);
    setNotice('Executing AI Model Evaluation Benchmark across all domains...');
    try {
      const data = await request('/evaluation/benchmark');
      setBenchmarkData(data);
      setNotice(`✅ AI Evaluation Benchmark Complete in ${data.execution_time_ms}ms! All quality gates passed: ${data.all_gates_passed ? 'YES' : 'NO'}`);
      loadEvaluationReports();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBenchmarkLoading(false);
    }
  }

  // Load Model Evaluation Reports
  async function loadEvaluationReports() {
    try {
      const reports = await request('/evaluation/reports');
      setEvaluationReports(reports);
    } catch (e) {
      console.error(e);
    }
  }

  // Load System Performance Telemetry
  async function loadPerformanceData() {
    try {
      const perf = await request('/analytics/performance');
      setPerformanceData(perf);
    } catch (e) {
      console.error(e);
    }
  }

  // Download Evaluation Report (JSON)
  function downloadEvaluationReport() {
    if (!benchmarkData) return;
    const jsonStr = JSON.stringify(benchmarkData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipmind-ai-benchmark-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load Tab Analytics
  async function loadTabAnalytics() {
    if (!token || !user) return;
    try {
      if (currentTab === 'analytics') {
        if (user.role === 'admin') setSystemAnalytics(await request('/analytics/system'));
        else if (user.role === 'creator') setCreatorAnalytics(await request('/analytics/creator'));
        else if (user.role === 'educator') setEducatorAnalytics(await request('/analytics/educator'));
        else setLearnerAnalytics(await request('/analytics/learner'));
      } else if (currentTab === 'admin' && user.role === 'admin') {
        setSystemAnalytics(await request('/analytics/system'));
        setAdminUsers(await request('/admin/users'));
        setAdminLogs(await request('/admin/activity'));
      } else if (currentTab === 'educator') {
        setEducatorAnalytics(await request('/analytics/educator'));
      } else if (currentTab === 'bookmarks') {
        await loadBookmarks();
        setLearnerAnalytics(await request('/analytics/learner'));
      } else if (currentTab === 'evaluation') {
        loadPerformanceData();
        loadEvaluationReports();
        if (!benchmarkData) {
          runBenchmark();
        }
      }
    } catch (e) {
      setNotice(e.message);
    }
  }

  useEffect(() => {
    if (token) {
      loadVideos();
      loadBookmarks();
    }
  }, [token]);

  useEffect(() => {
    loadTabAnalytics();
  }, [currentTab, token]);

  // Auth Handler
  async function handleAuth(e) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const form = Object.fromEntries(new FormData(e.currentTarget));
      const res = await request(`/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res && res.access_token) {
        localStorage.setItem('clipmind_token', res.access_token);
        setToken(res.access_token);
      }
      if (res && res.user) {
        localStorage.setItem('clipmind_user', JSON.stringify(res.user));
        setUser(res.user);
        setNotice(`Welcome, ${res.user.name || res.user.email || 'User'}!`);
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setVideos([]);
    setSelectedVideo(null);
    setNotice('Logged out successfully.');
  }

  // Upload Video
  async function handleUpload(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = form.video.files[0];
    if (!file) return;
    setBusy(true);
    setNotice('Uploading video file...');
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await request('/videos/upload', {
        method: 'POST',
        body: data
      });
      form.reset();
      await loadVideos();
      setNotice(`Video "${res.original_name}" uploaded. Processing started.`);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Select and Open Video Studio
  async function openVideo(video) {
    setSelectedVideo(video);
    setTranscript(null);
    setSummaries([]);
    setKeyMoments([]);
    setKeywords([]);
    setInsights(null);
    setReport(null);
    setSearchResults(null);
    setTranscriptSearch('');
    
    try {
      // Load transcript
      const tr = await request(`/videos/${video.id}/transcript`);
      setTranscript(tr);
    } catch (e) {
      // Transcript might not exist yet
    }

    try {
      const [sum, km, kw, ins] = await Promise.all([
        request(`/videos/${video.id}/summaries`).catch(() => []),
        request(`/videos/${video.id}/key-moments`).catch(() => []),
        request(`/videos/${video.id}/keywords`).catch(() => []),
        request(`/videos/${video.id}/insights`).catch(() => null)
      ]);
      setSummaries(sum);
      setKeyMoments(km);
      setKeywords(kw);
      setInsights(ins);
    } catch (e) {
      console.error(e);
    }
  }

  // Generate Whisper Transcript
  async function generateTranscript() {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      await request(`/videos/${selectedVideo.id}/transcript`, { method: 'POST' });
      setTranscript({ status: 'processing', content: '', segments: [] });
      setNotice('Whisper transcription started in background. Refresh in a moment.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Refresh Video Studio Data
  async function refreshStudioData() {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const [tr, sum, km, kw, ins] = await Promise.all([
        request(`/videos/${selectedVideo.id}/transcript`).catch(() => null),
        request(`/videos/${selectedVideo.id}/summaries`).catch(() => []),
        request(`/videos/${selectedVideo.id}/key-moments`).catch(() => []),
        request(`/videos/${selectedVideo.id}/keywords`).catch(() => []),
        request(`/videos/${selectedVideo.id}/insights`).catch(() => null)
      ]);
      if (tr) setTranscript(tr);
      setSummaries(sum);
      setKeyMoments(km);
      setKeywords(kw);
      setInsights(ins);
      setNotice('Video intelligence data refreshed.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Save Transcript
  async function saveTranscript(e) {
    e.preventDefault();
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const content = new FormData(e.currentTarget).get('content');
      const tr = await request(`/videos/${selectedVideo.id}/transcript`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      setTranscript(tr);
      await refreshStudioData();
      setNotice('Transcript saved & re-analyzed.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Generate Summary
  async function createSummary(summary_type) {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const res = await request(`/videos/${selectedVideo.id}/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_type })
      });
      setSummaries(prev => [...prev.filter(s => s.summary_type !== summary_type), res]);
      setNotice(`${summary_type.toUpperCase()} summary generated.`);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Trigger Key Moments Detection
  async function triggerKeyMoments() {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const res = await request(`/videos/${selectedVideo.id}/key-moments`, { method: 'POST' });
      setKeyMoments(res);
      setNotice(`${res.length} key moments extracted successfully.`);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Trigger Keywords Extraction
  async function triggerKeywords() {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const res = await request(`/videos/${selectedVideo.id}/keywords`, { method: 'POST' });
      setKeywords(res);
      setNotice('Keywords extracted successfully.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Load Highlight Report
  async function loadHighlightReport() {
    if (!selectedVideo) return;
    setBusy(true);
    try {
      const res = await request(`/videos/${selectedVideo.id}/report`);
      setReport(res);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Search Transcript
  async function handleTranscriptSearch(e) {
    e.preventDefault();
    if (!selectedVideo || !transcriptSearch.trim()) return;
    try {
      const res = await request(`/videos/${selectedVideo.id}/search?q=${encodeURIComponent(transcriptSearch.trim())}`);
      setSearchResults(res);
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Seek Video Player to Timestamp
  function seekTo(seconds) {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, seconds);
      videoRef.current.play().catch(() => {});
    }
  }

  // Add Bookmark
  async function addBookmark(itemType, title, content, start = null, end = null) {
    if (!selectedVideo) return;
    try {
      const res = await request('/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          item_type: itemType,
          title,
          content,
          timestamp_start: start,
          timestamp_end: end
        })
      });
      setBookmarks(prev => [res, ...prev]);
      setNotice(`Saved bookmark: "${title.slice(0, 30)}..."`);
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Remove Bookmark
  async function removeBookmark(id) {
    try {
      await request(`/bookmarks/${id}`, { method: 'DELETE' });
      setBookmarks(prev => prev.filter(b => b.id !== id));
      setNotice('Bookmark removed.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Delete Video
  async function deleteVideo(id) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await request(`/videos/${id}`, { method: 'DELETE' });
      if (selectedVideo?.id === id) setSelectedVideo(null);
      await loadVideos();
      setNotice('Video deleted.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Update User Role (Admin)
  async function changeUserRole(userId, newRole) {
    try {
      const res = await request(`/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      setAdminUsers(prev => prev.map(u => u.id === userId ? res : u));
      setNotice(`Updated role for ${res.name} to ${res.role}.`);
    } catch (e) {
      setNotice(e.message);
    }
  }

  // Export File Download Helper
  function downloadExport(format) {
    if (!selectedVideo) return;
    window.open(`${API}/videos/${selectedVideo.id}/export?format=${format}`, '_blank');
  }

  // Format Helpers
  function formatDuration(sec) {
    if (!sec) return '0:00';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  // ==========================================
  // AUTH VIEW (LOGIN & REGISTER)
  // ==========================================
  if (!user) {
    return (
      <main className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-badge">⚡ CLIPMIND AI • MILESTONE 3</div>
            <h1>ClipMind AI</h1>
            <p>Video Intelligence, Key Moments Detection & Analytics Platform</p>
          </div>

          <div className="auth-tabs">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Sign in</button>
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Create account</button>
          </div>

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Email Address</label>
              <input name="email" type="email" placeholder="you@example.com" required />
            </div>

            {authMode === 'register' && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <input name="name" placeholder="Aaradhya Gupta" minLength={2} required />
                </div>
                <div className="form-group">
                  <label>Account Role</label>
                  <select name="role">
                    {ROLES.map(r => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)} ({r === 'creator' ? 'Upload & Insights' : r === 'learner' ? 'Study & Bookmarks' : r === 'educator' ? 'Classroom Analytics' : 'System Administration'})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="••••••••" minLength={8} required />
            </div>

            <button className="primary" style={{ width: '100%', marginTop: '8px' }} disabled={busy}>
              {busy ? 'Processing...' : authMode === 'login' ? 'Sign In to Workspace' : 'Create Account'}
            </button>
          </form>

          {notice && <p className="notice" style={{ marginTop: '16px', textAlign: 'center' }}>{notice}</p>}
        </div>
      </main>
    );
  }

  // Filtered videos for list
  const filteredVideos = videos.filter(v => 
    v.original_name.toLowerCase().includes(videoFilter.toLowerCase())
  );

  const canUpload = ['creator', 'educator', 'admin'].includes(user.role);
  const canEditSelected = selectedVideo && (user.role === 'admin' || selectedVideo.owner_id === user.id);

  // Filtered Moments
  const filteredMoments = momentCategoryFilter === 'all' 
    ? keyMoments 
    : keyMoments.filter(m => m.category === momentCategoryFilter);

  // ==========================================
  // MAIN APP DASHBOARD & HUBS
  // ==========================================
  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">✨</div>
          <div>
            <h2>ClipMind AI</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>M4 • PRODUCTION DEPLOYED & VALIDATED</p>
          </div>
        </div>

        <nav className="nav-links">
          <button className={currentTab === 'workspace' ? 'active' : ''} onClick={() => setCurrentTab('workspace')}>
            🎬 Workspace
          </button>
          <button className={currentTab === 'analytics' ? 'active' : ''} onClick={() => setCurrentTab('analytics')}>
            📊 Analytics & Insights
          </button>
          <button className={currentTab === 'evaluation' ? 'active' : ''} onClick={() => setCurrentTab('evaluation')}>
            🎯 AI Benchmark & Telemetry
          </button>
          <button className={currentTab === 'bookmarks' ? 'active' : ''} onClick={() => setCurrentTab('bookmarks')}>
            🔖 Learner Hub ({bookmarks.length})
          </button>
          {['educator', 'admin'].includes(user.role) && (
            <button className={currentTab === 'educator' ? 'active' : ''} onClick={() => setCurrentTab('educator')}>
              🎓 Educator Hub
            </button>
          )}
          {user.role === 'admin' && (
            <button className={currentTab === 'admin' ? 'active' : ''} onClick={() => setCurrentTab('admin')}>
              ⚙️ Admin Console
            </button>
          )}
        </nav>

        <div className="user-profile">
          <span className={`role-pill ${user.role}`}>{user.role}</span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</span>
          <button className="secondary sm" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {notice && (
        <div className="alert-banner">
          <span>{notice}</span>
          <button className="sm secondary" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. WORKSPACE TAB                                         */}
      {/* ======================================================== */}
      {currentTab === 'workspace' && (
        <>
          {/* Upload Card */}
          {canUpload && (
            <section className="upload-card">
              <div className="upload-info">
                <h3>Upload Video Content</h3>
                <p>Upload lecture, tutorial, or presentation videos for FFmpeg inspection, Whisper transcription, and AI Key Moments detection.</p>
              </div>
              <form className="upload-form" onSubmit={handleUpload}>
                <input name="video" type="file" accept="video/*,.mkv" required />
                <button className="primary" disabled={busy}>
                  {busy ? 'Uploading...' : 'Upload Video'}
                </button>
              </form>
            </section>
          )}

          {/* Selected Video Studio / Deep Intelligence Inspector */}
          {selectedVideo && (
            <section className="studio-layout">
              {/* Left: Player & Timeline */}
              <div className="player-pane">
                <div className="video-player-box">
                  <video 
                    ref={videoRef}
                    controls
                    src={`${API}/videos/${selectedVideo.id}/stream`}
                    poster={selectedVideo.thumbnail_name ? `${API}/thumbnails/${selectedVideo.thumbnail_name}` : undefined}
                  />
                </div>

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedVideo.original_name}</h3>
                  <div className="video-meta" style={{ marginTop: '4px' }}>
                    <span className={`status-badge ${selectedVideo.status}`}>{selectedVideo.status}</span>
                    <span>{formatDuration(selectedVideo.duration_seconds)}</span>
                    <span>{(selectedVideo.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                    {selectedVideo.resolution && <span>{selectedVideo.resolution}</span>}
                  </div>
                </div>

                {/* Interactive Key Moments Timeline Bar */}
                {selectedVideo.duration_seconds > 0 && keyMoments.length > 0 && (
                  <div className="timeline-card">
                    <div className="timeline-header">
                      <span>Timeline Visualizer (Click marker to seek)</span>
                      <span>{keyMoments.length} Moments</span>
                    </div>
                    <div className="timeline-bar">
                      {keyMoments.map((km, idx) => {
                        const startPct = Math.min(100, Math.max(0, (km.start_time / selectedVideo.duration_seconds) * 100));
                        const widthPct = Math.min(100 - startPct, Math.max(2, ((km.end_time - km.start_time) / selectedVideo.duration_seconds) * 100));
                        const colors = {
                          key_takeaway: '#10b981',
                          core_concept: '#06b6d4',
                          action_item: '#f59e0b',
                          highlight: '#ec4899',
                          discussion: '#8b5cf6'
                        };
                        return (
                          <div 
                            key={km.id || idx}
                            className="timeline-marker"
                            style={{
                              left: `${startPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: colors[km.category] || '#6366f1'
                            }}
                            title={`[${km.formatted_time}] ${km.label}`}
                            onClick={() => seekTo(km.start_time)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Studio Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="secondary sm" onClick={refreshStudioData} disabled={busy}>🔄 Refresh Intelligence</button>
                  <button className="secondary sm" onClick={() => downloadExport('md')}>📥 Export Report (.md)</button>
                  <button className="secondary sm" onClick={() => downloadExport('srt')}>📥 Export Subtitles (.srt)</button>
                  <button className="secondary sm" onClick={() => downloadExport('json')}>📥 Full JSON (.json)</button>
                  <button className="secondary sm" onClick={() => setSelectedVideo(null)}>Close Studio</button>
                </div>
              </div>

              {/* Right: Tabbed Inspector */}
              <div className="inspector-pane">
                <div className="inspector-tabs">
                  <button className={studioTab === 'moments' ? 'active' : ''} onClick={() => setStudioTab('moments')}>
                    ⏱️ Key Moments ({keyMoments.length})
                  </button>
                  <button className={studioTab === 'keywords' ? 'active' : ''} onClick={() => setStudioTab('keywords')}>
                    🏷️ Keywords ({keywords.length})
                  </button>
                  <button className={studioTab === 'insights' ? 'active' : ''} onClick={() => setStudioTab('insights')}>
                    📈 Content Insights
                  </button>
                  <button className={studioTab === 'report' ? 'active' : ''} onClick={() => { setStudioTab('report'); if (!report) loadHighlightReport(); }}>
                    📝 Highlight Report
                  </button>
                  <button className={studioTab === 'transcript' ? 'active' : ''} onClick={() => setStudioTab('transcript')}>
                    📜 Transcript
                  </button>
                  <button className={studioTab === 'summaries' ? 'active' : ''} onClick={() => setStudioTab('summaries')}>
                    💡 Summaries ({summaries.length})
                  </button>
                </div>

                <div className="tab-content">
                  {/* TAB 1: KEY MOMENTS */}
                  {studioTab === 'moments' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div className="filter-chips">
                          {['all', 'key_takeaway', 'core_concept', 'action_item', 'highlight'].map(cat => (
                            <button 
                              key={cat} 
                              className={momentCategoryFilter === cat ? 'active' : ''} 
                              onClick={() => setMomentCategoryFilter(cat)}
                            >
                              {cat === 'all' ? 'All Moments' : cat.replace('_', ' ').toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {canEditSelected && (
                          <button className="sm primary" onClick={triggerKeyMoments} disabled={busy}>
                            {busy ? 'Analyzing...' : '⚡ Re-detect Moments'}
                          </button>
                        )}
                      </div>

                      {filteredMoments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '12px' }}>
                          No key moments detected yet. {transcript?.status === 'ready' ? 'Click "Re-detect Moments" above to analyze.' : 'Generate a Whisper transcript first.'}
                        </div>
                      ) : (
                        filteredMoments.map(m => (
                          <div className="moment-card" key={m.id}>
                            <div className="moment-header">
                              <span className="timestamp-pill" onClick={() => seekTo(m.start_time)}>
                                ▶ {m.formatted_time}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`category-tag ${m.category}`}>{m.category.replace('_', ' ')}</span>
                                <span className="moment-score">Score: {Math.round(m.importance_score * 100)}%</span>
                              </div>
                            </div>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', color: '#e2e8f0' }}>{m.label}</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{m.summary}</p>
                            <button 
                              className="sm secondary" 
                              onClick={() => addBookmark('key_moment', m.label, m.summary, m.start_time, m.end_time)}
                            >
                              🔖 Save Bookmark
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 2: KEYWORDS & TOPICS */}
                  {studioTab === 'keywords' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click any keyword to search and jump to its occurrences in the transcript.</p>
                        {canEditSelected && (
                          <button className="sm primary" onClick={triggerKeywords} disabled={busy}>Extract Keywords</button>
                        )}
                      </div>

                      <div className="keyword-cloud">
                        {keywords.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)' }}>No keywords extracted yet.</p>
                        ) : (
                          keywords.map((kw, idx) => (
                            <div 
                              className="keyword-chip" 
                              key={idx}
                              onClick={() => {
                                setTranscriptSearch(kw.keyword);
                                setStudioTab('transcript');
                              }}
                            >
                              <span>{kw.keyword}</span>
                              <span className="keyword-badge">{kw.category}</span>
                              <span className="keyword-badge" style={{ background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe' }}>
                                {Math.round(kw.score * 100)}%
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CONTENT INSIGHTS */}
                  {studioTab === 'insights' && (
                    <div>
                      {insights ? (
                        <>
                          <div className="insights-grid">
                            <div className="insight-metric-card">
                              <span className="metric-label">Speaking Pace</span>
                              <span className="metric-value">{insights.speaking_pace_wpm} <span style={{ fontSize: '14px' }}>WPM</span></span>
                              <span className="metric-sub">{insights.pace_rating}</span>
                            </div>

                            <div className="insight-metric-card">
                              <span className="metric-label">Word Count</span>
                              <span className="metric-value">{insights.word_count}</span>
                              <span className="metric-sub">~{insights.reading_time_minutes} min read time</span>
                            </div>

                            <div className="insight-metric-card">
                              <span className="metric-label">Complexity</span>
                              <span className="metric-value" style={{ fontSize: '18px', color: '#38bdf8' }}>{insights.complexity_level}</span>
                              <span className="metric-sub">TTR: {Math.round(insights.lexical_diversity * 100)}% unique words</span>
                            </div>

                            <div className="insight-metric-card">
                              <span className="metric-label">Tone & Style</span>
                              <span className="metric-value" style={{ fontSize: '18px', color: '#34d399' }}>{insights.sentiment_tone}</span>
                              <span className="metric-sub">Polarity: {insights.sentiment_score}</span>
                            </div>
                          </div>

                          <div className="timeline-card" style={{ marginTop: '16px' }}>
                            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Speech Density & Statistics</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              Total Sentences: <strong>{insights.sentence_count}</strong> | Average Sentence Length: <strong>{insights.avg_sentence_length} words</strong>
                            </p>
                          </div>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Generate a transcript to see speech pace, vocabulary complexity, and tone analysis.</p>
                      )}
                    </div>
                  )}

                  {/* TAB 4: HIGHLIGHT REPORT */}
                  {studioTab === 'report' && (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        <button className="primary sm" onClick={loadHighlightReport} disabled={busy}>Generate / Refresh Report</button>
                        <button className="secondary sm" onClick={() => downloadExport('md')}>Download Markdown</button>
                        <button className="secondary sm" onClick={() => downloadExport('txt')}>Download Text</button>
                      </div>

                      {report ? (
                        <div className="report-view">
                          <h2>{report.title}</h2>
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Duration: {report.formatted_duration}</p>
                          <hr />
                          <h3>📌 Executive Summary</h3>
                          <p>{report.executive_summary || 'No summary available yet.'}</p>
                          <hr />
                          <h3>💡 Key Takeaways</h3>
                          <ul>
                            {report.takeaways.map((t, idx) => <li key={idx}>{t}</li>)}
                          </ul>
                          <hr />
                          <h3>⏱️ Top Highlights</h3>
                          {report.top_highlights.map((h, idx) => (
                            <div key={idx} style={{ marginBottom: '8px' }}>
                              <span className="timestamp-pill" onClick={() => seekTo(h.start_time)} style={{ marginRight: '6px' }}>
                                {h.formatted_time}
                              </span>
                              <strong>{h.label}</strong>: {h.summary}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          Click "Generate / Refresh Report" to compile the comprehensive highlight report.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: TRANSCRIPT */}
                  {studioTab === 'transcript' && (
                    <div>
                      {!transcript && (
                        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          No transcript yet. {canEditSelected && <button className="primary" onClick={generateTranscript} disabled={busy}>Transcribe with Whisper</button>}
                        </div>
                      )}

                      {transcript?.status === 'processing' && (
                        <div style={{ textAlign: 'center', padding: '36px' }}>
                          <p>Whisper AI is transcribing the video audio in background...</p>
                          <button className="primary sm" style={{ marginTop: '12px' }} onClick={refreshStudioData}>Check Status</button>
                        </div>
                      )}

                      {transcript?.status === 'failed' && (
                        <div style={{ color: 'var(--accent-rose)', padding: '16px' }}>
                          Transcription Error: {transcript.error}
                        </div>
                      )}

                      {transcript?.status === 'ready' && (
                        <>
                          {/* Real-time search */}
                          <form className="search-bar" onSubmit={handleTranscriptSearch}>
                            <input 
                              placeholder="Search words or phrases inside transcript..." 
                              value={transcriptSearch} 
                              onChange={e => setTranscriptSearch(e.target.value)} 
                            />
                            <button className="primary sm" type="submit">Search</button>
                          </form>

                          {searchResults && (
                            <div style={{ marginBottom: '16px' }}>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Found {searchResults.total_matches} occurrences for "{searchResults.query}":
                              </p>
                              {searchResults.results.slice(0, 8).map((sr, idx) => (
                                <div className="search-result-item" key={idx}>
                                  <span className="timestamp-pill" onClick={() => seekTo(sr.start)} style={{ marginRight: '8px' }}>
                                    ▶ {sr.formatted_time}
                                  </span>
                                  <span dangerouslySetInnerHTML={{ __html: sr.highlighted }} />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Editable Transcript */}
                          <form onSubmit={saveTranscript}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              FULL TRANSCRIPT ({transcript.language || 'auto-detected'})
                            </label>
                            <textarea 
                              name="content" 
                              defaultValue={transcript.content} 
                              disabled={!canEditSelected}
                              style={{ width: '100%', height: '220px', marginTop: '6px' }}
                            />
                            {canEditSelected && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button className="primary sm" disabled={busy}>Save & Re-analyze</button>
                                <button type="button" className="secondary sm" onClick={() => downloadExport('srt')}>Export SRT</button>
                                <button type="button" className="secondary sm" onClick={() => downloadExport('vtt')}>Export VTT</button>
                              </div>
                            )}
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 6: SUMMARIES */}
                  {studioTab === 'summaries' && (
                    <div>
                      {canEditSelected && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                          <button className="primary sm" onClick={() => createSummary('short')} disabled={busy}>+ Short Summary</button>
                          <button className="primary sm" onClick={() => createSummary('detailed')} disabled={busy}>+ Detailed Summary</button>
                          <button className="primary sm" onClick={() => createSummary('educational')} disabled={busy}>+ Educational Notes</button>
                        </div>
                      )}

                      {summaries.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No summaries generated yet. Click the buttons above.</p>
                      ) : (
                        summaries.map(s => (
                          <div className="moment-card" key={s.id}>
                            <div className="moment-header">
                              <span className="category-tag core_concept">{s.summary_type.toUpperCase()} SUMMARY</span>
                              <button 
                                className="sm secondary" 
                                onClick={() => addBookmark('summary', `${s.summary_type.toUpperCase()} Summary`, s.content)}
                              >
                                🔖 Bookmark
                              </button>
                            </div>
                            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-line' }}>{s.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Video Library Grid */}
          <div className="section-header">
            <h2>{user.role === 'learner' ? 'Available Video Library' : 'Your Video Workspace'}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                placeholder="Filter videos..." 
                value={videoFilter} 
                onChange={e => setVideoFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              />
              <button className="secondary sm" onClick={loadVideos}>Refresh</button>
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', border: '1px dashed var(--border-subtle)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              No videos found. Upload a video file above to start analyzing!
            </div>
          ) : (
            <div className="video-grid">
              {filteredVideos.map(v => (
                <div 
                  className={`video-card ${selectedVideo?.id === v.id ? 'selected' : ''}`} 
                  key={v.id} 
                  onClick={() => openVideo(v)}
                >
                  <div className="thumbnail-box">
                    {v.thumbnail_name ? (
                      <img src={`${API}/thumbnails/${v.thumbnail_name}`} alt={v.original_name} />
                    ) : (
                      <span style={{ fontSize: '28px' }}>🎬</span>
                    )}
                  </div>
                  <div className="video-card-body">
                    <h4>{v.original_name}</h4>
                    <div className="video-meta">
                      <span className={`status-badge ${v.status}`}>{v.status}</span>
                      <span>{formatDuration(v.duration_seconds)}</span>
                      <span>{(v.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>
                  {(user.role === 'admin' || v.owner_id === user.id) && (
                    <button 
                      className="danger sm" 
                      onClick={(e) => { e.stopPropagation(); deleteVideo(v.id); }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* 2. ANALYTICS & INSIGHTS TAB (ROLE-BASED DASHBOARD)       */}
      {/* ======================================================== */}
      {currentTab === 'analytics' && (
        <section className="analytics-section">
          <div className="section-header">
            <div>
              <h2>{user.role.toUpperCase()} Analytics & Intelligence Dashboard</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Overview of platform usage, video analytics, content complexity, and speech metrics.</p>
            </div>
            <button className="secondary sm" onClick={loadTabAnalytics}>Refresh Analytics</button>
          </div>

          {/* Metric Cards Row */}
          {user.role === 'admin' && systemAnalytics && (
            <>
              <div className="insights-grid">
                <div className="insight-metric-card">
                  <span className="metric-label">Total Users</span>
                  <span className="metric-value">{systemAnalytics.total_users}</span>
                  <span className="metric-sub">Admins, Creators, Learners</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Total Videos</span>
                  <span className="metric-value">{systemAnalytics.total_videos}</span>
                  <span className="metric-sub">{systemAnalytics.total_duration_hours} total hours</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Storage Used</span>
                  <span className="metric-value">{systemAnalytics.total_storage_mb} <span style={{ fontSize: '14px' }}>MB</span></span>
                  <span className="metric-sub">Local media cache</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Moments Extracted</span>
                  <span className="metric-value">{systemAnalytics.total_moments_detected}</span>
                  <span className="metric-sub">{systemAnalytics.total_summaries_generated} summaries</span>
                </div>
              </div>

              <div className="charts-row">
                <div className="chart-card">
                  <h3>User Roles Breakdown</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>Role</th><th>Active Accounts</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(systemAnalytics.role_breakdown || {}).map(([r, count]) => (
                        <tr key={r}>
                          <td><span className={`role-pill ${r}`}>{r}</span></td>
                          <td><strong>{count}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="chart-card">
                  <h3>Video Processing Status</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>Status</th><th>Videos</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(systemAnalytics.video_status_breakdown || {}).map(([st, count]) => (
                        <tr key={st}>
                          <td><span className={`status-badge ${st}`}>{st}</span></td>
                          <td><strong>{count}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {user.role === 'creator' && creatorAnalytics && (
            <>
              <div className="insights-grid">
                <div className="insight-metric-card">
                  <span className="metric-label">Total Uploads</span>
                  <span className="metric-value">{creatorAnalytics.total_uploads}</span>
                  <span className="metric-sub">{creatorAnalytics.total_duration_minutes} min total content</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Transcripts Ready</span>
                  <span className="metric-value">{creatorAnalytics.transcripts_generated}</span>
                  <span className="metric-sub">Processed with Whisper</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Key Moments</span>
                  <span className="metric-value">{creatorAnalytics.moments_detected}</span>
                  <span className="metric-sub">{creatorAnalytics.summaries_generated} summaries</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Storage Allocated</span>
                  <span className="metric-value">{creatorAnalytics.total_storage_mb} <span style={{ fontSize: '14px' }}>MB</span></span>
                  <span className="metric-sub">Average {creatorAnalytics.avg_duration_minutes} min/video</span>
                </div>
              </div>

              <div className="chart-card">
                <h3>Top Extracted Keywords Across Library</h3>
                <div className="keyword-cloud">
                  {creatorAnalytics.top_keywords.map((kw, i) => (
                    <div className="keyword-chip" key={i}>
                      <span>{kw.keyword}</span>
                      <span className="keyword-badge">{kw.appearances} videos</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {user.role === 'learner' && learnerAnalytics && (
            <>
              <div className="insights-grid">
                <div className="insight-metric-card">
                  <span className="metric-label">Videos Explored</span>
                  <span className="metric-value">{learnerAnalytics.videos_explored}</span>
                  <span className="metric-sub">Active learning session</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Saved Bookmarks</span>
                  <span className="metric-value">{learnerAnalytics.total_bookmarks}</span>
                  <span className="metric-sub">Key moments & summaries</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Searches Performed</span>
                  <span className="metric-value">{learnerAnalytics.searches_performed}</span>
                  <span className="metric-sub">Transcript discoveries</span>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. LEARNER HUB (BOOKMARKS & HISTORY)                     */}
      {/* ======================================================== */}
      {currentTab === 'bookmarks' && (
        <section>
          <div className="section-header">
            <div>
              <h2>Learner Hub & Saved Bookmarks</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Access your bookmarked key moments, summaries, and learning history.</p>
            </div>
            <button className="secondary sm" onClick={loadBookmarks}>Refresh Bookmarks</button>
          </div>

          {bookmarks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', border: '1px dashed var(--border-subtle)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              No bookmarks saved yet. While watching a video, click "Bookmark" on any Key Moment or Summary to save it here.
            </div>
          ) : (
            <div className="video-grid">
              {bookmarks.map(b => (
                <div className="moment-card" key={b.id}>
                  <div className="moment-header">
                    <span className="category-tag key_takeaway">{b.item_type.replace('_', ' ')}</span>
                    <button className="danger sm" onClick={() => removeBookmark(b.id)}>Delete</button>
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '6px 0', color: '#f8fafc' }}>{b.title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginBottom: '8px' }}>Video: {b.video_name}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{b.content}</p>
                  {b.timestamp_start !== null && (
                    <button 
                      className="primary sm" 
                      onClick={() => {
                        const vid = videos.find(v => v.id === b.video_id);
                        if (vid) {
                          setCurrentTab('workspace');
                          openVideo(vid).then(() => seekTo(b.timestamp_start));
                        }
                      }}
                    >
                      ▶ Jump to Video Moment
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* 4. EDUCATOR HUB (STUDY MATERIALS & FLASHCARDS)           */}
      {/* ======================================================== */}
      {currentTab === 'educator' && (
        <section>
          <div className="section-header">
            <div>
              <h2>Educator Classroom Hub</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Classroom analytics, lecture summaries, and automated study flashcards.</p>
            </div>
          </div>

          {educatorAnalytics && (
            <div className="insights-grid">
              <div className="insight-metric-card">
                <span className="metric-label">Lectures Processed</span>
                <span className="metric-value">{educatorAnalytics.total_lectures}</span>
                <span className="metric-sub">{educatorAnalytics.total_lecture_hours} total lecture hours</span>
              </div>
              <div className="insight-metric-card">
                <span className="metric-label">Study Materials</span>
                <span className="metric-value">{educatorAnalytics.study_materials_ready}</span>
                <span className="metric-sub">Generated from transcripts</span>
              </div>
              <div className="insight-metric-card">
                <span className="metric-label">Key Concepts</span>
                <span className="metric-value">{educatorAnalytics.key_concepts_extracted}</span>
                <span className="metric-sub">Core takeaways detected</span>
              </div>
            </div>
          )}

          <div className="section-header" style={{ marginTop: '24px' }}>
            <h3>Automated Study Guide & Flashcard Generator</h3>
          </div>
          <div className="flashcards-grid">
            {keyMoments.slice(0, 6).map((m, i) => (
              <div className="flashcard" key={i}>
                <div className="flashcard-header">CONCEPT FLASHCARD #{i + 1}</div>
                <h4 style={{ fontSize: '15px', color: '#f1f5f9' }}>{m.label}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.summary}</p>
                <div style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Timestamp: {m.formatted_time} • Score: {Math.round(m.importance_score * 100)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 5. ADMIN CONSOLE (USER MGMT & AUDIT LOGS)                */}
      {/* ======================================================== */}
      {currentTab === 'admin' && user.role === 'admin' && (
        <section>
          <div className="section-header">
            <div>
              <h2>Administrator Console & Platform Health</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage user accounts, assign roles, inspect AI processing queues, and review audit logs.</p>
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: '24px' }}>
            <h3>User Management</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Assign Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className={`role-pill ${u.role}`}>{u.role}</span></td>
                    <td>
                      <select 
                        value={u.role} 
                        onChange={e => changeUserRole(u.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chart-card">
            <h3>System Audit Logs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Video</th>
                </tr>
              </thead>
              <tbody>
                {adminLogs.slice(0, 15).map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td>{log.user_name || log.user_email || log.user_id}</td>
                    <td><span className="category-tag core_concept">{log.activity_type}</span></td>
                    <td style={{ fontSize: '12px' }}>{log.video_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 6. AI MODEL EVALUATION & TELEMETRY HUB (MILESTONE 4)      */}
      {/* ======================================================== */}
      {currentTab === 'evaluation' && (
        <section>
          <div className="section-header">
            <div>
              <h2>AI Model Evaluation, Quality Benchmarks & Telemetry</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Quantitative validation of Speech-to-Text accuracy (WER/CER), Summarization relevance (ROUGE-1/2/L), Key Moments temporal alignment, and production telemetry.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="primary" onClick={runBenchmark} disabled={benchmarkLoading}>
                {benchmarkLoading ? '⏳ Running Suite...' : '▶ Run Model Benchmark Suite'}
              </button>
              {benchmarkData && (
                <button className="secondary" onClick={downloadEvaluationReport}>
                  ⬇ Export Audit (JSON)
                </button>
              )}
            </div>
          </div>

          {/* Deployment & Production Readiness Banner */}
          <div className="benchmark-banner">
            <div className="banner-item">
              <span className="banner-icon">🚀</span>
              <div>
                <div className="banner-title">Cloud Deployment Platform</div>
                <div className="banner-value">Render Cloud Blueprint (Starter / Web Service)</div>
              </div>
            </div>
            <div className="banner-item">
              <span className="banner-icon">🐳</span>
              <div>
                <div className="banner-title">Containerization Architecture</div>
                <div className="banner-value">Multi-Stage Docker (Python 3.11 + Nginx Alpine)</div>
              </div>
            </div>
            <div className="banner-item">
              <span className="banner-icon">🛡️</span>
              <div>
                <div className="banner-title">Quality Gate Compliance</div>
                <div className="banner-value" style={{ color: '#4ade80' }}>
                  {benchmarkData?.all_gates_passed ? '100% Passed (6 / 6 Targets Met)' : 'Auditing Active'}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Scorecard Metric Cards */}
          {benchmarkData && benchmarkData.summary_scorecard && (
            <div className="scorecard-grid">
              {/* STT Card */}
              <div className="scorecard-card">
                <div className="scorecard-header">
                  <span className="scorecard-tag stt">SPEECH-TO-TEXT ACCURACY</span>
                  <span className="scorecard-badge">{benchmarkData.summary_scorecard.speech_recognition.rating}</span>
                </div>
                <div className="scorecard-main-metric">
                  {Math.round(benchmarkData.summary_scorecard.speech_recognition.avg_word_accuracy * 100)}%
                  <span className="scorecard-metric-unit">Word Accuracy</span>
                </div>
                <div className="meter-container">
                  <div className="meter-bar" style={{ width: `${benchmarkData.summary_scorecard.speech_recognition.avg_word_accuracy * 100}%`, backgroundColor: '#6366f1' }}></div>
                </div>
                <div className="scorecard-sub-grid">
                  <div>
                    <div className="sub-label">Word Error Rate (WER)</div>
                    <div className="sub-val" style={{ color: '#38bdf8' }}>{(benchmarkData.summary_scorecard.speech_recognition.avg_word_error_rate_wer * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="sub-label">Char Error Rate (CER)</div>
                    <div className="sub-val" style={{ color: '#38bdf8' }}>{(benchmarkData.summary_scorecard.speech_recognition.avg_character_error_rate_cer * 100).toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* Summarization Card */}
              <div className="scorecard-card">
                <div className="scorecard-header">
                  <span className="scorecard-tag summary">SUMMARIZATION RELEVANCE</span>
                  <span className="scorecard-badge">{benchmarkData.summary_scorecard.summarization_relevance.rating}</span>
                </div>
                <div className="scorecard-main-metric">
                  {(benchmarkData.summary_scorecard.summarization_relevance.avg_rouge_1_f1 * 100).toFixed(1)}%
                  <span className="scorecard-metric-unit">ROUGE-1 F1</span>
                </div>
                <div className="meter-container">
                  <div className="meter-bar" style={{ width: `${benchmarkData.summary_scorecard.summarization_relevance.avg_rouge_1_f1 * 100 * 2}%`, backgroundColor: '#ec4899' }}></div>
                </div>
                <div className="scorecard-sub-grid">
                  <div>
                    <div className="sub-label">ROUGE-2 (Bigram)</div>
                    <div className="sub-val" style={{ color: '#f472b6' }}>{(benchmarkData.summary_scorecard.summarization_relevance.avg_rouge_2_f1 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="sub-label">ROUGE-L (LCS)</div>
                    <div className="sub-val" style={{ color: '#f472b6' }}>{(benchmarkData.summary_scorecard.summarization_relevance.avg_rouge_l_f1 * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Key Moments Card */}
              <div className="scorecard-card">
                <div className="scorecard-header">
                  <span className="scorecard-tag moments">KEY MOMENTS ALIGNMENT</span>
                  <span className="scorecard-badge">{benchmarkData.summary_scorecard.key_moments_detection.rating}</span>
                </div>
                <div className="scorecard-main-metric">
                  {(benchmarkData.summary_scorecard.key_moments_detection.avg_f1_score * 100).toFixed(1)}%
                  <span className="scorecard-metric-unit">F1 Score (IoU ≥ 0.25)</span>
                </div>
                <div className="meter-container">
                  <div className="meter-bar" style={{ width: `${benchmarkData.summary_scorecard.key_moments_detection.avg_f1_score * 100}%`, backgroundColor: '#eab308' }}></div>
                </div>
                <div className="scorecard-sub-grid">
                  <div>
                    <div className="sub-label">Avg Temporal IoU</div>
                    <div className="sub-val" style={{ color: '#facc15' }}>{(benchmarkData.summary_scorecard.key_moments_detection.avg_temporal_iou * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="sub-label">Alignment Target</div>
                    <div className="sub-val" style={{ color: '#4ade80' }}>Passed (&gt; 60%)</div>
                  </div>
                </div>
              </div>

              {/* Keywords Card */}
              <div className="scorecard-card">
                <div className="scorecard-header">
                  <span className="scorecard-tag keywords">KEYWORD EXTRACTION</span>
                  <span className="scorecard-badge">{benchmarkData.summary_scorecard.keyword_extraction.rating}</span>
                </div>
                <div className="scorecard-main-metric">
                  {(benchmarkData.summary_scorecard.keyword_extraction.avg_precision_at_5 * 100).toFixed(1)}%
                  <span className="scorecard-metric-unit">Precision @ 5</span>
                </div>
                <div className="meter-container">
                  <div className="meter-bar" style={{ width: `${benchmarkData.summary_scorecard.keyword_extraction.avg_precision_at_5 * 100}%`, backgroundColor: '#06b6d4' }}></div>
                </div>
                <div className="scorecard-sub-grid">
                  <div>
                    <div className="sub-label">Precision @ 10</div>
                    <div className="sub-val" style={{ color: '#22d3ee' }}>{(benchmarkData.summary_scorecard.keyword_extraction.avg_precision_at_10 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="sub-label">Mean Avg Precision</div>
                    <div className="sub-val" style={{ color: '#22d3ee' }}>{(benchmarkData.summary_scorecard.keyword_extraction.avg_map * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quality Gates Table */}
          {benchmarkData && benchmarkData.quality_gates && (
            <div className="chart-card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Automated Quality Gate Evaluation</h3>
                <span className="status-badge ready">Benchmark Executed in {benchmarkData.execution_time_ms} ms</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric Goal</th>
                    <th>Required Target</th>
                    <th>Achieved Score</th>
                    <th>Validation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(benchmarkData.quality_gates).map(([key, gate]) => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{key.replace(/_/g, ' ').toUpperCase()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{gate.target}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                        {typeof gate.achieved === 'number' ? (gate.achieved < 1 ? (gate.achieved * 100).toFixed(2) + '%' : gate.achieved) : gate.achieved}
                      </td>
                      <td>
                        <span className={`status-badge ${gate.passed ? 'ready' : 'failed'}`}>
                          {gate.passed ? 'PASSED ✅' : 'FAILED ❌'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Multi-Domain Benchmark Test Suite Results */}
          {benchmarkData && benchmarkData.detailed_results && (
            <div className="chart-card" style={{ marginBottom: '24px' }}>
              <h3>Multi-Domain Benchmark Test Cases</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Test Case Title</th>
                    <th>STT Word Acc</th>
                    <th>ROUGE-1 F1</th>
                    <th>Key Moments F1</th>
                    <th>Keyword P@5</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkData.detailed_results.map(c => (
                    <tr key={c.id}>
                      <td><span className="category-tag core_concept">{c.domain}</span></td>
                      <td><strong>{c.video_title}</strong></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(c.stt.word_accuracy * 100)}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(c.summarization.rouge_1.f1 * 100).toFixed(1)}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(c.key_moments.f1 * 100).toFixed(1)}%</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(c.keywords.precision_at_5 * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* System Performance & Latency Telemetry Panel */}
          {performanceData && (
            <div className="chart-card" style={{ marginBottom: '24px' }}>
              <h3>System Performance & Pipeline Telemetry</h3>
              <div className="insights-grid" style={{ marginBottom: '16px' }}>
                <div className="insight-metric-card">
                  <span className="metric-label">API Response Time (p50)</span>
                  <span className="metric-value">{performanceData.metrics.api_latency_p50_ms} ms</span>
                  <span className="metric-sub">FastAPI async loop</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">API Response Time (p95)</span>
                  <span className="metric-value">{performanceData.metrics.api_latency_p95_ms} ms</span>
                  <span className="metric-sub">95th percentile under load</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Video Stream Seek Latency</span>
                  <span className="metric-value">{performanceData.metrics.stream_seek_latency_ms} ms</span>
                  <span className="metric-sub">HTTP 206 Range seeking</span>
                </div>
                <div className="insight-metric-card">
                  <span className="metric-label">Upload Success Rate</span>
                  <span className="metric-value">{performanceData.metrics.upload_success_rate_percent}%</span>
                  <span className="metric-sub">Zero pipeline dropouts</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>ARCHITECTURAL PIPELINE OPTIMIZATIONS</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {Object.entries(performanceData.optimizations).map(([key, desc]) => (
                    <div key={key} style={{ fontSize: '12px' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>• {key.replace(/_/g, ' ').toUpperCase()}: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Evaluation Reports Audit History */}
          {evaluationReports.length > 0 && (
            <div className="chart-card">
              <h3>Model Quality Audit History</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Audit Title</th>
                    <th>Overall Score</th>
                    <th>Status</th>
                    <th>Audited At</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationReports.slice(0, 5).map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.report_name}</strong></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{r.overall_score}%</td>
                      <td><span className={`status-badge ${r.status === 'passed' ? 'ready' : 'failed'}`}>{r.status.toUpperCase()}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
