import React from 'react';

export const Footer = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-900 py-6 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} ClipMind AI. All rights reserved.</p>
        <p className="mt-1 text-xs text-slate-600">
          Built with React, Spring Boot, MySQL, and FFmpeg for Advanced AI Video Processing.
        </p>
      </div>
    </footer>
  );
};
