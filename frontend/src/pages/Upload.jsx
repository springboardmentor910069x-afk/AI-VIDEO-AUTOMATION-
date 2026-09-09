import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UploadCloud, FileVideo, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export const Upload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [error, setError] = useState('');
  const [uploadedVideoId, setUploadedVideoId] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    // Check if video file
    if (!selectedFile.type.startsWith('video/')) {
      setError('Unsupported file type. Please select a valid video file.');
      return;
    }

    // Limit to 500MB
    const maxSizeBytes = 500 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      setError('File size exceeds the 500MB maximum upload limit.');
      return;
    }

    setFile(selectedFile);
    // Populate title from filename by stripping the extension
    const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
    setTitle(baseName);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a title for your video.');
      return;
    }

    setLoading(true);
    setStatus('uploading');
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);

    try {
      // Stream file to Spring Boot upload endpoint, passing progress hook
      const result = await api.upload('/videos/upload', formData, (percent) => {
        setProgress(percent);
        if (percent === 100) {
          setStatus('processing'); // Backend takes over to run FFmpeg async tasks
        }
      });
      
      setUploadedVideoId(result.id);
      setStatus('completed');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError(err.message || 'An error occurred during video upload. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setProgress(0);
    setStatus('idle');
    setError('');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl">
          Upload Video Asset
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload local mp4, mkv, or webm streams. ClipMind AI will automatically compile FFmpeg container indexes.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-950/30 border border-rose-900/30 p-4 text-sm text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {status === 'completed' ? (
        <div className="glass-panel p-8 rounded-2xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Upload and Registration Successful!</h3>
            <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
              Your video has been saved on the host storage disk. The FFmpeg worker is extracting codecs, metadata, and scene thumbnails in the background.
            </p>
          </div>
          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={clearForm}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 text-sm font-semibold text-slate-300 transition-all"
            >
              Upload Another
            </button>
            <button
              onClick={() => navigate('/videos')}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 px-5 py-2.5 rounded-xl font-semibold text-white shadow-glow shadow-brand-500/10 hover:shadow-brand-500/20 transition-all"
            >
              View In Library
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
              ${dragActive ? 'border-brand-500 bg-brand-500/5' : 'border-slate-800 bg-slate-900/10 hover:bg-slate-900/20'}
              ${file ? 'border-slate-700 bg-slate-900/20' : ''}
            `}
            onClick={handleButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleChange}
              disabled={loading}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              {file ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
                    <FileVideo className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB - Ready to upload
                    </p>
                  </div>
                  <span className="text-xs text-brand-400 underline font-semibold hover:text-brand-300">
                    Replace File
                  </span>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/40 text-slate-400">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Drag & drop your video file here</p>
                    <p className="text-xs text-slate-500 mt-1">
                      or click to browse local folders
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Supported formats: MP4, MKV, WEBM (Max 500MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Form details, show only if file selected */}
          {file && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5">
                  Video Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  className="form-input"
                  placeholder="Enter a title for this video"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Write a description or notes about this video..."
                />
              </div>

              {/* Progress and status indicators */}
              {status === 'uploading' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-brand-400 flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading asset to storage...
                    </span>
                    <span className="text-slate-300">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-brand-500 h-1.5 rounded-full transition-all duration-150" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {status === 'processing' && (
                <div className="flex items-center justify-center gap-2.5 py-4 border border-brand-500/20 bg-brand-500/5 rounded-xl text-brand-300 text-sm font-medium">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                  File received. Triggering background FFmpeg metadata extraction...
                </div>
              )}

              {status !== 'uploading' && status !== 'processing' && (
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-4 rounded-xl shadow-glow shadow-brand-500/10 hover:shadow-brand-500/20 transition-all duration-200"
                  >
                    Start Upload Pipeline
                  </button>
                </div>
              )}
            </div>
          )}

        </form>
      )}

    </div>
  );
};
