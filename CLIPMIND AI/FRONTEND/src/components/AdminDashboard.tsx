import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useToast } from './Toast'

interface UserRow {
  id: string
  name: string
  email: string
  role: 'Creator' | 'Learner' | 'Educator' | 'Admin'
  is_active: boolean
  is_verified?: boolean
  verification_status?: string
  joined: string
}

interface VideoRow {
  id: string
  title: string
  duration: number
  status: string
  processing_stage: string
  created_at: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Section state: User Governance is the primary default!
  const [activeSection, setActiveSection] = useState<'users' | 'videos' | 'logs'>('users')

  // Data states
  const [users, setUsers] = useState<UserRow[]>([])
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([])
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [searchUser, setSearchUser] = useState('')
  const [searchVideo, setSearchVideo] = useState('')
  const [loading, setLoading] = useState(false)

  // Create User Modal state
  const [userModal, setUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'Learner' | 'Creator' | 'Educator' | 'Admin'>('Learner')
  const [newUserPassword, setNewUserPassword] = useState('')

  const logsEndRef = useRef<HTMLDivElement>(null)

  // Fetch all real management data
  const loadAdminData = async () => {
    try {
      // 1. Fetch Users
      const usersData = await api.getAdminUsers()
      if (usersData && Array.isArray(usersData)) {
        const mappedUsers: UserRow[] = usersData.map((u: any) => ({
          id: u.id,
          name: u.name || 'User',
          email: u.email,
          role: u.role as any || 'Learner',
          is_active: u.is_active !== false,
          is_verified: u.is_verified !== false,
          verification_status: u.verification_status || 'verified',
          joined: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'
        }))
        setUsers(mappedUsers)
      }

      // 1b. Fetch Pending Verifications
      const pendingData = await api.getPendingUsers()
      if (pendingData && Array.isArray(pendingData)) {
        const mappedPending: UserRow[] = pendingData.map((u: any) => ({
          id: u.id,
          name: u.name || 'User',
          email: u.email,
          role: u.role as any || 'Creator',
          is_active: u.is_active === true,
          is_verified: u.is_verified === true,
          verification_status: u.verification_status || 'pending',
          joined: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'
        }))
        setPendingUsers(mappedPending)
      }

      // 2. Fetch Videos
      const videosData = await api.getAdminVideos()
      if (videosData && Array.isArray(videosData)) {
        setVideos(videosData)
      }

      // 3. Fetch Audit Logs
      const logsData = await api.getAuditLogs()
      if (logsData && Array.isArray(logsData)) {
        setLogs(logsData)
      }
    } catch (err: any) {
      console.error('Admin data load error:', err)
    }
  }

  useEffect(() => {
    loadAdminData()
    const interval = setInterval(loadAdminData, 6000)
    return () => clearInterval(interval)
  }, [])

  // User Management Actions
  const handleVerifyUser = async (userId: string, name: string) => {
    try {
      await api.verifyAdminUser(userId)
      showToast(`Account approved and verified for ${name}!`, 'success')
      await loadAdminData()
    } catch (err: any) {
      showToast(err.message || 'Failed to verify user', 'error')
    }
  }

  const handleRejectUser = async (userId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to reject account verification for ${name}?`)) return
    try {
      await api.rejectAdminUser(userId)
      showToast(`Verification rejected for ${name}`, 'info')
      await loadAdminData()
    } catch (err: any) {
      showToast(err.message || 'Failed to reject user', 'error')
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as any } : u))
      showToast(`User role updated to ${newRole}`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to update role', 'error')
    }
  }

  const handleToggleStatus = async (user: UserRow) => {
    const nextStatus = !user.is_active
    try {
      await api.updateUserRole(user.id, { role: user.role, is_active: nextStatus })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: nextStatus } : u))
      showToast(`User ${user.email} marked as ${nextStatus ? 'Active' : 'Suspended'}`, 'info')
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error')
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${email}?`)) return
    try {
      await api.deleteAdminUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      showToast(`User ${email} deleted successfully`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'error')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail.trim()) {
      showToast('Please provide an email address', 'error')
      return
    }
    setLoading(true)
    try {
      const created = await api.createAdminUser({
        email: newUserEmail.trim(),
        name: newUserName.trim() || newUserEmail.split('@')[0],
        role: newUserRole,
        password: newUserPassword
      })
      showToast(`Created ${newUserRole} account for ${created.email}`, 'success')
      setUserModal(false)
      setNewUserName('')
      setNewUserEmail('')
      loadAdminData()
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Video Management Actions
  const handleCleanCache = async () => {
    try {
      setLoading(true)
      const res = await api.cleanPlatformCache()
      showToast(res.message || 'Cache cleaned successfully', 'success')
      await loadAdminData()
    } catch (err: any) {
      showToast(err.message || 'Failed to clean cache', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${title}' from the platform?`)) return
    try {
      await api.deleteAdminVideo(videoId)
      setVideos(prev => prev.filter(v => v.id !== videoId))
      showToast(`Video '${title}' deleted successfully`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete video', 'error')
    }
  }


  // Filtered lists
  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchUser.toLowerCase())
  )

  const filteredVideos = videos.filter(v =>
    (v.title || '').toLowerCase().includes(searchVideo.toLowerCase())
  )

  return (
    <div className="responsive-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Operations Header */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🛡️</span> Administrator Operations & Management Console
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Direct governance for user permissions, platform video catalog, and security audit trails.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleCleanCache}
            disabled={loading}
            style={{
              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-surface)', border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)', cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <span>🧹</span> {loading ? 'Cleaning...' : 'Clean Cache'}
          </button>
          <button
            className="btn-primary"
            onClick={() => setUserModal(true)}
            style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>+</span> Add New User
          </button>
        </div>
      </div>

      {/* Main Management Tab Navigation */}
      <div className="tabs-scroll-container" style={{ display: 'flex', gap: 8, background: 'var(--bg-surface)', padding: 6, borderRadius: 12, border: '1px solid var(--border-glass)', overflowX: 'auto' }}>
        {[
          { id: 'users', label: '👥 User Governance', badge: `${users.length}` },
          { id: 'videos', label: '🎬 Video Catalog', badge: `${videos.length}` },
          { id: 'logs', label: '📋 Audit Trail', badge: `${logs.length}` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            style={{
              flex: 1,
              minWidth: 140,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              padding: '11px 16px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: activeSection === tab.id ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'transparent',
              color: activeSection === tab.id ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeSection === tab.id ? '0 0 16px var(--accent-indigo-glow)' : 'none',
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              background: activeSection === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--border-glass)',
              color: activeSection === tab.id ? '#fff' : 'var(--text-secondary)'
            }}>
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. USER & ROLE GOVERNANCE TAB (PRIMARY) */}
      {/* ========================================================================= */}
      {activeSection === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* PENDING VERIFICATION APPROVALS CARD */}
          {pendingUsers.length > 0 ? (
            <div className="glass-card" style={{
              border: '1px solid var(--accent-indigo)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(99, 102, 241, 0.05)',
              boxShadow: '0 0 24px var(--accent-indigo-glow)'
            }}>
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(99, 102, 241, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⏳</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Pending Account Verification Requests ({pendingUsers.length})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Creator and Educator registrations submitted for administrator approval. Verify to activate their accounts.
                    </div>
                  </div>
                </div>
                <span className="tag-pill" style={{ background: 'rgba(99, 102, 241, 0.25)', color: '#818cf8', fontWeight: 700 }}>
                  ⚡ Action Required
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                      {['Applicant Name', 'Email Address', 'Requested Role', 'Submitted', 'Verification Actions'].map(h => (
                        <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map(pu => (
                      <tr key={pu.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: pu.role === 'Educator' ? 'linear-gradient(135deg, #0284c7, #06b6d4)' : 'linear-gradient(135deg, #059669, #10b981)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff'
                            }}>
                              {pu.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{pu.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {pu.id.slice(-6)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: 13 }}>
                          {pu.email}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span className="tag-pill" style={{
                            background: pu.role === 'Educator' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(5, 150, 105, 0.15)',
                            color: pu.role === 'Educator' ? '#38bdf8' : '#34d399',
                            fontWeight: 700
                          }}>
                            {pu.role === 'Educator' ? '✏️ Educator' : '🎬 Creator'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
                          {pu.joined}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => handleVerifyUser(pu.id, pu.name)}
                              className="btn-primary"
                              style={{
                                padding: '7px 16px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              <span>✅</span> Verify & Approve
                            </button>
                            <button
                              onClick={() => handleRejectUser(pu.id, pu.name)}
                              style={{
                                padding: '7px 14px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 600,
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer'
                              }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '12px 18px',
              borderRadius: 10,
              fontSize: 13,
              color: '#10b981',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>🛡️</span>
              <span>All Creator & Educator accounts are verified. No pending approval requests.</span>
            </div>
          )}

          {/* MAIN USER LIST CARD */}
          <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 14 }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>User Accounts & Role Permissions</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Manage access tiers and permissions across Learner, Educator, Creator, and Administrator roles.</div>
              </div>
              <div style={{ width: 320 }}>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Search user by name, email, or role..."
                  value={searchUser}
                  onChange={e => setSearchUser(e.target.value)}
                  style={{ padding: '8px 14px', fontSize: 13 }}
                />
              </div>
            </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  {['User', 'Email Address', 'Assigned Role', 'Account Status', 'Registered', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr key={user.id} style={{ borderTop: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    {/* User Name & Avatar */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: user.role === 'Admin' ? 'linear-gradient(135deg, #9333ea, #4f46e5)' :
                            user.role === 'Educator' ? 'linear-gradient(135deg, #0284c7, #06b6d4)' :
                              user.role === 'Creator' ? 'linear-gradient(135deg, #059669, #10b981)' :
                                'linear-gradient(135deg, #4f46e5, #818cf8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff'
                        }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {user.id.slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {user.email}
                    </td>

                    {/* Role Dropdown */}
                    <td style={{ padding: '14px 18px' }}>
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          border: '1px solid var(--border-glass)',
                          background: user.role === 'Admin' ? 'rgba(147, 51, 234, 0.15)' :
                            user.role === 'Educator' ? 'rgba(2, 132, 199, 0.15)' :
                              user.role === 'Creator' ? 'rgba(5, 150, 105, 0.15)' :
                                'rgba(79, 70, 229, 0.15)',
                          color: user.role === 'Admin' ? '#c084fc' :
                            user.role === 'Educator' ? '#38bdf8' :
                              user.role === 'Creator' ? '#34d399' :
                                '#818cf8',
                        }}
                      >
                        <option value="Learner">🎓 Learner</option>
                        <option value="Creator">🎥 Creator</option>
                        <option value="Educator">✏️ Educator</option>
                        <option value="Admin">🛡️ Admin</option>
                      </select>
                    </td>

                    {/* Status Toggle */}
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        style={{
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: user.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: user.is_active ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                        }}
                      >
                        {user.is_active ? '● Active' : '○ Suspended'}
                      </button>
                    </td>

                    {/* Joined */}
                    <td style={{ padding: '14px 18px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {user.joined}
                    </td>

                    {/* Delete Action */}
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="btn-glass"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--accent-rose)',
                          borderColor: 'rgba(239,68,68,0.2)',
                          fontWeight: 600
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIDEO CATALOG MANAGEMENT TAB */}
      {/* ========================================================================= */}
      {activeSection === 'videos' && (
        <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 14 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Platform Video Catalog & Content Governance</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Manage all processed videos, review playback assets, and purge broken media.</div>
            </div>
            <div style={{ width: 320 }}>
              <input
                className="input-field"
                type="text"
                placeholder="Search videos by title..."
                value={searchVideo}
                onChange={e => setSearchVideo(e.target.value)}
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  {['Video Title', 'Duration', 'Pipeline Status', 'Upload Date', 'Management Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((video, idx) => (
                  <tr key={video.id} style={{ borderTop: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '14px 18px', maxWidth: 300 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {video.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {video.id}</div>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.floor(video.duration / 60)}:{(Math.floor(video.duration % 60)).toString().padStart(2, '0')}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span className={`badge ${video.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {video.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(video.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => navigate(`/dashboard/videos/${video.id}`)}
                          className="btn-primary"
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                        >
                          ▶ Open Player
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id, video.title)}
                          className="btn-glass"
                          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, color: 'var(--accent-rose)', borderColor: 'rgba(239,68,68,0.2)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 4. SECURITY AUDIT LOGS TAB */}
      {/* ========================================================================= */}
      {activeSection === 'logs' && (
        <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 14 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Security & Administrative Audit Trail</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Chronological record of user authentication, role updates, video deletions, and configuration changes.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 8px var(--accent-emerald)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-emerald)' }}>Live Audit Active</span>
            </div>
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)' }}>
                  {['Timestamp', 'Action Type', 'User / Actor', 'Resource', 'Details'].map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} style={{ borderTop: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <span className={`badge ${log.action?.includes('DELETE') ? 'badge-error' :
                          log.action?.includes('CREATE') ? 'badge-success' :
                            log.action?.includes('UPDATE') ? 'badge-info' : 'badge-warning'
                        }`}>
                        {log.action}
                      </span>
                    </td>

                    <td style={{ padding: '12px 18px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {log.user_email}
                    </td>

                    <td style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {log.resource}
                    </td>

                    <td style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / INVITE USER MODAL */}
      {userModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setUserModal(false) }}
        >
          <form onSubmit={handleCreateUser} className="glass-card" style={{ width: 460, padding: 32, borderRadius: 16, border: '1px solid var(--accent-indigo)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Create New Platform Account</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Provision a user account with assigned role permissions.</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g. Dr. Priya Sharma"
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input
                className="input-field"
                type="email"
                required
                placeholder="user@institution.edu"
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Assigned Role</label>
              <select
                className="input-field"
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as any)}
                style={{ cursor: 'pointer' }}
              >
                <option value="Learner">🎓 Learner (Study room, flashcards, quizzes)</option>
                <option value="Creator">🎥 Creator (Upload studio, subtitle generator)</option>
                <option value="Educator">✏️ Educator (Lecture studio, Word guides)</option>
                <option value="Admin">🛡️ Admin (Full platform governance)</option>
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Initial Password</label>
              <input
                className="input-field"
                type="password"
                required
                placeholder="Enter strong password"
                value={newUserPassword}
                onChange={e => setNewUserPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" onClick={() => setUserModal(false)} className="btn-glass" style={{ padding: '11px 20px', borderRadius: 10, fontSize: 13.5 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
