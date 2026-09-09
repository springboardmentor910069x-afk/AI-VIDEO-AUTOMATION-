import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Video as VideoIcon, Play, Pause, Clock, FileText, Sparkles,
  Layers, Tag, BarChart3, Download, RefreshCw, Copy, Check,
  ArrowLeft, AlertTriangle, Loader2, CheckCircle2, ShieldAlert,
  Sliders, Search, ExternalLink, Calendar, HardDrive, Film
} from 'lucide-react';

export const VideoDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [summary, setSummary] = useState(null);
  const [keyMoments, setKeyMoments] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [report, setReport] = useState(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      const videoData = await api.get(`/videos/${id}`);
      setVideo(videoData);

      if (videoData.status === 'COMPLETED' || videoData.status === 'ANALYZING') {
        try {
          const transData = await api.get(`/videos/${id}/transcript`);
          setTranscript(transData);
        } catch (e) {
          console.debug('Transcript not ready yet', e);
        }

        try {
          const sumData = await api.get(`/videos/${id}/summary`);
          setSummary(sumData);
        } catch (e) {
          console.debug('Summary not ready yet', e);
        }

        try {
          const kmData = await api.get(`/videos/${id}/key-moments`);
          setKeyMoments(kmData);
        } catch (e) {
          console.debug('Key moments not ready yet', e);
        }

        try {
          const kwData = await api.get(`/videos/${id}/keywords`);
          setKeywords(kwData);
        } catch (e) {
          console.debug('Keywords not ready yet', e);
        }

        try {
          const anData = await api.get(`/analytics/videos/${id}`);
          setAnalytics(anData);
        } catch (e) {
          console.debug('Analytics not ready yet', e);
        }

        try {
          const repData = await api.get(`/videos/${id}/report`);
          setReport(repData);
        } catch (e) {
          console.debug('Report not ready yet', e);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load video intelligence details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  useEffect(() => {
    if (!video) return;
    const isProcessing = ['UPLOADED', 'QUEUED', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING', 'ANALYZING', 'PENDING'].includes(video.status);
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchAllData();
    }, 3000);

    return () => clearInterval(interval);
  }, [video?.status]);

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const handleCopyTranscript = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript.fullText);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  };

  const handleRegenerateSummary = async () => {
    try {
      setRegeneratingSummary(true);
      const newSummary = await api.post(`/videos/${id}/summary/regenerate`);
      setSummary(newSummary);
    } catch (err) {
      alert('Failed to regenerate summary: ' + err.message);
    } finally {
      setRegeneratingSummary(false);
    }
  };

  const handleDownloadReport = () => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/videos/${id}/report/download?token=${token}`, '_blank');
  };

  const handleExportTranscript = () => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/videos/${id}/transcript/export?token=${token}`, '_blank');
  };

  const formatDuration = (sec) => {
    if (!sec || isNaN(sec)) return '00:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredSegments = transcript?.segments?.filter(s =>
    s.text.toLowerCase().includes(transcriptSearch.toLowerCase())
  ) || [];
  if (loading && !video) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="glass-panel p-8 rounded-2xl border border-rose-900/30">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Video Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">{error || 'Could not locate the requested video resource.'}</p>
          <Link to="/videos" className="inline-flex items-center gap-2 bg-brand-600 px-5 py-2.5 rounded-xl font-semibold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  const isPipelineActive = ['UPLOADED', 'QUEUED', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING', 'ANALYZING', 'PENDING'].includes(video.status);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/videos" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">{video.title}</h1>
            <span className={`px-3 py-0.5 text-xs font-bold rounded-full border uppercase tracking-wider ${
              video.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              video.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
              'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
            }`}>
              {video.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 ml-11">
            Added on {new Date(video.createdAt).toLocaleDateString()} &bull; Duration: {formatDuration(video.duration)} &bull; {formatSize(video.fileSize)} &bull; {video.resolution} ({video.codec})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-glow shadow-brand-500/10 transition-all"
            >
              <Download className="h-4 w-4" />
              Download Report
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-900">
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                src={`${API_BASE}/videos/${video.id}/stream?token=${user?.token}`}
                controls
                className="w-full h-full"
                onTimeUpdate={() => setCurrentTime(videoRef.current ? videoRef.current.currentTime : 0)}
              />
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-900 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300 font-mono">
                <Clock className="h-3.5 w-3.5 text-brand-400" />
                {formatDuration(currentTime)} / {formatDuration(video.duration)}
              </span>
              <span className="text-slate-500">
                {video.contentType || 'video/mp4'}
              </span>
            </div>
          </div>

          {isPipelineActive && (
            <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  AI Pipeline in Progress
                </span>
                <span>Stage: {video.status}</span>
              </div>
              <p className="text-xs text-slate-400">
                ClipMind AI is executing FFmpeg audio extraction, Whisper STT, summarization, and key moment analysis in the background. Results refresh automatically.
              </p>
            </div>
          )}

          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="h-4 w-4 text-brand-400" />
              Video Specifications
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-slate-500 block">Resolution</span>
                <span className="text-slate-200 font-semibold">{video.resolution || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-slate-500 block">Video Codec</span>
                <span className="text-slate-200 font-semibold">{video.codec || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-slate-500 block">Duration</span>
                <span className="text-slate-200 font-semibold">{formatDuration(video.duration)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-slate-500 block">File Size</span>
                <span className="text-slate-200 font-semibold">{formatSize(video.fileSize)}</span>
              </div>
            </div>

            {video.description && (
              <div className="pt-2 border-t border-slate-900">
                <span className="text-xs text-slate-500 block mb-1">Description</span>
                <p className="text-xs text-slate-300 leading-relaxed">{video.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel border border-slate-900 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Film },
              { id: 'transcript', label: 'Transcript', icon: FileText, count: transcript?.segments?.length },
              { id: 'summary', label: 'AI Summary', icon: Sparkles },
              { id: 'keyMoments', label: 'Key Moments', icon: Layers, count: keyMoments.length },
              { id: 'keywords', label: 'Keywords', icon: Tag, count: keywords.length },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'reports', label: 'Report', icon: Download },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-brand-600 text-white shadow-glow shadow-brand-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'}
                  `}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-brand-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {activeTab === 'overview' && (
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-2">Executive Overview</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {summary ? summary.shortSummary : (isPipelineActive ? 'Generating executive summary...' : 'No summary available.')}
                </p>
              </div>

              {keyMoments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4 text-brand-400" />
                    Key Chapter Markers
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {keyMoments.map((km, idx) => (
                      <div
                        key={km.id || idx}
                        onClick={() => seekTo(km.startTime)}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-brand-500/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white group-hover:text-brand-400 transition-colors truncate">{km.title}</span>
                          <span className="text-[11px] font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                            {formatDuration(km.startTime)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{km.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {keywords.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="h-4 w-4 text-brand-400" />
                    Primary Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {keywords.slice(0, 8).map((kw, i) => (
                      <button
                        key={i}
                        onClick={() => kw.timestamp && seekTo(kw.timestamp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-brand-500/20 text-slate-300 hover:text-brand-300 text-xs border border-slate-800 hover:border-brand-500/30 transition-all"
                      >
                        <span className="font-semibold">{kw.keyword}</span>
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full text-slate-400">
                          {kw.frequency}x
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search transcript text..."
                    className="form-input pl-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTranscript}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors"
                  >
                    {copiedTranscript ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedTranscript ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleExportTranscript}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export .txt
                  </button>
                </div>
              </div>

              {!transcript ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'Whisper STT is generating timestamped transcript...' : 'No transcript generated for this video.'}
                </div>
              ) : filteredSegments.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No transcript segments matching "{transcriptSearch}".
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
                  {filteredSegments.map((seg, idx) => {
                    const isCurrent = currentTime >= seg.startTime && currentTime <= seg.endTime;
                    return (
                      <div
                        key={seg.id || idx}
                        onClick={() => seekTo(seg.startTime)}
                        className={`
                          p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-4 group
                          ${isCurrent
                            ? 'bg-brand-500/10 border-brand-500/40 shadow-sm'
                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/30'}
                        `}
                      >
                        <button
                          className="shrink-0 font-mono text-xs font-bold px-2 py-1 rounded bg-slate-900 group-hover:bg-brand-500 group-hover:text-white text-brand-400 transition-colors"
                        >
                          {formatDuration(seg.startTime)} - {formatDuration(seg.endTime)}
                        </button>
                        <div className="flex-1">
                          <p className="text-xs text-slate-300 leading-relaxed group-hover:text-white transition-colors">
                            {seg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-400" />
                  AI Intelligence Summary
                </h3>
                <button
                  onClick={handleRegenerateSummary}
                  disabled={regeneratingSummary || isPipelineActive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regeneratingSummary ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>

              {!summary ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'AI summarizer is synthesizing the transcript...' : 'No summary available.'}
                </div>
              ) : (
                <div className="space-y-6 text-xs">
                  <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                    <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider block mb-1">
                      Short Summary
                    </span>
                    <p className="text-slate-200 leading-relaxed">{summary.shortSummary}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Detailed Narrative Summary
                    </span>
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900 text-slate-300 leading-relaxed whitespace-pre-line">
                      {summary.detailedSummary}
                    </div>
                  </div>

                  {summary.keyPoints && summary.keyPoints.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Key Points & Core Takeaways
                      </span>
                      <ul className="space-y-2">
                        {summary.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-slate-300 p-2 rounded-lg bg-slate-950/40 border border-slate-900">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.actionItems && summary.actionItems.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Action Items & Next Steps
                      </span>
                      <ul className="space-y-2">
                        {summary.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-slate-300 p-2 rounded-lg bg-slate-950/40 border border-slate-900">
                            <input type="checkbox" className="mt-0.5 rounded border-slate-700 text-brand-600 focus:ring-brand-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'keyMoments' && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-400" />
                Detected Key Moments
              </h3>

              {keyMoments.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'Detecting semantic video key moments...' : 'No key moments extracted.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {keyMoments.map((moment, idx) => (
                    <div
                      key={moment.id || idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-brand-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">{moment.title}</h4>
                        <button
                          onClick={() => seekTo(moment.startTime)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs font-semibold shadow-glow shadow-brand-500/10 transition-all"
                        >
                          <Play className="h-3 w-3 fill-white" />
                          {formatDuration(moment.startTime)} &rarr; {formatDuration(moment.endTime)}
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{moment.description}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900/80 text-[11px]">
                        <span className="text-slate-500">Relevance: <strong className="text-emerald-400">{Math.round((moment.relevanceScore || 0.9) * 100)}%</strong></span>
                        {moment.keywords && (
                          <span className="text-slate-400 italic truncate max-w-xs">{moment.keywords}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'keywords' && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-brand-400" />
                Keyword Cloud & Frequency Analysis
              </h3>

              {keywords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'Extracting keyword frequencies...' : 'No keywords extracted.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {keywords.map((kw, idx) => (
                    <div
                      key={kw.id || idx}
                      onClick={() => kw.timestamp && seekTo(kw.timestamp)}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-brand-500/30 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white text-xs block">{kw.keyword}</span>
                        <span className="text-[10px] text-slate-500">Relevance: {Math.round((kw.relevance || 0.8) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold border border-brand-500/20">
                          {kw.frequency}x
                        </span>
                        {kw.timestamp !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            @{formatDuration(kw.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-400" />
                Content & Speech Analytics
              </h3>

              {analytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                      <span className="text-slate-500 text-[11px] block">Word Count</span>
                      <span className="text-xl font-bold text-white">{analytics.wordCount}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                      <span className="text-slate-500 text-[11px] block">Speaking Pace</span>
                      <span className="text-xl font-bold text-brand-400">{analytics.wordsPerMinute} <small className="text-xs font-normal text-slate-500">wpm</small></span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                      <span className="text-slate-500 text-[11px] block">Key Moments</span>
                      <span className="text-xl font-bold text-white">{analytics.keyMomentsCount}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                      <span className="text-slate-500 text-[11px] block">Sentiment</span>
                      <span className="text-xl font-bold text-emerald-400">{Math.round(analytics.sentimentScore * 100)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'Compiling content metrics...' : 'Analytics data unavailable.'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="h-5 w-5 text-brand-400" />
                  Generated Highlight Report
                </h3>
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-all shadow-glow shadow-brand-500/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .md
                </button>
              </div>

              {report ? (
                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-900 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                  {report.content}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPipelineActive ? 'Compiling highlight report...' : 'No report generated.'}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};