import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Video, Play, CheckCircle2, AlertTriangle, Loader2,
  UploadCloud, Settings, Database, Cpu, Sparkles, FileText,
  Layers, BarChart3, ArrowRight, Clock, Tag
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [videosData, analyticsData] = await Promise.all([
          api.get('/videos').catch(() => []),
          api.get('/analytics/dashboard').catch(() => null)
        ]);
        setVideos(videosData);
        setAnalytics(analyticsData);
      } catch (err) {
        setError('Failed to load dashboard metrics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalVideos = videos.length;
  const completedVideos = videos.filter(v => v.status === 'COMPLETED').length;
  const processingVideos = videos.filter(v => ['UPLOADED', 'QUEUED', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING', 'ANALYZING', 'PENDING'].includes(v.status)).length;
  const failedVideos = videos.filter(v => v.status === 'FAILED').length;

  const totalDuration = videos
    .filter(v => v.duration)
    .reduce((sum, v) => sum + v.duration, 0);

  const formatDuration = (sec) => {
    if (!sec || isNaN(sec)) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.round(sec % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalStorageBytes = videos.reduce((sum, v) => sum + (v.fileSize || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl tracking-tight">
            Welcome back, <span className="text-gradient font-extrabold">{user?.username}</span>!
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            ClipMind AI Video Intelligence Platform &bull; FFmpeg Processing, Whisper STT & NLP Summaries.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap md:ml-4 md:mt-0 gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow shadow-brand-500/10 hover:shadow-brand-500/20 transition-all"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            Intelligence Analytics
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            
            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Video Ingests</p>
                <p className="mt-2 text-3xl font-bold text-white">{totalVideos}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">{formatSize(totalStorageBytes)} stored</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                <Video className="h-6 w-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Words Transcribed</p>
                <p className="mt-2 text-3xl font-bold text-white">{analytics?.totalTranscriptWords?.toLocaleString() || 0}</p>
                <span className="text-[11px] text-emerald-400 font-medium mt-1 block">Whisper Speech-to-Text</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <FileText className="h-6 w-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Summaries</p>
                <p className="mt-2 text-3xl font-bold text-white">{completedVideos}</p>
                <span className="text-[11px] text-emerald-400 font-medium mt-1 block">Multi-tiered NLP</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semantic Key Moments</p>
                <p className="mt-2 text-3xl font-bold text-white">{analytics?.totalKeyMoments || 0}</p>
                <span className="text-[11px] text-amber-400 font-medium mt-1 block">Chapter Indexing</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Layers className="h-6 w-6" />
              </div>
            </div>

          </div>

          {/* Grid: Pipeline Status Breakdown & Roadmap */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Pipeline Breakdown (2 cols) */}
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Media Pipeline Status</h3>
                <Link to="/videos" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
                  View All Videos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Completed
                    </span>
                    <span className="text-slate-400">{completedVideos} / {totalVideos}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" /> Processing & Active Pipelines
                    </span>
                    <span className="text-slate-400">{processingVideos} / {totalVideos}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalVideos > 0 ? (processingVideos / totalVideos) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <AlertTriangle className="h-4 w-4 text-rose-400" /> Failed Tasks
                    </span>
                    <span className="text-slate-400">{failedVideos} / {totalVideos}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalVideos > 0 ? (failedVideos / totalVideos) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Recent Ingests List */}
              {videos.length > 0 && (
                <div className="pt-4 border-t border-slate-900 space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Recent Video Uploads
                  </span>
                  <div className="space-y-2">
                    {videos.slice(0, 3).map(v => (
                      <div
                        key={v.id}
                        onClick={() => navigate(`/videos/${v.id}`)}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-brand-500/30 cursor-pointer transition-all flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-brand-400">
                            <Video className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">{v.title}</span>
                            <span className="text-[10px] text-slate-500">{formatDuration(v.duration)} &bull; {v.resolution}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          v.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          v.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Architecture Capabilities (1 col) */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Cpu className="h-5 w-5 text-brand-400" />
                  ClipMind AI Engine Status
                </h3>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">FFmpeg Audio Extraction</h4>
                      <p className="text-[11px] text-slate-400">16kHz PCM audio normalization & scene slicing.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">Whisper Speech-to-Text</h4>
                      <p className="text-[11px] text-slate-400">Timestamped multi-language transcription segments.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">AI Intelligence Summarizer</h4>
                      <p className="text-[11px] text-slate-400">Executive, detailed, takeaways & actionable checklists.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">Key Moments & Keywords</h4>
                      <p className="text-[11px] text-slate-400">Semantic chapters and TF-IDF relevance indexing.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-200">Reports & Export Engine</h4>
                      <p className="text-[11px] text-slate-400">Markdown, PDF and JSON dossier generation.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Milestones 1-4 Active
                </span>
                <span className="flex items-center gap-1 text-brand-400">
                  <Sparkles className="h-3 w-3" /> JWT Auth Ready
                </span>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};