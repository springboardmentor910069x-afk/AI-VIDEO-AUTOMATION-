import React, { Component, ErrorInfo, ReactNode, createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './components/AuthPage'
import DashboardShell from './components/DashboardShell'
import UploadStudio from './components/UploadStudio'
import VideoLibrary from './components/VideoLibrary'
import VideoIntelligenceCenter from './components/VideoIntelligenceCenter'
import LearnerStudyRoom from './components/LearnerStudyRoom'
import LearnerDashboard from './components/LearnerDashboard'
import AdminDashboard from './components/AdminDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import EducatorEditor from './components/EducatorEditor'
import BookmarksPage from './components/BookmarksPage'
import SettingsPage from './components/SettingsPage'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: React.ReactElement }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('clipmind-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
    }
    localStorage.setItem('clipmind-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

type Role = 'Creator' | 'Learner' | 'Educator' | 'Admin'

function getActiveUserRole(): Role {
  try {
    const storedUser = localStorage.getItem('clipmind_user')
    if (storedUser) {
      const u = JSON.parse(storedUser)
      if (u.role === 'Admin') {
        const saved = localStorage.getItem('clipmind_active_role') as Role | null
        if (saved) return saved
      }
      if (u.role) return u.role as Role
    }
  } catch (e) {}
  const saved = localStorage.getItem('clipmind_active_role') as Role | null
  if (saved) return saved
  return 'Creator'
}

function RoleDashboardIndex() {
  const activeRole = getActiveUserRole()
  if (activeRole === 'Learner') return <LearnerDashboard />
  if (activeRole === 'Educator') return <EducatorEditor />
  if (activeRole === 'Admin') return <AdminDashboard />
  return <VideoLibrary />
}

function AuthGuard({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem('clipmind_access_token')
  const user = localStorage.getItem('clipmind_user')

  // Require BOTH a valid token AND stored user data
  if (!token || !user) {
    // Clear any stale/partial data
    if (!token && user) {
      localStorage.removeItem('clipmind_user')
      localStorage.removeItem('clipmind_active_role')
    }
    return <Navigate to="/login" replace />
  }
  return children
}

function RoleGuard({ allowedRoles, children }: { allowedRoles: Role[]; children: React.ReactElement }) {
  let authRole: Role = 'Creator'
  try {
    const storedUser = localStorage.getItem('clipmind_user')
    if (storedUser) {
      const u = JSON.parse(storedUser)
      if (u.role) authRole = u.role as Role
    }
  } catch (e) {}

  // Admin always has access to all views
  if (authRole === 'Admin') {
    return children
  }

  const activeRole = getActiveUserRole()
  if (!allowedRoles.includes(activeRole)) {
    if (activeRole === 'Learner') return <Navigate to="/dashboard/learner/study" replace />
    if (activeRole === 'Educator') return <Navigate to="/dashboard/educator/lectures" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              {/* Direct App Root */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />


              {/* Dashboard (authenticated shell) */}
              <Route path="/dashboard" element={
                <AuthGuard>
                  <DashboardShell />
                </AuthGuard>
              }>
                <Route index element={<RoleDashboardIndex />} />
                <Route path="upload" element={
                  <RoleGuard allowedRoles={['Learner', 'Creator', 'Educator', 'Admin']}>
                    <UploadStudio />
                  </RoleGuard>
                } />
                <Route path="videos" element={<VideoLibrary />} />
                <Route path="videos/:id" element={<VideoIntelligenceCenter />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="bookmarks" element={<BookmarksPage />} />
                <Route path="settings" element={<SettingsPage />} />

                {/* Role specific primary routes inside DashboardShell */}
                <Route path="learner" element={
                  <RoleGuard allowedRoles={['Learner', 'Admin', 'Creator', 'Educator']}>
                    <LearnerDashboard />
                  </RoleGuard>
                } />
                <Route path="learner/dashboard" element={
                  <RoleGuard allowedRoles={['Learner', 'Admin', 'Creator', 'Educator']}>
                    <LearnerDashboard />
                  </RoleGuard>
                } />
                <Route path="learner/study" element={
                  <RoleGuard allowedRoles={['Learner', 'Admin', 'Creator', 'Educator']}>
                    <LearnerStudyRoom />
                  </RoleGuard>
                } />
                <Route path="learner/study/:id" element={
                  <RoleGuard allowedRoles={['Learner', 'Admin', 'Creator', 'Educator']}>
                    <LearnerStudyRoom />
                  </RoleGuard>
                } />
                <Route path="educator/lectures" element={
                  <RoleGuard allowedRoles={['Educator', 'Admin', 'Creator']}>
                    <EducatorEditor />
                  </RoleGuard>
                } />
                <Route path="educator/lectures/:id/edit" element={
                  <RoleGuard allowedRoles={['Educator', 'Admin', 'Creator']}>
                    <EducatorEditor />
                  </RoleGuard>
                } />
                <Route path="educator/editor/:id" element={
                  <RoleGuard allowedRoles={['Educator', 'Admin', 'Creator']}>
                    <EducatorEditor />
                  </RoleGuard>
                } />
                <Route path="admin" element={
                  <RoleGuard allowedRoles={['Admin']}>
                    <AdminDashboard />
                  </RoleGuard>
                } />
                <Route path="admin/dashboard" element={
                  <RoleGuard allowedRoles={['Admin']}>
                    <AdminDashboard />
                  </RoleGuard>
                } />
              </Route>

              {/* Legacy direct top-level paths redirect inside DashboardShell */}
              <Route path="/learner/study" element={<Navigate to="/dashboard/learner/study" replace />} />
              <Route path="/learner/study/:id" element={<Navigate to="/dashboard/learner/study" replace />} />
              <Route path="/educator/lectures" element={<Navigate to="/dashboard/educator/lectures" replace />} />
              <Route path="/educator/lectures/:id/edit" element={<Navigate to="/dashboard/educator/lectures" replace />} />
              <Route path="/educator/editor/:id" element={<Navigate to="/dashboard/educator/lectures" replace />} />
              <Route path="/dashboard/educator/editor/:id" element={<Navigate to="/dashboard/educator/lectures" replace />} />
              <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </ToastProvider>
  )
}

