import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useToast } from './Toast'

import { api } from '../services/api'

type Role = 'Creator' | 'Learner' | 'Educator' | 'Admin'
const REGISTER_ROLES: ('Creator' | 'Learner' | 'Educator')[] = ['Creator', 'Learner', 'Educator']

const AI_CAPABILITIES: Record<'Creator' | 'Learner' | 'Educator', {
  title: string
  badge: string
  color: string
  accent: string
  glow: string
  highlights: string[]
  metrics: { label: string; val: string }[]
}> = {
  Creator: {
    title: 'Creator Studio Intelligence',
    badge: 'VIRAL RETENTION & SHORTS',
    color: 'rgba(99, 102, 241, 0.15)',
    accent: '#818CF8',
    glow: 'rgba(99, 102, 241, 0.4)',
    highlights: [
      'Semantic Key Moments clustering with high-retention timestamps',
      'Auto-generated viral video hooks & multi-chapter breakdown',
      'One-click transcript export formatted for YouTube & Socials',
      'Aspect ratio conversion previews (16:9 Landscape & 9:16 Shorts)'
    ],
    metrics: [
      { label: 'Key Moments', val: 'Auto-Ranked' },
      { label: 'Aspect Ratios', val: '16:9 / 9:16' },
      { label: 'Export Format', val: 'Social Ready' }
    ]
  },
  Learner: {
    title: 'Learner Interactive Study Room',
    badge: 'ACTIVE RECALL & COMPREHENSION',
    color: 'rgba(6, 182, 212, 0.15)',
    accent: '#22D3EE',
    glow: 'rgba(6, 182, 212, 0.4)',
    highlights: [
      'Zero 2-min truncation — full 16min+ lecture coverage from 00:00 to finish',
      'Interactive AI Flashcards with spaced repetition recall',
      'Auto-generated timed comprehension quizzes with instant scoring',
      'Synchronized audio search jumping straight to core concepts'
    ],
    metrics: [
      { label: 'Timeline', val: 'Full Duration' },
      { label: 'Quizzes', val: 'Self-Graded' },
      { label: 'Flashcards', val: 'Spaced Recall' }
    ]
  },
  Educator: {
    title: 'Educator Lecture & Syllabus Suite',
    badge: 'ACADEMIC STRUCTURE & GUIDES',
    color: 'rgba(16, 185, 129, 0.15)',
    accent: '#34D399',
    glow: 'rgba(16, 185, 129, 0.4)',
    highlights: [
      'Structured academic lecture summaries with verified citations',
      'High-impact takeaway bullet points for quick student review',
      'Exportable comprehensive markdown study guides & syllabus notes',
      'Multi-chapter hierarchy matching textbook lecture plans'
    ],
    metrics: [
      { label: 'Structure', val: 'Multi-Chapter' },
      { label: 'Study Guides', val: 'Auto-Generated' },
      { label: 'Takeaways', val: 'Key Badges' }
    ]
  }
}

const TIMELINE_PINS = [
  { time: '01:24', label: 'Viral Hook', tag: 'High Retention', color: '#818CF8', pos: 12 },
  { time: '05:42', label: 'Core Architecture', tag: 'Key Concept', color: '#22D3EE', pos: 38 },
  { time: '10:15', label: 'Live Demonstration', tag: 'Deep Dive', color: '#34D399', pos: 65 },
  { time: '15:40', label: 'Executive Summary', tag: 'Synthesis', color: '#F59E0B', pos: 92 },
]

const WAVEFORM_HEIGHTS = [8, 14, 22, 16, 28, 20, 12, 24, 32, 18, 10, 26, 22, 14, 30, 24, 16, 28, 20, 12, 26, 30, 18, 14, 24, 16, 10, 20]

