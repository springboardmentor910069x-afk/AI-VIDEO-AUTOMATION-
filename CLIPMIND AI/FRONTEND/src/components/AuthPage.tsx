import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useToast } from './Toast'

import { api } from '../services/api'

type Role = 'Creator' | 'Learner' | 'Educator' | 'Admin'
const REGISTER_ROLES: ('Creator' | 'Learner' | 'Educator')[] = ['Creator', 'Learner', 'Educator']

const TESTIMONIALS = [
  { quote: "ClipMind AI saved our university research team over 20 hours a week reviewing conference recordings.", author: "Dr. Elena Rostova", role: "AI Researcher, MIT" },
  { quote: "I process 10+ YouTube lectures daily for my students. ClipMind AI turns them into structured study guides instantly.", author: "Prof. James Okafor", role: "CS Professor, Stanford" },
  { quote: "As a content creator, ClipMind AI helps me find the best clips from 3-hour streams in seconds.", author: "Maya Chen", role: "Tech Creator, 450K subscribers" },
]

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleName, setGoogleName] = useState('')
  const [googleRole, setGoogleRole] = useState<Role>(role)
  const [googleLoading, setGoogleLoading] = useState(false)

  const redirectByRole = (targetRole: Role) => {
    if (targetRole === 'Learner') navigate('/dashboard/learner/study')
    else if (targetRole === 'Educator') navigate('/dashboard/educator/lectures')
    else if (targetRole === 'Admin') navigate('/dashboard/admin')
    else navigate('/dashboard')
  }

  // Sync role to googleRole
  useEffect(() => {
    setGoogleRole(role)
  }, [role])

  // Optional Google Identity Services (GIS) automatic initialization
  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
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
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
    if (clientId && typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt()
        return
      } catch (err) {
        console.log('GIS prompt notice:', err)
      }
    }
    // Launch Google Connect modal
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


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
        <ThemeToggle />
      </div>

      {/* LEFT — brand canvas */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0B0F19 0%, #0f1629 50%, #0a1020 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        {/* Floating nodes */}
        {FLOATING_NODES.map((node, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${node.x}%`, top: `${node.y}%`,
            width: node.size, height: node.size,
            borderRadius: '50%',
            background: i % 2 === 0 ? 'var(--accent-indigo)' : 'var(--accent-cyan)',
            opacity: 0.6,
            animation: `float-node ${5 + node.delay * 0.5}s ${node.delay}s ease-in-out infinite`,
            boxShadow: `0 0 ${node.size * 2}px ${i % 2 === 0 ? 'rgba(99,102,241,0.5)' : 'rgba(6,182,212,0.5)'}`,
          }} />
        ))}

        {/* SVG connecting lines (decorative) */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
          <line x1="15%" y1="20%" x2="40%" y2="55%" stroke="var(--accent-indigo)" strokeWidth="1" />
          <line x1="40%" y1="55%" x2="70%" y2="15%" stroke="var(--accent-cyan)" strokeWidth="1" />
          <line x1="70%" y1="15%" x2="85%" y2="60%" stroke="var(--accent-indigo)" strokeWidth="1" />
          <line x1="25%" y1="80%" x2="60%" y2="85%" stroke="var(--accent-cyan)" strokeWidth="1" />
          <line x1="10%" y1="45%" x2="25%" y2="80%" stroke="var(--accent-indigo)" strokeWidth="1" />
          <line x1="80%" y1="35%" x2="85%" y2="60%" stroke="var(--accent-cyan)" strokeWidth="1" />
        </svg>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 'auto', paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px var(--accent-indigo-glow)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>ClipMind<span style={{ color: '#818CF8' }}> AI</span></span>
          </div>
        </div>

        {/* Main visual text */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: '#F9FAFB', lineHeight: 1.2, marginBottom: 16 }}>
            AI that understands<br />
            <span style={{ background: 'linear-gradient(135deg, #a5b4fc, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              every spoken word.
            </span>
          </h2>
          <p style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1.7, maxWidth: 420, marginBottom: 40 }}>
            Join 12,000+ creators, students, and educators who transform hours of video content into structured, searchable knowledge.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 48 }}>
            {[['10,000+', 'Hours Processed'], ['96.4%', 'WER Accuracy'], ['12,000+', 'Active Users']].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#F9FAFB' }}>{val}</div>
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial carousel */}
          <div style={{
            background: 'rgba(17,24,39,0.7)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24,
          }}>
            <div style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>
              "{TESTIMONIALS[testimonialIdx].quote}"
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {TESTIMONIALS[testimonialIdx].author[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{TESTIMONIALS[testimonialIdx].author}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{TESTIMONIALS[testimonialIdx].role}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {TESTIMONIALS.map((_, i) => (
                  <button key={i} onClick={() => setTestimonialIdx(i)} style={{
                    width: i === testimonialIdx ? 20 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: i === testimonialIdx ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.2s',
                  }} />
                ))}
              </div>
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
              <a href="#" style={{ fontSize: 14, color: 'var(--text-accent)', textDecoration: 'none', fontWeight: 600 }}>Forgot Password?</a>
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
          background: 'rgba(5, 8, 16, 0.82)', backdropFilter: 'blur(12px)',
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
    </div>
  )
}
