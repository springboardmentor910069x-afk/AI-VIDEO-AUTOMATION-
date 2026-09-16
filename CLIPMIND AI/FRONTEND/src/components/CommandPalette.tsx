import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './Toast'

interface Command {
  id: string
  icon: string
  label: string
  category: string
  shortcut?: string
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
}

const RECENT_SEARCHES = [
  'Video summaries',
  'Key moment detection',
  'Transcript search',
]

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const COMMANDS: Command[] = [
    { id: 'nav-upload', icon: '', label: 'Upload New Video', category: 'Navigation', shortcut: 'U', action: () => { showToast('Opening Upload Studio...', 'info'); navigate('/dashboard/upload'); onClose() } },
    { id: 'nav-library', icon: '', label: 'Video Library', category: 'Navigation', shortcut: 'L', action: () => { showToast('Opening Video Library...', 'info'); navigate('/dashboard/videos'); onClose() } },
    { id: 'nav-analytics', icon: '', label: 'Analytics Dashboard', category: 'Navigation', action: () => { showToast('Opening Analytics Dashboard...', 'info'); navigate('/dashboard/analytics'); onClose() } },
    { id: 'nav-bookmarks', icon: '', label: 'Bookmarks & Notes', category: 'Navigation', action: () => { showToast('Opening Bookmarks & Notes...', 'info'); navigate('/dashboard/bookmarks'); onClose() } },
    { id: 'nav-learner', icon: '', label: 'Learner Study Room', category: 'Navigation', action: () => { showToast('Opening Study Room...', 'info'); navigate('/dashboard/learner/study'); onClose() } },
    { id: 'nav-educator', icon: '', label: 'Educator Lecture Studio', category: 'Navigation', action: () => { showToast('Opening Educator Studio...', 'info'); navigate('/dashboard/educator/lectures'); onClose() } },
    { id: 'nav-admin', icon: '', label: 'Admin Dashboard', category: 'Navigation', action: () => { showToast('Opening Admin Console...', 'info'); navigate('/dashboard/admin'); onClose() } },
    { id: 'nav-settings', icon: '', label: 'Account Settings', category: 'Navigation', action: () => { showToast('Opening Settings...', 'info'); navigate('/dashboard/settings'); onClose() } },
    { id: 'action-theme', icon: '', label: 'Toggle Dark / Light Theme', category: 'Actions', shortcut: 'T', action: () => { document.documentElement.classList.toggle('light'); showToast('Theme toggled', 'success'); onClose() } },
    { id: 'action-shortcut', icon: '⌨️', label: 'View Keyboard Shortcuts', category: 'Actions', action: () => {
      showToast('Keyboard shortcuts listed in dialog', 'info')
      window.alert('Keyboard shortcuts:\n⌘K — Open Command Palette\nU — Upload New Video\nT — Toggle Dark / Light Theme\nL — Video Library\nEsc — Close Palette')
      onClose()
    } },
  ]

  const storedUserRole = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('clipmind_user') || '{}')
      return u.role || 'Creator'
    } catch (e) {
      return 'Creator'
    }
  })()

  const allowedCommands = COMMANDS.filter(cmd => {
    if (cmd.id === 'nav-admin' && storedUserRole !== 'Admin') return false
    if (cmd.id === 'nav-educator' && storedUserRole !== 'Educator' && storedUserRole !== 'Admin') return false
    return true
  })

  const filtered = query.trim()
    ? allowedCommands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : allowedCommands

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setSelectedIdx(0) }, [query])

  const filteredRef = useRef(filtered)
  filteredRef.current = filtered

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filteredRef.current.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      setSelectedIdx(cur => {
        const cmd = filteredRef.current[cur]
        if (cmd) cmd.action()
        return cur
      })
    }
  }, [open, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-card" style={{
        width: '100%', maxWidth: 600,
        border: '1px solid var(--accent-indigo)',
        boxShadow: '0 0 60px var(--accent-indigo-glow), 0 24px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden', borderRadius: 16,
      }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-glass)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search videos, transcripts, commands, notes..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <kbd style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 4, padding: '2px 6px' }}>ESC</kbd>
        </div>

        {/* Recent searches (when empty query) */}
        {!query && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Recent Searches</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RECENT_SEARCHES.map(s => (
                <button key={s} onClick={() => setQuery(s)} className="tag-pill" style={{ fontSize: 12 }}>
                   {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 380, overflowY: 'auto' }}>
          {(() => {
            let globalIdx = 0
            return Object.entries(grouped).map(([category, cmds]) => (
              <div key={category}>
                <div style={{ padding: '8px 18px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {category}
                </div>
                {cmds.map(cmd => {
                  const myIdx = globalIdx++
                  const isSelected = myIdx === selectedIdx
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIdx(myIdx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 18px', border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
                        background: isSelected ? 'var(--accent-indigo-dim)' : 'none',
                        borderLeft: isSelected ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{cmd.icon}</span>
                      <span style={{ flex: 1, fontSize: 14, color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)', textAlign: 'left', fontWeight: isSelected ? 600 : 400 }}>{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 4, padding: '1px 6px' }}>⌘{cmd.shortcut}</kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          })()}

          {filtered.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}></div>
              No results for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span><kbd style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>↵</kbd> Select</span>
          <span><kbd style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
