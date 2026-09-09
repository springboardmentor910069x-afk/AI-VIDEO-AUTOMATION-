import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Video, Sparkles, Cpu, Eye, FileText, BarChart2, ShieldCheck, ArrowRight } from 'lucide-react';

export const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="relative isolate overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      
      {/* Visual Background Glow */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[120px] animate-pulse-slow"></div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 text-center">
        
        {/* Badge */}
        <div className="mx-auto mb-6 flex max-w-fit items-center justify-center space-x-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <span className="text-xs font-semibold tracking-wide text-brand-300 uppercase">
            Milestone 1 Ready - Live FFmpeg Pipeline
          </span>
        </div>

        {/* Hero Section */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl max-w-4xl mx-auto leading-tight">
          Next-Generation AI <br/>
          <span className="text-brand-gradient">Video Processing Platform</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
          Upload, parse metadata, generate previews, and orchestrate deep computer vision models. Built on a production-ready reactive Spring Boot backend and React microservice architecture.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex items-center justify-center gap-x-6">
          {user ? (
            <Link
              to="/dashboard"
              className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-glow shadow-brand-500/20 hover:shadow-brand-500/30 transition-all duration-200"
            >
              Go to Dashboard
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-glow shadow-brand-500/20 hover:shadow-brand-500/30 transition-all duration-200"
              >
                Start Processing Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="text-sm font-semibold leading-6 text-slate-300 hover:text-white px-6 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60 transition-all duration-200"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Engineered for Modern Media Pipelines
          </h2>
          <p className="mt-2 text-slate-500 text-sm">
            Core media handling today. Deep cognitive analysis tomorrow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          
          {/* Card 1: FFmpeg Metadata */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">FFmpeg Inspection</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Asynchronous container validation, precise resolution sniffing, duration matching, and video/audio stream codec detection.
              </p>
            </div>
          </div>

          {/* Card 2: Automatic Thumbnails */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Smart Thumbnails</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Automated screenshot extraction at optimal intervals (like 2 seconds or mid-duration) using low-latency fast seek pipelines.
              </p>
            </div>
          </div>

          {/* Card 3: Secure JWT Storage */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Spring Security & JWT</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Roles-based authorization (ADMIN / USER), CORS sandboxing, salt password hashing, and encrypted header payloads.
              </p>
            </div>
          </div>

          {/* Card 4: Upcoming speech-to-text (AI) */}
          <div className="glass-panel p-6 rounded-2xl opacity-60 border-dashed flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-2 right-2 bg-slate-900 border border-slate-800 text-[10px] text-brand-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Upcoming AI
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Speech-to-Text</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Deep Whisper speech indexing, diarization transcription models, and timestamped subtitle generation logs.
              </p>
            </div>
          </div>

          {/* Card 5: Scene segmentation (AI) */}
          <div className="glass-panel p-6 rounded-2xl opacity-60 border-dashed flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-2 right-2 bg-slate-900 border border-slate-800 text-[10px] text-brand-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Upcoming AI
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Scene Detection & OCR</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Cognitive camera cut segmentation, semantic boundary extraction, and text layout capture from overlays using OCR engines.
              </p>
            </div>
          </div>

          {/* Card 6: Summarization (AI) */}
          <div className="glass-panel p-6 rounded-2xl opacity-60 border-dashed flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-2 right-2 bg-slate-900 border border-slate-800 text-[10px] text-brand-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Upcoming AI
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Semantic Summary</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Video summarization algorithms matching natural language queries, custom script summaries, and object detections.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
