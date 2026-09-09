import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { User, Mail, Shield, Calendar, Database, Video, AlertCircle } from 'lucide-react';

export const Profile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalVideos: 0, totalSize: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const videos = await api.get('/videos');
        const size = videos.reduce((sum, v) => sum + (v.fileSize || 0), 0);
        setStats({
          totalVideos: videos.length,
          totalSize: size
        });
      } catch (err) {
        console.error('Failed to load profile statistics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRoleLabel = (roleName) => {
    if (roleName === 'ROLE_ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25 text-xs font-bold uppercase tracking-wider">
          <Shield className="h-3.5 w-3.5" />
          Administrator
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/25 text-xs font-bold uppercase tracking-wider">
        <User className="h-3.5 w-3.5" />
        Standard User
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl">
          Account Profile
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Manage your security settings, verify roles, and check disk occupancy statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-2xl md:col-span-2 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Avatar Row */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow flex items-center justify-center text-white font-bold text-2xl uppercase shadow-brand-500/20">
                {user?.username.substring(0, 2)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.username}</h3>
                <p className="text-xs text-slate-500 mt-1">ID Ref: #CM-{user?.id || 1}</p>
              </div>
            </div>

            <div className="h-px bg-slate-900"></div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Username</span>
                <div className="flex items-center gap-2 text-sm text-slate-200 bg-slate-950/40 border border-slate-900 rounded-lg p-2.5">
                  <User className="h-4 w-4 text-slate-500" />
                  {user?.username}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Email Address</span>
                <div className="flex items-center gap-2 text-sm text-slate-200 bg-slate-950/40 border border-slate-900 rounded-lg p-2.5">
                  <Mail className="h-4 w-4 text-slate-500" />
                  {user?.email}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Authority Level</span>
                <div className="pt-1 flex">
                  {getRoleLabel(user?.role)}
                </div>
              </div>

            </div>

          </div>

          <div className="flex items-start gap-2 bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 mt-4 leading-relaxed">
            <AlertCircle className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            <p>
              To change password, modify credentials, or register administrative tokens, please contact your systems operations administrator. Role designations are verified against HMAC database credentials.
            </p>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">Library Stats</h3>
            
            <div className="space-y-4">
              
              {/* Stat 1 */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Uploaded Assets</span>
                  <span className="text-sm font-bold text-white">
                    {loading ? '...' : stats.totalVideos} Videos
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Disk Occupancy</span>
                  <span className="text-sm font-bold text-white">
                    {loading ? '...' : formatSize(stats.totalSize)}
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Member session verified in 2026
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