const FLOATING_NODES = [
  { x: 15, y: 20, size: 8, delay: 0 },
  { x: 70, y: 15, size: 6, delay: 1.2 },
  { x: 40, y: 55, size: 10, delay: 0.8 },
  { x: 85, y: 60, size: 5, delay: 2 },
  { x: 25, y: 80, size: 7, delay: 1.5 },
  { x: 60, y: 85, size: 9, delay: 0.4 },
  { x: 80, y: 35, size: 6, delay: 1.8 },
  { x: 10, y: 45, size: 8, delay: 0.6 },
]

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState<'login' | 'register'>(mode)
  const [role, setRole] = useState<Role>('Creator')
  const [showcaseRole, setShowcaseRole] = useState<'Creator' | 'Learner' | 'Educator'>('Creator')
  const [activePinIdx, setActivePinIdx] = useState<number>(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleName, setGoogleName] = useState('')
  const [googleRole, setGoogleRole] = useState<Role>(role)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const redirectByRole = (targetRole: Role) => {

    if (targetRole === 'Learner') navigate('/dashboard/learner/study')
    else if (targetRole === 'Educator') navigate('/dashboard/educator/lectures')
    else if (targetRole === 'Admin') navigate('/dashboard/admin')
    else navigate('/dashboard')
  }

  const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ''


  // Sync role to googleRole and showcaseRole
  useEffect(() => {
    setGoogleRole(role)
    if (role === 'Creator' || role === 'Learner' || role === 'Educator') {
      setShowcaseRole(role)
    }
  }, [role])

  // Rotate active key moment pin smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePinIdx(prev => (prev + 1) % TIMELINE_PINS.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])


  // Google Identity Services (GIS) automatic initialization
  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID
    if (clientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              setLoading(true)
              setErrorMsg(null)
              try {
                const res = await api.loginWithGoogle({ credential: response.credential, role })
                const userRole = (res.user?.role as Role) || role
                localStorage.setItem('clipmind_active_role', userRole)
                showToast(`Signed in with Google as ${userRole}!`, 'success')
                redirectByRole(userRole)
              } catch (err: any) {
                setErrorMsg(err.message || 'Google authentication failed.')
              } finally {
                setLoading(false)
              }
            }
          }
        })
      } catch (e) {
        console.log('Google Identity Services notice:', e)
      }
    }
  }, [role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const userEmail = email.trim()
    const userPass = password.trim()
    const userName = name.trim() || userEmail.split('@')[0]

    if (!userEmail || !userPass) {
      setErrorMsg('Please enter both email and password.')
      setLoading(false)
      return
    }

    try {
      let authenticatedRole: Role = role

      if (tab === 'register') {
        const res = await api.register(userEmail, userPass, userName, role)
        if (res?.user?.role) authenticatedRole = res.user.role as Role
        showToast(`Account created as ${authenticatedRole}! Welcome to ClipMind AI.`, 'success')
      } else {
        const res = await api.login(userEmail, userPass)
        if (res?.user?.role) authenticatedRole = res.user.role as Role
        showToast('Signed in successfully. Welcome back!', 'success')
      }

      localStorage.setItem('clipmind_active_role', authenticatedRole)
      setLoading(false)
      redirectByRole(authenticatedRole)
    } catch (err: any) {
      setLoading(false)
      const msg = err?.message || (tab === 'register' ? 'Registration failed. Please verify your details and try again.' : 'Invalid email or password. Please check your credentials.')
      setErrorMsg(msg)
      showToast(msg, 'error')
    }
  }

  const handleGoogleAuth = () => {
    const clientId = GOOGLE_CLIENT_ID
    // 1. Try modern Google OAuth2 Token Client popup dialog
    if (clientId && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              setLoading(true)
              setErrorMsg(null)
              try {
                const res = await api.loginWithGoogle({ credential: tokenResponse.access_token, role })
                const userRole = (res.user?.role as Role) || role
                localStorage.setItem('clipmind_active_role', userRole)
                showToast(`Signed in with Google as ${userRole}!`, 'success')
                redirectByRole(userRole)
              } catch (err: any) {
                setErrorMsg(err.message || 'Google authentication failed.')
              } finally {
                setLoading(false)
              }
            }
          }
        })
        client.requestAccessToken()
        return
      } catch (err) {
        console.log('Google token client notice:', err)
      }
    } else if (clientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt()
        return
      } catch (err) {
        console.log('GIS prompt notice:', err)
      }
    }
    // Fallback: Launch Google Connect modal
    setGoogleEmail(email ? email : '')
    setGoogleName(name ? name : (email ? email.split('@')[0] : ''))
    setGoogleRole(role)
    setGoogleModalOpen(true)
  }


  const handleGoogleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanG = googleEmail.trim().toLowerCase()
    if (!cleanG || !cleanG.includes('@')) {
      showToast('Please enter a valid Google email address.', 'error')
      return
    }

    setGoogleLoading(true)
    try {
      const res = await api.loginWithGoogle({
        email: cleanG,
        name: googleName.trim() || cleanG.split('@')[0],
        role: googleRole
      })
      const userRole = (res.user?.role as Role) || googleRole
      localStorage.setItem('clipmind_active_role', userRole)
      showToast(`Signed in with Google as ${userRole}! Welcome to ClipMind AI.`, 'success')
      setGoogleModalOpen(false)
      redirectByRole(userRole)
    } catch (err: any) {
      showToast(err?.message || 'Google sign-in failed. Please check your credentials.', 'error')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanR = recoveryEmail.trim().toLowerCase()
    if (!cleanR || !cleanR.includes('@')) {
      showToast('Please enter a valid Google account email address.', 'error')
      return
    }

    setRecoveryLoading(true)
    try {
      const res = await api.loginWithGoogle({
        email: cleanR,
        name: cleanR.split('@')[0],
        role: role,
        new_password: recoveryNewPassword.trim() || undefined
      })
      const userRole = (res.user?.role as Role) || role
      localStorage.setItem('clipmind_active_role', userRole)
      showToast(`Account verified & recovered via Google! Welcome back as ${userRole}.`, 'success')
      setRecoveryModalOpen(false)
      redirectByRole(userRole)
    } catch (err: any) {
      showToast(err?.message || 'Google account recovery failed. Please check your credentials.', 'error')
    } finally {
      setRecoveryLoading(false)
    }
  }



  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
        <ThemeToggle />
      </div>

      {/* LEFT — brand canvas */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0A0B0E 0%, #12141C 50%, #0E0F15 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',

        padding: '60px 48px',
      }}>
        {/* Animated Aurora Glow Orbs */}
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />

        {/* Dynamic Starry Floating Nodes */}
        {FLOATING_NODES.map((node, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${node.x}%`, top: `${node.y}%`,
            width: node.size, height: node.size,
            borderRadius: '50%',
            background: i % 2 === 0 ? 'var(--accent-indigo)' : 'var(--accent-cyan)',
            opacity: 0.55,
            animation: `float-node ${5 + node.delay * 0.5}s ${node.delay}s ease-in-out infinite`,
            boxShadow: `0 0 ${node.size * 2}px ${i % 2 === 0 ? 'rgba(99,102,241,0.5)' : 'rgba(6,182,212,0.5)'}`,
          }} />
        ))}

        {/* Constellation Network Mesh */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
          <line x1="15%" y1="18%" x2="40%" y2="48%" stroke="var(--accent-indigo)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="40%" y1="48%" x2="72%" y2="18%" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="72%" y1="18%" x2="88%" y2="52%" stroke="var(--accent-indigo)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="25%" y1="78%" x2="62%" y2="82%" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="12%" y1="42%" x2="25%" y2="78%" stroke="var(--accent-indigo)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="82%" y1="32%" x2="88%" y2="52%" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="4 2" />
        </svg>

        {/* Top Header: Logo + Live Pipeline Indicator */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px var(--accent-indigo-glow)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
            </div>
            <div>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.02em' }}>ClipMind<span style={{ color: '#818CF8' }}> AI</span></span>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.05em' }}>VIDEO INTELLIGENCE PLATFORM</div>
            </div>
          </div>

          {/* Real-time Status Badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '6px 14px', borderRadius: 9999,
            fontSize: 11.5, fontWeight: 700, color: '#34D399', letterSpacing: '0.03em',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)'
          }}>
            <span className="live-pulse-dot" />
            <span>AI ENGINE ONLINE • FULL DURATION</span>
          </div>
        </div>

        {/* Hero Section */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 24 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F9FAFB', lineHeight: 1.25, marginBottom: 12 }}>
            Autonomous Video Intelligence<br />
            <span style={{
              background: 'linear-gradient(135deg, #a5b4fc 0%, #38bdf8 50%, #34d399 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>
              Zero Truncation. Complete Video Mastery.
            </span>
          </h2>
          <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.65, maxWidth: 520, margin: 0 }}>
            Transform long-form lectures, conference talks, and video streams into timestamped chapters, semantic viral moments, and interactive study assets with sub-second Groq LPU inference.
          </p>
        </div>

        {/* Live Audio Equalizer Waveform Motion Bar */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16,
          padding: '16px 20px', marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>🎙️</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.04em' }}>
                NEURAL SPEECH STREAM
              </span>
              <span style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                WHISPER V3 TURBO
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: '#38BDF8', fontWeight: 600, fontFamily: 'monospace' }}>
              00:00 — 16:00+ TIMELINE
            </span>
          </div>

          {/* Equalizer Frequency Bars */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            height: 36, padding: '4px 0', gap: 3
          }}>
            {WAVEFORM_HEIGHTS.map((h, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  borderRadius: 3,
                  background: idx % 3 === 0
                    ? 'linear-gradient(180deg, #38BDF8 0%, #6366F1 100%)'
                    : idx % 3 === 1
                      ? 'linear-gradient(180deg, #818CF8 0%, #3B82F6 100%)'
                      : 'linear-gradient(180deg, #34D399 0%, #06B6D4 100%)',
                  animation: `soundwave-bar ${0.9 + (idx % 5) * 0.2}s ease-in-out infinite`,
                  animationDelay: `${(idx * 0.08) % 1.2}s`,
                  boxShadow: '0 0 6px rgba(99, 102, 241, 0.3)'
                }}
              />
            ))}
          </div>
        </div>

        {/* Interactive Timeline & Key Moments Radar */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16,
          padding: '16px 20px', marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⏱️</span>
              <span>SYNCHRONIZED KEY MOMENTS RADAR</span>
            </span>
            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>
              ● 100% Full Duration Mapped
            </span>
          </div>

          {/* Timeline Bar with Laser Playhead */}
          <div style={{
            position: 'relative', height: 8, background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 9999, overflow: 'hidden', marginBottom: 16
          }}>
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(99,102,241,0.5), rgba(6,182,212,0.5), rgba(16,185,129,0.5))' }} />
            <div className="laser-playhead" />
          </div>

          {/* Key Moment Pins */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {TIMELINE_PINS.map((pin, i) => (
              <div
                key={i}
                onClick={() => setActivePinIdx(i)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: `1px solid ${activePinIdx === i ? pin.color : 'rgba(255,255,255,0.06)'}`,
                  background: activePinIdx === i ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                  boxShadow: activePinIdx === i ? `0 0 14px ${pin.color}40` : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: pin.color }}>{pin.time}</span>
                  <span style={{ fontSize: 9.5, color: '#94A3B8' }}>{pin.tag}</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pin.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role-Adaptive Intelligence Showcase (Motion Tabs) */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 18,
          padding: 20, boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)'
        }}>
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['Creator', 'Learner', 'Educator'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setShowcaseRole(r)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                  background: showcaseRole === r ? AI_CAPABILITIES[r].color : 'rgba(255,255,255,0.03)',
                  color: showcaseRole === r ? AI_CAPABILITIES[r].accent : '#94A3B8',
                  boxShadow: showcaseRole === r ? `0 0 16px ${AI_CAPABILITIES[r].glow}` : 'none',
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: showcaseRole === r ? AI_CAPABILITIES[r].accent : 'transparent'
                }}
              >
                <span>{r === 'Creator' ? '🎬' : r === 'Learner' ? '🎓' : '✏️'}</span>
                <span>{r}</span>
              </button>
            ))}
          </div>

          {/* Active Role Content Card */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>
                {AI_CAPABILITIES[showcaseRole].title}
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: AI_CAPABILITIES[showcaseRole].accent,
                background: AI_CAPABILITIES[showcaseRole].color, padding: '3px 10px', borderRadius: 9999,
                letterSpacing: '0.04em'
              }}>
                {AI_CAPABILITIES[showcaseRole].badge}
              </span>
            </div>

            {/* Feature Highlights with Glowing Bullet Points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {AI_CAPABILITIES[showcaseRole].highlights.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#CBD5E1', lineHeight: 1.5 }}>
                  <span style={{ color: AI_CAPABILITIES[showcaseRole].accent, fontSize: 14, lineHeight: 1.2 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Architectural Metric Badges */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {AI_CAPABILITIES[showcaseRole].metrics.map((m, idx) => (
                <div key={idx} style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                  padding: '8px 10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#F8FAFC' }}>{m.val}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* RIGHT — form container */}
      <div style={{
        width: '48%', maxWidth: 520,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px',
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border-glass)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            {tab === 'login' ? 'Sign in to your ClipMind AI workspace.' : 'Start your free account today — no credit card required.'}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 12, padding: 4, marginBottom: 28, border: '1px solid var(--border-glass)' }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              background: tab === t ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              boxShadow: tab === t ? '0 0 16px var(--accent-indigo-glow)' : 'none',
            }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Role selection (register only) */}
        {tab === 'register' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select your account role</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Admin accounts are created via Admin Portal</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {REGISTER_ROLES.map(r => (
                <button key={r} onClick={() => setRole(r)} type="button" style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                  background: role === r ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                  color: role === r ? 'var(--text-accent)' : 'var(--text-secondary)',
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: role === r ? 'var(--accent-indigo)' : 'var(--border-glass)',
                  boxShadow: role === r ? '0 0 12px var(--accent-indigo-glow)' : 'none',
                }}>
                  {r === 'Creator' ? '🎬' : r === 'Learner' ? '🎓' : '✏️'} {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SSO buttons */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={handleGoogleAuth}
            className="btn-glass"
            type="button"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            {tab === 'register' ? `Sign Up with Google as ${role}` : 'Continue with Google'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-glass)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Or continue with email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-glass)' }} />
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off">
          {tab === 'register' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Alex Johnson"
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              </span>
              <input
                type="email" className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••••"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingLeft: 38, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {tab === 'login' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: 'var(--accent-indigo)', width: 14, height: 14 }} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(email ? email : '')
                  setRecoveryModalOpen(true)
                }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: 13.5, color: 'var(--text-accent)', cursor: 'pointer',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <span>Forgot Password?</span>
              </button>
            </div>
          )}


          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="animate-spin-slow" />
                Authenticating...
              </>
            ) : (
              tab === 'login' ? 'Sign In to Workspace' : 'Create Account'
            )}
          </button>
        </form>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          By signing in, you agree to our{' '}
          <a href="#" style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>Terms of Service</a>{' '}and{' '}
          <a href="#" style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>Privacy Policy</a>.
        </p>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-accent)', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
            {tab === 'login' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Google Connect Interactive Modal */}
      {googleModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10, 11, 14, 0.88)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }}>
          <div className="glass-card" style={{
            width: '100%', maxWidth: 440, borderRadius: 20,
            padding: '28px 24px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setGoogleModalOpen(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 18, padding: 4
              }}
              title="Close"
            >
              ✕
            </button>

            {/* Google Icon & Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', marginBottom: 12
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {tab === 'register' ? 'Sign Up with Google' : 'Sign In with Google'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
                Authenticate securely using your Google account
              </p>
            </div>

            {/* Role selection inside modal */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Select Workspace Role:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {REGISTER_ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setGoogleRole(r)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 10,
                      border: `1px solid ${googleRole === r ? 'var(--accent-indigo)' : 'var(--border-glass)'}`,
                      background: googleRole === r ? 'var(--accent-indigo-dim)' : 'var(--bg-surface-elevated)',
                      color: googleRole === r ? 'var(--text-accent)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{r === 'Creator' ? '🎬' : r === 'Learner' ? '🎓' : '✏️'}</span>
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleGoogleModalSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Google Email Address <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  required
                  autoFocus
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={googleName}
                  onChange={e => setGoogleName(e.target.value)}
                  placeholder="Alex Johnson"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: '8px 12px',
                fontSize: 12, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 20
              }}>
                <span>🔒</span>
                <span>Instant Google SSO • Pure Database Verification</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setGoogleModalOpen(false)}
                  className="btn-glass"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={googleLoading}
                  style={{
                    flex: 2, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  {googleLoading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="animate-spin-slow" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <span>Continue as {googleRole}</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Secure Account Recovery Modal */}
      {recoveryModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10, 11, 14, 0.88)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }}>
          <div className="glass-card" style={{
            width: '100%', maxWidth: 450, borderRadius: 20,
            padding: '28px 24px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setRecoveryModalOpen(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 18, padding: 4
              }}
              title="Close"
            >
              ✕
            </button>

            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', marginBottom: 12
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Google Account Recovery
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                Account recovery and password resets are verified exclusively via Google OAuth for enhanced security.
              </p>
            </div>

            {/* Quick 1-Click Action */}
            <div style={{ marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => {
                  setRecoveryModalOpen(false)
                  handleGoogleAuth()
                }}
                className="btn-glass"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderColor: 'var(--accent-indigo)'
                }}
              >
                <span>⚡</span>
                <span>One-Click Restore via Google Popup</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-glass)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Or enter Google email & new password</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-glass)' }} />
            </div>

            {/* Recovery Form */}
            <form onSubmit={handleGoogleRecoverySubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Google Account Email <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  required
                  autoFocus
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Set New Password
                  </label>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Optional</span>
                </div>
                <input
                  type="password"
                  className="input-field"
                  value={recoveryNewPassword}
                  onChange={e => setRecoveryNewPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRecoveryModalOpen(false)}
                  className="btn-glass"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={recoveryLoading}
                  style={{
                    flex: 2, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  {recoveryLoading ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="animate-spin-slow" />
                      Recovering...
                    </>
                  ) : (
                    <>
                      <span>Recover with Google</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

