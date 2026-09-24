import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import CommandPalette from './CommandPalette'
import { api } from '../services/api'
import { useToast } from './Toast'
import ErrorBoundary from './ErrorBoundary'

type Role = 'Creator' | 'Learner' | 'Educator' | 'Admin'

interface NavItem {
  iconKey: string
  label: string
  path: string
}

const renderNavIcon = (key: string, size = 18) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  switch (key) {
    case 'overview':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
    case 'upload':
      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    case 'videos':
      return <svg {...props}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
    case 'chatbot':
    case 'study':
      return <svg {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    case 'bookmarks':
      return <svg {...props}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
    case 'analytics':
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    case 'lectures':
      return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    case 'admin':
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    case 'menu':
      return <svg {...props}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>
  }
}

const ROLE_NAV_ITEMS: Record<Role, NavItem[]> = {
  Creator: [
    { iconKey: 'overview', label: 'Overview', path: '/dashboard' },
    { iconKey: 'upload', label: 'Upload Studio', path: '/dashboard/upload' },
    { iconKey: 'videos', label: 'Video Library', path: '/dashboard/videos' },
    { iconKey: 'chatbot', label: 'AI Study Room', path: '/dashboard/learner/study' },
    { iconKey: 'bookmarks', label: 'Bookmarks', path: '/dashboard/bookmarks' },
    { iconKey: 'analytics', label: 'Analytics', path: '/dashboard/analytics' },
    { iconKey: 'settings', label: 'Settings', path: '/dashboard/settings' },
  ],
  Learner: [
    { iconKey: 'overview', label: 'Student Dashboard', path: '/dashboard/learner' },
    { iconKey: 'study', label: 'AI Study Room', path: '/dashboard/learner/study' },
    { iconKey: 'upload', label: 'Upload Video', path: '/dashboard/upload' },
    { iconKey: 'videos', label: 'My Lectures', path: '/dashboard/videos' },
    { iconKey: 'bookmarks', label: 'Study Notes', path: '/dashboard/bookmarks' },
    { iconKey: 'analytics', label: 'Learning Stats', path: '/dashboard/analytics' },
    { iconKey: 'settings', label: 'Settings', path: '/dashboard/settings' },
  ],
  Educator: [
    { iconKey: 'lectures', label: 'Lecture Studio', path: '/dashboard/educator/lectures' },
    { iconKey: 'upload', label: 'Upload Lecture', path: '/dashboard/upload' },
    { iconKey: 'videos', label: 'Course Content', path: '/dashboard/videos' },
    { iconKey: 'chatbot', label: 'AI Study Room', path: '/dashboard/learner/study' },
    { iconKey: 'analytics', label: 'Student Analytics', path: '/dashboard/analytics' },
    { iconKey: 'settings', label: 'Settings', path: '/dashboard/settings' },
  ],
  Admin: [
    { iconKey: 'admin', label: 'Admin Console', path: '/dashboard/admin' },
    { iconKey: 'videos', label: 'Video Catalog', path: '/dashboard/videos' },
    { iconKey: 'chatbot', label: 'AI Study Room', path: '/dashboard/learner/study' },
    { iconKey: 'analytics', label: 'System Analytics', path: '/dashboard/analytics' },
    { iconKey: 'settings', label: 'Settings', path: '/dashboard/settings' },
  ],
}

