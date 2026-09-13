import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import CommandPalette from './CommandPalette'
import { api } from '../services/api'
import { useToast } from './Toast'

type Role = 'Creator' | 'Learner' | 'Educator' | 'Admin'

interface NavItem {
  icon: string
  label: string
  path: string
}

const ROLE_NAV_ITEMS: Record<Role, NavItem[]> = {
  Creator: [
    { icon: '🏠', label: 'Overview', path: '/dashboard' },
    { icon: '📤', label: 'Upload Studio', path: '/dashboard/upload' },
    { icon: '🎥', label: 'Video Library', path: '/dashboard/videos' },
    { icon: '🤖', label: 'AI Chatbot', path: '/dashboard/learner/study' },
    { icon: '🔖', label: 'Bookmarks', path: '/dashboard/bookmarks' },
    { icon: '📊', label: 'Analytics', path: '/dashboard/analytics' },
    { icon: '⚙️', label: 'Settings', path: '/dashboard/settings' },
  ],
  Learner: [
    { icon: '🎓', label: 'AI Study & Chat', path: '/dashboard/learner/study' },
    { icon: '📤', label: 'Upload Video', path: '/dashboard/upload' },
    { icon: '🎥', label: 'My Lectures', path: '/dashboard/videos' },
    { icon: '🔖', label: 'Study Notes', path: '/dashboard/bookmarks' },
    { icon: '📊', label: 'Learning Stats', path: '/dashboard/analytics' },
    { icon: '⚙️', label: 'Settings', path: '/dashboard/settings' },
  ],
  Educator: [
    { icon: '✏️', label: 'Lecture Studio', path: '/dashboard/educator/lectures' },
    { icon: '📤', label: 'Upload Lecture', path: '/dashboard/upload' },
    { icon: '🎥', label: 'Course Content', path: '/dashboard/videos' },
    { icon: '🤖', label: 'AI Chatbot', path: '/dashboard/learner/study' },
    { icon: '📊', label: 'Student Analytics', path: '/dashboard/analytics' },
    { icon: '⚙️', label: 'Settings', path: '/dashboard/settings' },
  ],
  Admin: [
    { icon: '🛡️', label: 'Admin Console', path: '/dashboard/admin' },
    { icon: '🎥', label: 'Video Catalog', path: '/dashboard/videos' },
    { icon: '🤖', label: 'AI Chatbot', path: '/dashboard/learner/study' },
    { icon: '📊', label: 'System Analytics', path: '/dashboard/analytics' },
    { icon: '⚙️', label: 'Settings', path: '/dashboard/settings' },
  ],
}

const ROLE_BADGES: Record<Role, { title: string; color: string }> = {
  Creator: { title: 'Creator', color: 'var(--accent-indigo)' },
  Learner: { title: 'Learner', color: 'var(--accent-cyan)' },
  Educator: { title: 'Educator', color: 'var(--accent-emerald)' },
  Admin: { title: 'Administrator', color: 'var(--accent-rose)' },
}

interface Notification {
  id: number
  text: string
  time: string
  read: boolean
  type: 'success' | 'error' | 'info'
}

