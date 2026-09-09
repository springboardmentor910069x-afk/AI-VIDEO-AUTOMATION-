import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  BarChart3, Video, Clock, FileText, Sparkles, Layers,
  Tag, CheckCircle2, AlertTriangle, Loader2, RefreshCw, ArrowUpRight
} from 'lucide-react';

export const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/analytics/dashboard');
      setData(res);
    } catch (err) {
      console.error(err);
      setError('Failed to load system intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatDuration = (sec) => {
    if (!sec || isNaN(sec)) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.round(sec % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-brand-400" />
            Intelligence Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time telemetry across Speech-to-Text accuracy, AI summarization throughput, and semantic moments.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-300 hover:text-white border border-slate-800 transition-all self-start"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-950/30 border border-rose-900/30 p-4 text-sm text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Video Ingests</p>
            <p className="mt-2 text-3xl font-bold text-white">{data?.totalVideos || 0}</p>
            <span className="text-[11px] text-emerald-400 font-medium">100% indexed</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Video className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Words Transcribed</p>
            <p className="mt-2 text-3xl font-bold text-white">{data?.totalTranscriptWords?.toLocaleString() || 0}</p>
            <span className="text-[11px] text-brand-400 font-medium">Whisper STT Engine</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Summaries Synthesized</p>
            <p className="mt-2 text-3xl font-bold text-white">{data?.totalSummaries || 0}</p>
            <span className="text-[11px] text-emerald-400 font-medium">NLP High Accuracy</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semantic Key Moments</p>
            <p className="mt-2 text-3xl font-bold text-white">{data?.totalKeyMoments || 0}</p>
            <span className="text-[11px] text-amber-400 font-medium">Timestamp Synchronized</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Layers className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Two Column Layout: Pipeline Status & Top Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Pipeline Throughput (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-6">
          <h3 className="text-base font-bold text-white">Pipeline Execution Status</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Completed
                </span>
                <span className="text-slate-400">{data?.completedVideos || 0} / {data?.totalVideos || 0}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(data?.totalVideos || 0) > 0 ? ((data?.completedVideos || 0) / data.totalVideos) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin" /> Processing & Queued
                </span>
                <span className="text-slate-400">{data?.processingVideos || 0} / {data?.totalVideos || 0}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(data?.totalVideos || 0) > 0 ? ((data?.processingVideos || 0) / data.totalVideos) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <AlertTriangle className="h-4 w-4 text-rose-400" /> Failed
                </span>
                <span className="text-slate-400">{data?.failedVideos || 0} / {data?.totalVideos || 0}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(data?.totalVideos || 0) > 0 ? ((data?.failedVideos || 0) / data.totalVideos) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-900">
              <span className="text-slate-500 block">Total Audio Runtime</span>
              <span className="text-slate-200 font-bold text-sm mt-0.5 block">{formatDuration(data?.totalDuration)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-900">
              <span className="text-slate-500 block">Average Duration</span>
              <span className="text-slate-200 font-bold text-sm mt-0.5 block">{formatDuration(data?.avgDuration)}</span>
            </div>
          </div>
        </div>

        {/* Right: Top Extracted Keywords (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand-400" />
            Top System-Wide Keywords
          </h3>

          {!data?.topPlatformKeywords || data.topPlatformKeywords.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No platform keywords generated yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.topPlatformKeywords.map((kw, idx) => (
                <div
                  key={kw.id || idx}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{kw.keyword}</span>
                    <span className="text-[10px] text-slate-500">Relevance: {Math.round((kw.relevance || 0.8) * 100)}%</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 font-bold text-xs border border-brand-500/20">
                    {kw.frequency}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};