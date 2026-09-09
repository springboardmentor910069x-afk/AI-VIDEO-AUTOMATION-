import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Video, Upload, User, LogOut, LayoutDashboard, Menu, X, Cpu, BarChart3, FileText, ShieldAlert } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const isAdmin = user && (user.role === 'ROLE_ADMIN' || user.role === 'ADMIN');

  const linkClass = (path) => `
    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
    ${isActive(path) 
      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' 
      : 'text-slate-300 hover:bg-slate-900/60 hover:text-white border border-transparent'}
  `;

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-x-0 border-t-0 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">
              ClipMind<span className="text-brand-400">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link to="/dashboard" className={linkClass('/dashboard')}>
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
                <Link to="/upload" className={linkClass('/upload')}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Link>
                <Link to="/videos" className={linkClass('/videos')}>
                  <Video className="h-3.5 w-3.5" />
                  Library
                </Link>
                <Link to="/analytics" className={linkClass('/analytics')}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Analytics
                </Link>
                <Link to="/reports" className={linkClass('/reports')}>
                  <FileText className="h-3.5 w-3.5" />
                  Reports
                </Link>
                {isAdmin && (
                  <Link to="/admin/users" className={linkClass('/admin/users')}>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    Admin
                  </Link>
                )}
                <Link to="/profile" className={linkClass('/profile')}>
                  <User className="h-3.5 w-3.5" />
                  Profile
                </Link>
                <div className="h-4 w-px bg-slate-800 mx-1"></div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all duration-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-300 hover:text-white transition-colors duration-200 px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-glow shadow-brand-500/10 hover:shadow-brand-500/20 transition-all duration-200"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Hamburger Menu Toggle (Mobile) */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 pt-2 pb-4 space-y-2 text-xs">
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setIsOpen(false)} className={linkClass('/dashboard')}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link to="/upload" onClick={() => setIsOpen(false)} className={linkClass('/upload')}>
                <Upload className="h-4 w-4" />
                Upload
              </Link>
              <Link to="/videos" onClick={() => setIsOpen(false)} className={linkClass('/videos')}>
                <Video className="h-4 w-4" />
                Library
              </Link>
              <Link to="/analytics" onClick={() => setIsOpen(false)} className={linkClass('/analytics')}>
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <Link to="/reports" onClick={() => setIsOpen(false)} className={linkClass('/reports')}>
                <FileText className="h-4 w-4" />
                Reports
              </Link>
              {isAdmin && (
                <Link to="/admin/users" onClick={() => setIsOpen(false)} className={linkClass('/admin/users')}>
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  Admin
                </Link>
              )}
              <Link to="/profile" onClick={() => setIsOpen(false)} className={linkClass('/profile')}>
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={() => { setIsOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="flex justify-center text-xs font-semibold text-slate-300 hover:text-white py-2"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="flex justify-center bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

