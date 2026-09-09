import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  FileText, Download, Eye, Video, Clock, ArrowRight,
  AlertTriangle, Loader2, RefreshCw, CheckCircle2
} from 'lucide-react';

export const Reports = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/videos');
      setVideos(data.filter(v => v.status === 'COMPLETED'));
    } catch (err) {
      console.error(err);
      setError('Failed to load completed video reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handlePreviewReport = async (videoId) => {
    try {
      setReportLoading(true);
      const rep = await api.get(`/videos/${videoId}/report`);
      setSelectedReport(rep);
    } catch (err) {
      alert('Could not preview report: ' + err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownload = (videoId) => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/videos/${videoId}/report/download?token=${token}`, '_blank');
  };

  const formatDuration = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl flex items-center gap-3">
            <FileText className="h-7 w-7 text-brand-400" />
            Intelligence Reports Repository
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Export and preview comprehensive AI highlight dossiers and technical video intelligence summaries.
          </p>
        </div>
        <button
          onClick={fetchVideos}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-300 hover:text-white border border-slate-800 transition-all self-start"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-950/30 border border-rose-900/30 p-4 text-sm text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : videos.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4 max-w-md mx-auto">
          <FileText className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Generated Reports</h3>
          <p className="text-xs text-slate-500">
            Upload and complete processing of a video to generate automated intelligence reports.
          </p>
          <Link to="/upload" className="inline-flex items-center gap-2 bg-brand-600 px-4 py-2 rounded-xl text-xs font-semibold text-white">
            Upload Video
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Reports List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Reports</h3>
            {videos.map(video => (
              <div
                key={video.id}
                className="glass-panel p-4 rounded-xl space-y-3 border border-slate-900 hover:border-brand-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-sm truncate" title={video.title}>{video.title}</h4>
                  <span className="shrink-0 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono"><Clock className="h-3 w-3" /> {formatDuration(video.duration)}</span>
                  <span>&bull;</span>
                  <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreviewReport(video.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <button
                      onClick={() => handleDownload(video.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors"
                    >
                      <Download className="h-3 w-3" /> .md
                    </button>
                  </div>
                  <Link
                    to={`/videos/${video.id}`}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                  >
                    Open Hub <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Report Preview Panel (7 cols) */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-400" />
                {selectedReport ? selectedReport.videoTitle : 'Report Live Preview'}
              </h3>
              {selectedReport && (
                <button
                  onClick={() => handleDownload(selectedReport.videoId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-glow shadow-brand-500/10 transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Download Report
                </button>
              )}
            </div>

            {reportLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              </div>
            ) : selectedReport ? (
              <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-900 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {selectedReport.content}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs">
                Select a report from the list on the left to preview its full formatted contents.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};