const ROLE_BADGES: Record<Role, { title: string; color: string; icon: string }> = {
  Creator: { title: 'Creator', color: 'var(--accent-indigo)', icon: '⚡' },
  Learner: { title: 'Learner', color: 'var(--accent-cyan)', icon: '🎓' },
  Educator: { title: 'Educator', color: 'var(--accent-emerald)', icon: '👨‍🏫' },
  Admin: { title: 'Administrator', color: 'var(--accent-rose)', icon: '🛡️' },
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Track viewport width for responsive mobile drawer & bottom nav
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileDrawerOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-close mobile drawer on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

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
    const savedRole = localStorage.getItem('clipmind_active_role') as Role | null
    if (savedRole && (savedRole in ROLE_NAV_ITEMS)) return savedRole
    try {
      const storedUser = localStorage.getItem('clipmind_user')
      if (storedUser) {
        const u = JSON.parse(storedUser)
        if (u.role && (u.role in ROLE_NAV_ITEMS)) {
          return u.role as Role
        }
      }
    } catch (e) { }
    return 'Creator'
  })

  useEffect(() => {
    async function syncUser() {
      const token = localStorage.getItem('clipmind_access_token')
      if (!token) {
        localStorage.removeItem('clipmind_user')
        localStorage.removeItem('clipmind_active_role')
        navigate('/login')
        return
      }
      try {
        const u = await api.getMe()
        if (u && u.name) {
          setUserName(u.name)
          localStorage.setItem('clipmind_user', JSON.stringify(u))
          if (u.role && (u.role in ROLE_NAV_ITEMS)) {
            setAuthenticatedRole(u.role as Role)
            const savedRole = localStorage.getItem('clipmind_active_role') as Role | null
            if (!savedRole) {
              setActiveRole(u.role as Role)
              localStorage.setItem('clipmind_active_role', u.role)
            }
          }
        }
      } catch (e: any) {
        const status = e?.status || (e?.message?.includes('401') ? 401 : 0)
        if (status === 401 || status === 403 || e?.message?.includes('401') || e?.message?.includes('403')) {
          localStorage.removeItem('clipmind_access_token')
          localStorage.removeItem('clipmind_user')
          localStorage.removeItem('clipmind_active_role')
          navigate('/login')
        } else {
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
  }, [navigate])

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

    const primaryPath = ROLE_NAV_ITEMS[role][0].path
    showToast(`Switched to ${role} workspace`, 'success')
    navigate(primaryPath)
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    showToast('All notifications marked as read', 'success')
  }

  const currentPath = location.pathname

  const buildBreadcrumbs = (): string[] => {
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
    if (currentPath === '/dashboard/learner' || (currentPath === '/dashboard' && activeRole === 'Learner')) return ['Dashboard', 'Student Hub']
    if (currentPath.startsWith('/dashboard/learner/study')) return ['Dashboard', 'Learner', 'Study Room']
    if (currentPath.startsWith('/dashboard/learner')) return ['Dashboard', 'Learner', 'Student Hub']
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
  const [storageUsedMb, setStorageUsedMb] = useState<number>(0)

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

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobile && mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* SIDEBAR (Desktop Icon-Rail / Mobile Off-Canvas Drawer) */}
      <aside style={{
        width: isMobile ? 280 : sidebarW,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-glass)',
        display: 'flex', flexDirection: 'column',
        transition: isMobile ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'width 0.2s ease',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: isMobile ? 100 : 50,
        transform: isMobile ? (mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        boxShadow: isMobile && mobileDrawerOpen ? '0 0 40px rgba(0,0,0,0.7)' : 'none',
        overflow: 'hidden',
      }}>
        {/* Logo row */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: (sidebarCollapsed && !isMobile) ? '0 16px' : '0 20px',
          borderBottom: '1px solid var(--border-glass)',
          gap: 10, cursor: 'pointer',
          justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
        }} onClick={() => {
          if (isMobile) setMobileDrawerOpen(false)
          navigate('/dashboard')
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px var(--accent-indigo-glow)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              ClipMind<span style={{ color: 'var(--accent-indigo)' }}> AI</span>
            </span>
          )}
          {isMobile && (
            <button
              onClick={(e) => { e.stopPropagation(); setMobileDrawerOpen(false) }}
              style={{ marginLeft: 'auto', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Active Role Banner in Sidebar */}
        {(!sidebarCollapsed || isMobile) && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-glass)' }}>
            <div style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
              borderRadius: 10, padding: '10px 12px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', fontSize: 12,
              fontWeight: 600, color: 'var(--text-primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{badgeInfo.icon}</span>
                <span>Workspace</span>
              </div>
              <span className="badge" style={{ background: `${badgeInfo.color}25`, color: badgeInfo.color, border: `1px solid ${badgeInfo.color}50` }}>
                {activeRole}
              </span>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path))
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (isMobile) setMobileDrawerOpen(false)
                  navigate(item.path)
                }}
                title={(sidebarCollapsed && !isMobile) ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: (sidebarCollapsed && !isMobile) ? 0 : 12,
                  padding: (sidebarCollapsed && !isMobile) ? '12px 0' : '11px 20px',
                  justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
                  background: isActive ? 'var(--accent-indigo-dim)' : 'none',
                  borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                  borderLeft: isActive ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                  cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  borderRadius: (sidebarCollapsed && !isMobile) ? 0 : '0 8px 8px 0',
                  marginRight: (sidebarCollapsed && !isMobile) ? 0 : 8,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {renderNavIcon(item.iconKey)}
                </span>
                {(!sidebarCollapsed || isMobile) && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Storage meter */}
        {(!sidebarCollapsed || isMobile) && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Storage</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayStorageText}</span>
              </div>
              <div className="progress-track" style={{ height: 5, background: 'var(--border-glass)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: `${storagePercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))', borderRadius: 9999 }} />
              </div>
            </div>
          </div>
        )}

        {/* User profile footer */}
        <div style={{
          padding: (sidebarCollapsed && !isMobile) ? '12px 0' : '12px 16px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex', alignItems: 'center',
          gap: (sidebarCollapsed && !isMobile) ? 0 : 10,
          justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }} title={userName}>
            {userInitials}
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userName}>{userName}</div>
                <div style={{ fontSize: 11, color: badgeInfo.color, fontWeight: 600 }}>{badgeInfo.title}</div>
              </div>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 6 }} title="Sign out" aria-label="Sign out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : sidebarW,
        width: isMobile ? '100%' : `calc(100% - ${sidebarW}px)`,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        overflowX: 'hidden',
        transition: 'margin-left 0.2s ease',
        paddingBottom: isMobile ? 74 : 0
      }}>
        {/* TOP STICKY HEADER */}
        <header style={{
          height: 64, position: 'sticky', top: 0, zIndex: 40,
          background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px',
          gap: isMobile ? 8 : 16,
        }}>
          {/* Hamburger / Collapse Button */}
          <button
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(prev => !prev)
              else setSidebarCollapsed(!sidebarCollapsed)
            }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-glass)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38
            }}
            aria-label="Toggle navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>

          {/* Breadcrumb / Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden' }}>
            {isMobile ? (
              <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 14, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {breadcrumbs[breadcrumbs.length - 1]}
              </span>
            ) : (
              breadcrumbs.map((crumb, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 && <span>/</span>}
                  <span style={{ color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === breadcrumbs.length - 1 ? 700 : 400 }}>{crumb}</span>
                </span>
              ))
            )}
          </div>

          {/* Global search → Command Palette */}
          <div style={{ flex: 1, maxWidth: isMobile ? 160 : 400, margin: isMobile ? '0' : '0 auto', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              type="search"
              className="input-field"
              placeholder={isMobile ? "Search..." : "⌘K  Search transcripts, videos..."}
              value={searchVal}
              readOnly
              onClick={() => setCmdPaletteOpen(true)}
              onFocus={() => setCmdPaletteOpen(true)}
              onChange={e => setSearchVal(e.target.value)}
              style={{
                paddingLeft: 30,
                paddingRight: isMobile ? 8 : 50,
                borderRadius: 9,
                height: 36,
                fontSize: 12,
                cursor: 'pointer',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                width: '100%'
              }}
            />
            {!isMobile && (
              <kbd style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 4, padding: '2px 5px', pointerEvents: 'none' }}>⌘K</kbd>
            )}
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
            {/* Live AI Status Pill (hidden on small mobile) */}
            <div className="hide-on-mobile" style={{
              display: 'flex',
              alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 9999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
            }}>
              <span className="live-pulse-dot" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', whiteSpace: 'nowrap' }}>
                AI Online
              </span>
            </div>

            {/* Quick Upload Button on Desktop */}
            {!isMobile && (
              <button
                className="btn-primary"
                onClick={handleUploadClick}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12.5,
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
                <span>Upload</span>
              </button>
            )}

            {/* Workspace & Role Selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (authenticatedRole === 'Admin') {
                    setRoleDropdownOpen(!roleDropdownOpen)
                    setNotifOpen(false)
                  } else {
                    showToast(`Active verified role: ${authenticatedRole}`, 'info')
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: isMobile ? '6px 9px' : '6px 12px', borderRadius: 9999,
                  background: 'var(--bg-glass)',
                  border: `1px solid ${badgeInfo.color}50`,
                  color: badgeInfo.color,
                  fontSize: 11.5, fontWeight: 700,
                  cursor: authenticatedRole === 'Admin' ? 'pointer' : 'default',
                }}
                title={authenticatedRole === 'Admin' ? 'Click to switch workspace preview' : `Verified account role: ${authenticatedRole}`}
              >
                <span>{badgeInfo.icon}</span>
                <span className="hide-on-mobile">{activeRole}</span>
                {authenticatedRole === 'Admin' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                )}
              </button>

              {/* Admin Role Switcher Dropdown */}
              {roleDropdownOpen && authenticatedRole === 'Admin' && (
                <div className="glass-card" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 210, zIndex: 1000, overflow: 'hidden', padding: 6,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '6px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Workspace Switcher
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
                        fontSize: 12.5, fontWeight: activeRole === role ? 700 : 500,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span>{ROLE_BADGES[role].icon}</span>
                      <span>{role}</span>
                      {activeRole === role && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setRoleDropdownOpen(false) }}
                style={{
                  background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                  borderRadius: '50%', width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative'
                }}
                aria-label="Notifications"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--accent-rose)', color: '#fff', fontSize: 9.5, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="glass-card" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 30 : 320),
                  zIndex: 1000, overflow: 'hidden',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span onClick={markAllRead} style={{ fontSize: 11, color: 'var(--text-accent)', cursor: 'pointer', fontWeight: 600 }}>
                        Mark read
                      </span>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                        No new notifications
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                          background: n.read ? 'transparent' : 'var(--accent-indigo-dim)',
                          display: 'flex', gap: 8, alignItems: 'flex-start',
                          cursor: 'pointer',
                        }}
                          onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                        >
                          <span style={{ fontSize: 13, marginTop: 1 }}>{n.type === 'success' ? '✅' : n.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.text}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{n.time}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* MAIN PAGE OUTLET */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* =========================================================================
         MOBILE APP NATIVE BOTTOM NAVIGATION BAR (< 768px Viewport)
         ========================================================================= */}
      {isMobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 90,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
          {/* 1. Home / Overview */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: currentPath === '/dashboard' || currentPath === '/dashboard/learner' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              flex: 1,
              height: '100%',
              padding: 0
            }}
          >
            {renderNavIcon('overview', 20)}
            <span style={{ fontSize: 10, fontWeight: 700 }}>Home</span>
          </button>

          {/* 2. Upload Studio */}
          <button
            onClick={() => navigate('/dashboard/upload')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: currentPath.startsWith('/dashboard/upload') ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              flex: 1,
              height: '100%',
              padding: 0
            }}
          >
            {renderNavIcon('upload', 20)}
            <span style={{ fontSize: 10, fontWeight: 700 }}>Upload</span>
          </button>

          {/* 3. Video Library */}
          <button
            onClick={() => navigate('/dashboard/videos')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: currentPath === '/dashboard/videos' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              flex: 1,
              height: '100%',
              padding: 0
            }}
          >
            {renderNavIcon('videos', 20)}
            <span style={{ fontSize: 10, fontWeight: 700 }}>Videos</span>
          </button>

          {/* 4. AI Study Room / Chatbot */}
          <button
            onClick={() => navigate('/dashboard/learner/study')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: currentPath.startsWith('/dashboard/learner/study') ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              flex: 1,
              height: '100%',
              padding: 0
            }}
          >
            {renderNavIcon('study', 20)}
            <span style={{ fontSize: 10, fontWeight: 700 }}>Study AI</span>
          </button>

          {/* 5. More / Menu Drawer */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: mobileDrawerOpen ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              flex: 1,
              height: '100%',
              padding: 0
            }}
          >
            {renderNavIcon('menu', 20)}
            <span style={{ fontSize: 10, fontWeight: 700 }}>Menu</span>
          </button>
        </nav>
      )}

      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
    </div>
  )
}