export default function DashboardShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { showToast } = useToast()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Dynamic user profile state from logged-in user session
  const [userName, setUserName] = useState<string>(() => {
    try {
      const storedUser = localStorage.getItem('clipmind_user')
      if (storedUser) {
        const u = JSON.parse(storedUser)
        if (u.name) return u.name
        if (u.email) return u.email.split('@')[0]
      }
    } catch (e) { }
    return 'ClipMind User'
  })


  // Authenticated user's real backend role
  const [authenticatedRole, setAuthenticatedRole] = useState<Role>(() => {
    try {
      const storedUser = localStorage.getItem('clipmind_user')
      if (storedUser) {
        const u = JSON.parse(storedUser)
        if (u.role && (u.role in ROLE_NAV_ITEMS)) return u.role as Role
      }
    } catch (e) { }
    return 'Creator'
  })

  // Load initial role prioritizing the authenticated user's assigned role
  const [activeRole, setActiveRole] = useState<Role>(() => {
    try {
      const storedUser = localStorage.getItem('clipmind_user')
      if (storedUser) {
        const u = JSON.parse(storedUser)
        if (u.role && (u.role in ROLE_NAV_ITEMS)) {
          if (u.role !== 'Admin') return u.role as Role
        }
      }
    } catch (e) { }
    const savedRole = localStorage.getItem('clipmind_active_role') as Role | null
    if (savedRole && (savedRole in ROLE_NAV_ITEMS)) return savedRole
    return 'Creator'
  })

  useEffect(() => {
    async function syncUser() {
      const token = localStorage.getItem('clipmind_access_token')
      if (!token) {
        // No token — clear everything and go to login
        localStorage.removeItem('clipmind_user')
        localStorage.removeItem('clipmind_active_role')
        navigate('/login')
        return
      }
      try {
        // Validate token against the real backend
        const u = await api.getMe()
        if (u && u.name) {
          setUserName(u.name)
          localStorage.setItem('clipmind_user', JSON.stringify(u))
          if (u.role && (u.role in ROLE_NAV_ITEMS)) {
            setAuthenticatedRole(u.role as Role)
            if (u.role !== 'Admin') {
              setActiveRole(u.role as Role)
              localStorage.setItem('clipmind_active_role', u.role)
            }
          }
        }
      } catch (e: any) {
        // Token is invalid or expired — sign out
        const status = e?.status || (e?.message?.includes('401') ? 401 : 0)
        if (status === 401 || status === 403 || e?.message?.includes('401') || e?.message?.includes('403')) {
          localStorage.removeItem('clipmind_access_token')
          localStorage.removeItem('clipmind_user')
          localStorage.removeItem('clipmind_active_role')
          navigate('/login')
        } else {
          // Network error — use cached user data (offline tolerance)
          try {
            const stored = localStorage.getItem('clipmind_user')
            if (stored) {
              const u = JSON.parse(stored)
              if (u.name) setUserName(u.name)
              if (u.role && (u.role in ROLE_NAV_ITEMS)) {
                setAuthenticatedRole(u.role as Role)
                if (u.role !== 'Admin') {
                  setActiveRole(u.role as Role)
                  localStorage.setItem('clipmind_active_role', u.role)
                }
              }
            }
          } catch (err) { }
        }
      }
    }
    syncUser()
  }, [])

  const userInitials = (() => {
    if (!userName) return 'U'
    const parts = userName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  })()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSignOut = () => {
    showToast('Signed out successfully', 'info')
    localStorage.removeItem('clipmind_access_token')
    localStorage.removeItem('clipmind_user')
    localStorage.removeItem('clipmind_active_role')
    navigate('/login')
  }

  const handleRoleSelect = (role: Role) => {
    if (authenticatedRole !== 'Admin') {
      showToast('Workspace switching is restricted to Administrators', 'error')
      return
    }
    setActiveRole(role)
    localStorage.setItem('clipmind_active_role', role)
    setRoleDropdownOpen(false)

    // Navigate to primary route for the role
    const primaryPath = ROLE_NAV_ITEMS[role][0].path
    showToast(`Switched to ${role} workspace`, 'success')
    navigate(primaryPath)
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    showToast('All notifications marked as read', 'success')
  }

  const currentPath = location.pathname

  // Build breadcrumbs dynamically based on path
  const buildBreadcrumbs = (): string[] => {
    const roleBadge = ROLE_BADGES[activeRole]
    if (currentPath === '/dashboard') return ['Dashboard']
    if (currentPath === '/dashboard/upload') return ['Dashboard', 'Upload Studio']
    if (currentPath === '/dashboard/videos') return ['Dashboard', 'Video Library']
    if (currentPath.startsWith('/dashboard/videos/')) {
      const videoId = params.id || 'Video'
      const displayName = videoId === 'demo' ? 'Demo Lecture' : videoId.length > 12 ? `${videoId.substring(0, 8)}...` : videoId
      return ['Dashboard', 'Video Library', displayName]
    }
    if (currentPath === '/dashboard/bookmarks') return ['Dashboard', activeRole === 'Learner' ? 'Study Notes' : 'Bookmarks']
    if (currentPath === '/dashboard/analytics') return ['Dashboard', 'Analytics']
    if (currentPath === '/dashboard/settings') return ['Dashboard', 'Settings']
    if (currentPath.startsWith('/dashboard/learner')) return ['Dashboard', 'Learner', 'Study Room']
    if (currentPath.startsWith('/dashboard/educator')) return ['Dashboard', 'Educator', 'Lecture Studio']
    if (currentPath.startsWith('/dashboard/admin')) return ['Dashboard', 'Admin Console']
    return ['Dashboard', activeRole]
  }

  const breadcrumbs = buildBreadcrumbs()
  const unreadCount = notifications.filter(n => !n.read).length
  const navItems = ROLE_NAV_ITEMS[activeRole] || ROLE_NAV_ITEMS.Creator
  const badgeInfo = ROLE_BADGES[activeRole]

  const sidebarW = sidebarCollapsed ? 68 : 240

  // Dynamic video storage meter
  const [storageUsedMb, setStorageUsedMb] = useState<number>(14200)

  useEffect(() => {
    async function loadStorage() {
      try {
        const vids = await api.getVideos()
        if (vids && vids.length > 0) {
          const total = vids.reduce((acc: number, v: any) => acc + (v.file_size_mb || 14.2), 0)
          setStorageUsedMb(total)
        }
      } catch (e) { }
    }
    loadStorage()
    const interval = setInterval(loadStorage, 5000)
    return () => clearInterval(interval)
  }, [])

  const storageGb = (storageUsedMb / 1024).toFixed(1)
  const displayStorageText = storageUsedMb >= 1024 ? `${storageGb} / 50 GB` : `${storageUsedMb.toFixed(1)} MB / 50 GB`
  const storagePercentage = Math.min(100, Math.max(2, (storageUsedMb / (50 * 1024)) * 100))
  useEffect(() => {
    async function loadNotifications() {
      try {
        const notifs = await api.getNotifications()
        if (notifs && Array.isArray(notifs) && notifs.length > 0) {
          setNotifications(notifs)
        }
      } catch (e) { }
    }
    loadNotifications()
    const notifInterval = setInterval(loadNotifications, 10000)
    return () => clearInterval(notifInterval)
  }, [])

  const handleUploadClick = () => {
    showToast('Opening Upload Studio...', 'info')
    navigate('/dashboard/upload')
  }

  return (
    <div className="ambient-mesh-bg" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Backdrop overlay for closing dropdowns when clicking outside */}
      {(roleDropdownOpen || notifOpen) && (
        <div
          onClick={() => { setRoleDropdownOpen(false); setNotifOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'transparent' }}
        />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-glass)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 50, overflow: 'hidden',
      }}>
        {/* Logo row */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: sidebarCollapsed ? '0 16px' : '0 20px',
          borderBottom: '1px solid var(--border-glass)',
          gap: 10, cursor: 'pointer',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        }} onClick={() => { showToast('Navigating to dashboard home', 'info'); navigate('/dashboard') }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 14px var(--accent-indigo-glow)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          </div>
          {!sidebarCollapsed && <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>ClipMind<span style={{ color: 'var(--accent-indigo)' }}> AI</span></span>}
        </div>

        {/* Active Role Banner in Sidebar */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-glass)' }}>
            <div style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
              borderRadius: 8, padding: '8px 12px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', fontSize: 12,
              fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}>
              <span>Workspace Role</span>
              <span className="badge" style={{ background: `${badgeInfo.color}25`, color: badgeInfo.color, border: `1px solid ${badgeInfo.color}50` }}>
                {activeRole}
              </span>
            </div>
          </div>
        )}

        {/* Nav links dynamically mapped to active role */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path))
            return (
              <button
                key={item.label}
                onClick={() => { showToast(`Navigating to ${item.label}`, 'info'); navigate(item.path) }}
                title={sidebarCollapsed ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: sidebarCollapsed ? 0 : 12,
                  padding: sidebarCollapsed ? '12px 0' : '11px 20px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  background: isActive ? 'var(--accent-indigo-dim)' : 'none',
                  borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                  borderLeft: isActive ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                  cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  borderRadius: sidebarCollapsed ? 0 : '0 8px 8px 0',
                  marginRight: sidebarCollapsed ? 0 : 8,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {!sidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Dynamic Storage meter */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Storage Used</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayStorageText}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${storagePercentage}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* User footer */}
        <div style={{
          padding: sidebarCollapsed ? '12px 0' : '12px 16px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex', alignItems: 'center',
          gap: sidebarCollapsed ? 0 : 10,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }} title={userName}>
            {userInitials}
          </div>
          {!sidebarCollapsed && (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userName}>{userName}</div>
                <div style={{ fontSize: 11, color: badgeInfo.color, fontWeight: 600 }}>{badgeInfo.title}</div>
              </div>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }} title="Sign out" aria-label="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, marginLeft: sidebarW, display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'margin-left 0.2s ease' }}>
        {/* TOP HEADER */}
        <header style={{
          height: 64, position: 'sticky', top: 0, zIndex: 40,
          background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 16,
        }}>
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }} aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span>/</span>}
                <span style={{ color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>{crumb}</span>
              </span>
            ))}
          </div>

          {/* Global search → opens Command Palette */}
          <div style={{ flex: 1, maxWidth: 440, margin: '0 auto', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              type="search"
              className="input-field"
              placeholder="⌘K  Search transcripts, videos, keywords..."
              value={searchVal}
              readOnly
              onClick={() => setCmdPaletteOpen(true)}
              onFocus={() => setCmdPaletteOpen(true)}
              onChange={e => setSearchVal(e.target.value)}
              style={{ paddingLeft: 38, paddingRight: 64, borderRadius: 10, height: 40, fontSize: 13, cursor: 'pointer', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <kbd style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 4, padding: '2px 6px', pointerEvents: 'none' }}>⌘K</kbd>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Live AI Status Pill */}
            <div className="hidden sm:flex" style={{
              alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 9999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.15)',
            }}>
              <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                <span style={{
                  position: 'absolute', width: '100%', height: '100%',
                  borderRadius: '50%', background: '#10B981', opacity: 0.75,
                  animation: 'radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                }} />
                <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                AI Engine Online
              </span>
            </div>
            {activeRole === 'Learner' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  onClick={() => navigate('/dashboard/upload')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 14 }}>📤</span>
                  Upload Video
                </button>
                <button
                  className="btn-primary"
                  onClick={() => navigate('/dashboard/learner/study')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))'
                  }}
                >
                  <span style={{ fontSize: 14 }}>🎓</span>
                  Study Room
                </button>
              </div>
            ) : activeRole === 'Admin' ? (
              <button
                className="btn-primary"
                onClick={() => navigate('/dashboard/admin')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 9,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, var(--accent-rose), #9333ea)'
                }}
              >
                <span style={{ fontSize: 14 }}>🛡️</span>
                Admin Console
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={handleUploadClick}
                style={{
                  padding: '8px 16px',
                  borderRadius: 9,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {activeRole === 'Educator' ? 'Upload Lecture' : 'Upload Video'}
              </button>
            )}

            {/* Workspace & Role Selector / Indicator */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (authenticatedRole === 'Admin') {
                    setRoleDropdownOpen(!roleDropdownOpen)
                    setNotifOpen(false)
                  } else {
                    showToast(`Role locked to verified account role: ${authenticatedRole}`, 'info')
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 9999,
                  background: 'var(--bg-glass)',
                  border: `1px solid ${badgeInfo.color}50`,
                  color: badgeInfo.color,
                  fontSize: 12, fontWeight: 700,
                  cursor: authenticatedRole === 'Admin' ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}
                title={authenticatedRole === 'Admin' ? 'Click to switch workspace preview' : `Verified account role: ${authenticatedRole}`}
              >
                <span>{activeRole === 'Creator' ? '🎬' : activeRole === 'Learner' ? '🎓' : activeRole === 'Educator' ? '✏️' : '🛡️'}</span>
                <span>{activeRole}</span>
                {authenticatedRole === 'Admin' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                ) : (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>🔒</span>
                )}
              </button>

              {/* Dropdown for Admin to preview workspaces */}
              {roleDropdownOpen && authenticatedRole === 'Admin' && (
                <div className="glass-card" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 220, zIndex: 1000, overflow: 'hidden', padding: 6,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Admin Workspace Switcher
                  </div>
                  {(['Admin', 'Creator', 'Educator', 'Learner'] as Role[]).map(role => (
                    <button
                      key={role}
                      onClick={() => handleRoleSelect(role)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 6, border: 'none',
                        background: activeRole === role ? 'var(--accent-indigo-dim)' : 'transparent',
                        color: activeRole === role ? 'var(--accent-indigo)' : 'var(--text-primary)',
                        fontSize: 13, fontWeight: activeRole === role ? 700 : 500,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span>{role === 'Creator' ? '🎬' : role === 'Learner' ? '🎓' : role === 'Educator' ? '✏️' : '🛡️'}</span>
                      <span>{role} {role === 'Admin' ? '(Console)' : '(Preview)'}</span>
                      {activeRole === role && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setRoleDropdownOpen(false) }}
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                aria-label="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--accent-rose)', color: '#fff', fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="glass-card" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 340, zIndex: 1000, overflow: 'hidden',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span onClick={markAllRead} style={{ fontSize: 12, color: 'var(--text-accent)', cursor: 'pointer', fontWeight: 600 }}>
                        Mark all read
                      </span>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{
                        padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
                        background: n.read ? 'transparent' : 'var(--accent-indigo-dim)',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = n.read ? 'var(--bg-surface)' : 'var(--accent-indigo-dim)'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'var(--accent-indigo-dim)'}
                        onClick={() => {
                          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
                          if (n.type === 'success') showToast('Opening video...', 'info')
                        }}
                      >
                        <span style={{ fontSize: 14, marginTop: 1 }}>{n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{n.time}</div>
                        </div>
                        {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-indigo)', flexShrink: 0, marginTop: 5 }} />}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-glass)', textAlign: 'center' }}>
                    <span onClick={() => showToast('Viewing all notifications...', 'info')} style={{ fontSize: 12, color: 'var(--text-accent)', cursor: 'pointer', fontWeight: 600 }}>
                      View All Notifications →
                    </span>
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
    </div>
  )
}
