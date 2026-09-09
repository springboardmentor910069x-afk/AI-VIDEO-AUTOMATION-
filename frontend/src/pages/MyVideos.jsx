import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Video, Play, Trash2, Clock, CheckCircle2,
  Loader2, AlertTriangle, Search, Sparkles, ArrowRight, UploadCloud
} from 'lucide-react';

export const MyVideos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  const fetchVideos = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await api.get('/videos');
      setVideos(data);
    } catch (err) {
      setError('Could not retrieve video library.');
      console.error(err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos(true);
  }, []);

  useEffect(() => {
    const hasActiveTasks = videos.some(
      v => ['UPLOADED', 'QUEUED', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING', 'ANALYZING', 'PENDING'].includes(v.status)
    );

    if (!hasActiveTasks) return;

    const interval = setInterval(() => {
      fetchVideos(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [videos]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this video and its intelligence data?')) {
      return;
    }

    try {
      await api.delete(`/videos/${id}`);
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert('Delete operation failed: ' + err.message);
    }
  };

  const formatDuration = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredVideos = videos.filter(v =>
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-white sm:text-3xl tracking-tight">
            My Videos & Intelligence Library
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Select any video asset to inspect Whisper transcripts, AI summaries, semantic moments, and reports.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow shadow-brand-500/10 transition-all self-start"
        >
          <UploadCloud className="h-4 w-4" />
          Upload New Video
        </Link>
      </div>

      {/* Search Filter Bar */}
      {videos.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or description..."
            className="form-input pl-10 text-xs"
          />
        </div>
      )}

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
      ) : filteredVideos.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4 max-w-md mx-auto">
          <div className="mx-auto h-12 w-12 rounded-xl bg-slate-800/40 flex items-center justify-center text-slate-500">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No video assets found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm ? 'No matches found for your search query.' : 'Start by uploading your first video to generate AI intelligence.'}
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => navigate(`/videos/${video.id}`)}
              className="glass-panel rounded-2xl overflow-hidden group border border-slate-900/80 hover:border-brand-500/40 hover:shadow-xl cursor-pointer transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Container */}
                <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center border-b border-slate-900">
                  {video.status === 'COMPLETED' ? (
                    <>
                      <img
                        src={`${API_BASE}/videos/${video.id}/thumbnail?token=${user?.token}`}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="hidden absolute inset-0 bg-slate-900 items-center justify-center">
                        <Video className="h-8 w-8 text-slate-700" />
                      </div>

                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                        <div className="h-12 w-12 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow">
                          <Play className="h-5 w-5 fill-white translate-x-0.5" />
                        </div>
                      </div>

                      <span className="absolute bottom-2 right-2 bg-slate-950/80 text-[11px] font-semibold text-white px-2 py-0.5 rounded backdrop-blur">
                        {formatDuration(video.duration)}
                      </span>
                    </>
                  ) : video.status === 'FAILED' ? (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                      <AlertTriangle className="h-8 w-8 text-rose-500" />
                      <span className="text-xs font-semibold text-rose-400">Processing Failed</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                      <span className="text-xs font-semibold text-amber-400">
                        {video.status === 'TRANSCRIBING' ? 'Transcribing (Whisper)...' :
                         video.status === 'SUMMARIZING' ? 'Generating AI Summary...' :
                         video.status === 'ANALYZING' ? 'Analyzing Key Moments...' :
                         'Processing Video...'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-base truncate group-hover:text-brand-400 transition-colors" title={video.title}>
                      {video.title}
                    </h4>
                    <button
                      onClick={(e) => handleDelete(video.id, e)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900/80 transition-colors shrink-0"
                      title="Delete Video"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                    {video.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                    <div className="flex flex-col">
                      <span className="text-slate-500">Codec</span>
                      <span className="text-slate-300 font-semibold truncate">{video.codec || 'h264'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Resolution</span>
                      <span className="text-slate-300 font-semibold">{video.resolution || '1920x1080'}</span>
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="text-slate-500">Size</span>
                      <span className="text-slate-300 font-semibold">{formatSize(video.fileSize)}</span>
                    </div>
                    <div className="flex flex-col mt-1">
                      <span className="text-slate-500">Status</span>
                      <span className={`font-semibold uppercase tracking-wider ${
                        video.status === 'COMPLETED' ? 'text-emerald-400' :
                        video.status === 'FAILED' ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        {video.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer action */}
              <div className="p-4 bg-slate-950/40 border-t border-slate-900 flex items-center justify-between text-xs">
                <span className="text-slate-500">{new Date(video.createdAt).toLocaleDateString()}</span>
                <span className="text-brand-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Open Hub <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};