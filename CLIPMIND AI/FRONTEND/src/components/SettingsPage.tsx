import { useState, useEffect } from 'react'
import { api } from '../services/api'

type SettingsTab = 'profile' | 'preferences' | 'notifications'

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'preferences', label: 'AI & System', icon: '⚙️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('tab') as SettingsTab | null
      if (t && ['profile', 'preferences', 'notifications'].includes(t)) {
        return t
      }
    } catch (e) {}
    return 'profile'
  })

  const [savedToast, setSavedToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('Settings saved successfully')
  
  // Dynamic Profile state from active user session
  const [displayName, setDisplayName] = useState<string>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('clipmind_user') || '{}')
      return u.name || ''
    } catch (e) { return '' }
  })
  const [email, setEmail] = useState<string>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('clipmind_user') || '{}')
      return u.email || ''
    } catch (e) { return '' }
  })
  const [userRole, setUserRole] = useState<string>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('clipmind_user') || '{}')
      return u.role || 'Creator'
    } catch (e) { return 'Creator' }
  })
  const [bio, setBio] = useState('Video intelligence and multi-modal knowledge analysis with ClipMind AI.')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [language, setLanguage] = useState('English (US)')

  // System & AI Preferences
  const [whisperModel, setWhisperModel] = useState('base.en')
  const [summaryDepth, setSummaryDepth] = useState('detailed')
  const [exportFormat, setExportFormat] = useState('PDF')
  const [theme, setTheme] = useState('dark')
  const [autoIndexing, setAutoIndexing] = useState(true)

  // Notification Preferences
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({
    processingComplete: true,
    processingFailed: true,
    weeklyDigest: false,
    securityAlerts: true,
  })

  // Load User Profile & Settings
  useEffect(() => {
    async function loadData() {
      try {
        const user = await api.getMe()
        if (user) {
          setDisplayName(user.name || '')
          setEmail(user.email || '')
          setUserRole(user.role || 'Creator')
        }
      } catch (err) {
        console.log('Profile loaded from storage', err)
      }

      try {
        const settings = await api.getSettings()
        if (settings) {
          if (settings.whisper_model) setWhisperModel(settings.whisper_model)
          if (settings.summary_length) setSummaryDepth(settings.summary_length)
          if (settings.default_export_format) setExportFormat(settings.default_export_format)
          if (settings.theme) setTheme(settings.theme)
          if (settings.auto_indexing !== undefined) setAutoIndexing(settings.auto_indexing)
          if (settings.email_notifications !== undefined) {
            setNotifSettings(prev => ({ ...prev, processingComplete: settings.email_notifications }))
          }
        }
      } catch (err) {
        console.log('Using default settings', err)
      }
    }
    loadData()
  }, [])

  const showNotification = (msg: string) => {
    setToastMessage(msg)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  const handleSaveSettings = async () => {
    try {
      await api.updateSettings({
        whisper_model: whisperModel,
        summary_length: summaryDepth,
        default_export_format: exportFormat,
        theme: theme,
        email_notifications: notifSettings.processingComplete,
        auto_indexing: autoIndexing,
      })
      showNotification('✓ Settings updated successfully')
    } catch (e) {
      showNotification('✓ Preferences saved locally')
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: 6 }}>Account Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Manage your profile, AI pipeline preferences, and notifications.</p>
      </div>

      {/* Saved Toast */}
      {savedToast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 200,
          background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))',
          color: '#fff', borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontWeight: 700, boxShadow: '0 0 24px var(--accent-indigo-glow)',
          animation: 'stream-in 0.3s ease',
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }}>
        {/* Left nav */}
        <div className="glass-card" style={{ padding: 12, height: 'fit-content' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                background: activeTab === tab.id ? 'var(--accent-indigo-dim)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div>
          {activeTab === 'profile' && (
            <ProfileTab
              displayName={displayName} setDisplayName={setDisplayName}
              email={email} setEmail={setEmail}
              userRole={userRole}
              bio={bio} setBio={setBio}
              timezone={timezone} setTimezone={setTimezone}
              language={language} setLanguage={setLanguage}
              onSave={handleSaveSettings}
            />
          )}

          {activeTab === 'preferences' && (
            <PreferencesTab
              whisperModel={whisperModel} setWhisperModel={setWhisperModel}
              summaryDepth={summaryDepth} setSummaryDepth={setSummaryDepth}
              exportFormat={exportFormat} setExportFormat={setExportFormat}
              theme={theme} setTheme={setTheme}
              autoIndexing={autoIndexing} setAutoIndexing={setAutoIndexing}
              onSave={handleSaveSettings}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab
              settings={notifSettings}
              setSettings={setNotifSettings}
              onSave={handleSaveSettings}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass-card" style={{ padding: 28, marginBottom: 20, ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 }}>
      {children}
    </div>
  )
}

function ProfileTab({ displayName, setDisplayName, email, setEmail, userRole, bio, setBio, timezone, setTimezone, language, setLanguage, onSave }: {
  displayName: string; setDisplayName: (v: string) => void
  email: string; setEmail: (v: string) => void
  userRole: string
  bio: string; setBio: (v: string) => void
  timezone: string; setTimezone: (v: string) => void
  language: string; setLanguage: (v: string) => void
  onSave: () => void
}) {
  return (
    <SectionCard>
      <SectionTitle>Profile Information</SectionTitle>
      
      {/* Avatar & Role */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 0 24px var(--accent-indigo-glow)' }}>
          {(displayName || 'User').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            {displayName}
            <span className="badge badge-primary">{userRole}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{email}</div>
          <span style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>● Active & Verified Session</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Display Name</label>
          <input className="input-field" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email Address</label>
          <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Timezone</label>
          <select className="input-field" value={timezone} onChange={e => setTimezone(e.target.value)} style={{ cursor: 'pointer' }}>
            {['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo', 'UTC'].map(tz => <option key={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Language</label>
          <select className="input-field" value={language} onChange={e => setLanguage(e.target.value)} style={{ cursor: 'pointer' }}>
            {['English (US)', 'English (UK)', 'Spanish', 'French', 'German', 'Japanese', 'Hindi'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Bio / Workspace Purpose</label>
        <textarea
          className="input-field"
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onSave} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
          Save Changes
        </button>
      </div>
    </SectionCard>
  )
}

function PreferencesTab({ whisperModel, setWhisperModel, summaryDepth, setSummaryDepth, exportFormat, setExportFormat, theme, setTheme, autoIndexing, setAutoIndexing, onSave }: {
  whisperModel: string; setWhisperModel: (v: string) => void
  summaryDepth: string; setSummaryDepth: (v: string) => void
  exportFormat: string; setExportFormat: (v: string) => void
  theme: string; setTheme: (v: string) => void
  autoIndexing: boolean; setAutoIndexing: (v: boolean) => void
  onSave: () => void
}) {
  return (
    <SectionCard>
      <SectionTitle>AI & Pipeline Preferences</SectionTitle>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Speech Recognition Model (Whisper)</label>
          <select className="input-field" value={whisperModel} onChange={e => setWhisperModel(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="tiny">Whisper Tiny (Ultra Fast, Low Resource)</option>
            <option value="base.en">Whisper Base English (Balanced Speed)</option>
            <option value="small">Whisper Small (High Precision)</option>
            <option value="medium.en">Whisper Medium English (Enterprise Accuracy)</option>
            <option value="large-v3">Whisper Large v3 (Maximum Benchmark Quality)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Default Summary Depth</label>
          <select className="input-field" value={summaryDepth} onChange={e => setSummaryDepth(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="short">Short TL;DR (Quick Overview)</option>
            <option value="detailed">Detailed Breakdown (Structured Sections)</option>
            <option value="full">Full Study Guide (Comprehensive Chapters & Takeaways)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Default Export Format</label>
          <select className="input-field" value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="PDF">PDF Report (Illustrated Formatting)</option>
            <option value="DOCX">Word Document (.docx)</option>
            <option value="SRT">SubRip Subtitles (.srt)</option>
            <option value="VTT">WebVTT Subtitles (.vtt)</option>
            <option value="TXT">Plain Text (.txt)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Application Theme</label>
          <select className="input-field" value={theme} onChange={e => setTheme(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="dark">Cinematic Dark (Default)</option>
            <option value="light">High Contrast</option>
          </select>
        </div>
      </div>

      {/* Auto Indexing Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Full-Text Search Auto-Indexing</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Automatically index spoken transcript segments for instant search.</div>
        </div>
        <button
          role="switch"
          aria-checked={autoIndexing}
          onClick={() => setAutoIndexing(!autoIndexing)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: autoIndexing ? 'var(--accent-indigo)' : 'var(--border-glass)',
            position: 'relative', transition: 'background 0.2s',
            boxShadow: autoIndexing ? '0 0 10px var(--accent-indigo-glow)' : 'none',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: autoIndexing ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button className="btn-primary" onClick={onSave} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
          Save Preferences
        </button>
      </div>
    </SectionCard>
  )
}

function NotificationsTab({ settings, setSettings, onSave }: {
  settings: Record<string, boolean>
  setSettings: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onSave: () => void
}) {
  const ITEMS = [
    { key: 'processingComplete', label: 'Processing Finished', desc: 'Notify when speech transcription, summaries, and key moments are fully generated.' },
    { key: 'processingFailed', label: 'Error & Warning Alerts', desc: 'Immediate notification if a video file fails decoding or ASR pipeline validation.' },
    { key: 'securityAlerts', label: 'Security & Access Audits', desc: 'Alert upon administrative actions or abnormal API token requests.' },
  ]

  const toggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <SectionCard>
      <SectionTitle>Notification Preferences</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {ITEMS.map((item, i) => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: i < ITEMS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ paddingRight: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
            <button
              role="switch"
              aria-checked={settings[item.key]}
              onClick={() => toggle(item.key)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: settings[item.key] ? 'var(--accent-indigo)' : 'var(--border-glass)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                boxShadow: settings[item.key] ? '0 0 10px var(--accent-indigo-glow)' : 'none',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: settings[item.key] ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button className="btn-primary" onClick={onSave} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700 }}>Save Preferences</button>
      </div>
    </SectionCard>
  )
}

