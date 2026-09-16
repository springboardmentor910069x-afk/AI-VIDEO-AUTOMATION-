import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface Bookmark {
  id: string
  videoTitle: string
  videoId: string
  timestamp: string
  note: string
  type: 'note' | 'flashcard' | 'highlight' | 'key-moment'
  text: string
  date: string
  tags: string[]
  color: string
}

type FilterType = 'all' | 'note' | 'flashcard' | 'highlight' | 'key-moment'

const TYPE_ICONS: Record<string, string> = {
  'note': '', 'flashcard': '', 'highlight': '', 'key-moment': ''
}
const TYPE_LABELS: Record<string, string> = {
  'note': 'Note', 'flashcard': 'Flashcard', 'highlight': 'Highlight', 'key-moment': 'Key Moment'
}

export default function BookmarksPage() {
  const navigate = useNavigate()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [exported, setExported] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBookmarks() {
      try {
        setLoading(true)
        const remote = await api.getBookmarks()
        if (remote && Array.isArray(remote)) {
          const mapped: Bookmark[] = remote.map(b => ({
            id: b.id,
            videoTitle: b.video_title || 'Saved Video Asset',
            videoId: b.video_id,
            timestamp: b.timestamp_str,
            note: b.note || b.label,
            type: 'key-moment',
            text: b.label,
            date: new Date(b.created_at).toLocaleDateString(),
            tags: ['#Saved', '#Bookmark'],
            color: 'var(--accent-indigo)'
          }))
          setBookmarks(mapped)
        }
      } catch (err) {
        console.log('Failed to fetch bookmarks:', err)
      } finally {
        setLoading(false)
      }
    }
    loadBookmarks()
  }, [])


  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAll = () => setSelected(new Set(filtered.map(b => b.id)))
  const clearSelection = () => setSelected(new Set())
  const deleteSelected = async () => {
    const idsToDelete = Array.from(selected)
    setSelected(new Set())
    setBookmarks(prev => prev.filter(b => !idsToDelete.includes(b.id)))
    for (const id of idsToDelete) {
      try {
        await api.deleteBookmark(id)
      } catch (err) {
        console.error(`Failed to delete bookmark ${id}:`, err)
      }
    }
  }

  const saveEdit = (id: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, note: editNote } : b))
    setEditingId(null)
  }

  const exportStudyGuide = () => {
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  const filtered = bookmarks.filter(b => {
    const matchFilter = filter === 'all' || b.type === filter
    const matchSearch = !search ||
      (b.note || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.text || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.videoTitle || '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const removeBookmark = async (id: string) => {
    try {
      await api.deleteBookmark(id)
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.error('Failed to delete bookmark:', err)
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Bookmarks & Notes</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{filtered.length} saved items across {new Set(bookmarks.map(b => b.videoId)).size} videos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {exported && <span style={{ fontSize: 13, color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>✓ Study guide exported</span>}
          <button className="btn-glass" onClick={exportStudyGuide} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13 }}> Export Study Guide</button>
          <button className="btn-primary" onClick={() => navigate('/dashboard/videos')} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13 }}>+ Add Bookmark</button>
        </div>

      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--accent-indigo-dim)', border: '1px solid var(--accent-indigo-glow)', borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.size} selected</span>
          <button onClick={clearSelection} className="btn-glass" style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12 }}>Clear</button>
          <button onClick={selectAll} className="btn-glass" style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12 }}>Select All ({filtered.length})</button>
          <button onClick={deleteSelected} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-rose)', cursor: 'pointer', fontFamily: 'inherit' }}>Delete Delete Selected</button>
          <button className="btn-glass" onClick={exportStudyGuide} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12 }}> Export Selected</button>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="search" className="input-field" placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, height: 40 }} />
        </div>

        {(['all', 'note', 'flashcard', 'highlight', 'key-moment'] as FilterType[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 9999, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
            background: filter === f ? 'var(--accent-indigo)' : 'var(--bg-surface)',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
            borderWidth: 1, borderStyle: 'solid', borderColor: filter === f ? 'transparent' : 'var(--border-glass)',
          }}>
            {f === 'all' ? ' All' : `${TYPE_ICONS[f]} ${TYPE_LABELS[f]}s`}
          </button>
        ))}

        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 9, border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', background: view === v ? 'var(--accent-indigo-dim)' : 'transparent', color: view === v ? 'var(--accent-indigo)' : 'var(--text-secondary)', transition: 'all 0.15s' }} aria-label={v === 'grid' ? 'Grid view' : 'List view'}>
              {v === 'grid' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(b => (
            <BookmarkCard key={b.id} bookmark={b}
              selected={selected.has(b.id)}
              onSelect={() => toggleSelect(b.id)}
              onOpen={() => navigate(`/dashboard/videos/${b.videoId}`)}
              onRemove={() => removeBookmark(b.id)}
              editing={editingId === b.id}
              editNote={editNote}
              setEditNote={setEditNote}
              onStartEdit={() => { setEditingId(b.id); setEditNote(b.note) }}
              onSaveEdit={() => saveEdit(b.id)}
              onCancelEdit={() => setEditingId(null)}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => <BookmarkListRow key={b.id} bookmark={b} selected={selected.has(b.id)} onSelect={() => toggleSelect(b.id)} onOpen={() => navigate(`/dashboard/videos/${b.videoId}`)} onRemove={() => removeBookmark(b.id)} />)}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No bookmarks found</div>
          <div style={{ fontSize: 14 }}>Save notes and highlights from any video transcript to see them here.</div>
        </div>
      )}
    </div>
  )
}

function BookmarkCard({ bookmark: b, onOpen, onRemove, selected, onSelect, editing, editNote, setEditNote, onStartEdit, onSaveEdit, onCancelEdit }: {
  bookmark: Bookmark; onOpen: () => void; onRemove: () => void
  selected: boolean; onSelect: () => void
  editing: boolean; editNote: string; setEditNote: (v: string) => void
  onStartEdit: () => void; onSaveEdit: () => void; onCancelEdit: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="glass-card" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      padding: '18px 20px', cursor: 'default', transition: 'all 0.2s',
      border: selected ? `1px solid var(--accent-indigo)` : hovered ? `1px solid ${b.color}` : '1px solid var(--border-glass)',
      boxShadow: selected ? '0 0 14px var(--accent-indigo-glow)' : hovered ? `0 0 14px ${b.color}22` : 'none',
      borderLeft: `3px solid ${selected ? 'var(--accent-indigo)' : b.color}`,
      background: selected ? 'var(--accent-indigo-dim)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {/* Checkbox */}
        <button onClick={onSelect} style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-glass)'}`, background: selected ? 'var(--accent-indigo)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }} aria-label="Select bookmark">
          {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>
        <span style={{ fontSize: 18 }}>{TYPE_ICONS[b.type]}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{TYPE_LABELS[b.type]}</span>
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent-cyan)' }}>{b.timestamp}</span>
      </div>

      {editing ? (
        <div style={{ marginBottom: 10 }}>
          <textarea className="input-field" value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} style={{ resize: 'none', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" onClick={onSaveEdit} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12 }}>Save</button>
            <button className="btn-glass" onClick={onCancelEdit} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flex: 1 }}>{b.note}</span>
          <button onClick={onStartEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', display: 'flex', flexShrink: 0 }} aria-label="Edit note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>{b.text}</p>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}> {b.videoTitle}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {b.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn-primary" onClick={onOpen} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12 }}>Open in Studio</button>
        <button className="btn-glass" onClick={onRemove} style={{ padding: '7px 10px', borderRadius: 8, borderColor: 'rgba(239,68,68,0.2)', color: 'var(--accent-rose)' }} aria-label="Remove bookmark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>{b.date}</div>
    </div>
  )
}

function BookmarkListRow({ bookmark: b, onOpen, onRemove, selected, onSelect }: { bookmark: Bookmark; onOpen: () => void; onRemove: () => void; selected: boolean; onSelect: () => void }) {
  return (
    <div className="glass-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${selected ? 'var(--accent-indigo)' : b.color}`, background: selected ? 'var(--accent-indigo-dim)' : undefined, transition: 'all 0.15s' }}>
      <button onClick={onSelect} style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-glass)'}`, background: selected ? 'var(--accent-indigo)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }} aria-label="Select">
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </button>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICONS[b.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.note}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent-cyan)', flexShrink: 0 }}>{b.timestamp}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.videoTitle} · {b.date}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {b.tags.map(t => <span key={t} className="tag-pill" style={{ fontSize: 11 }}>{t}</span>)}
        <button className="btn-primary" onClick={onOpen} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12 }}>Open</button>
        <button className="btn-glass" onClick={onRemove} style={{ padding: '6px 10px', borderRadius: 8, borderColor: 'rgba(239,68,68,0.2)', color: 'var(--accent-rose)' }} aria-label="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  )
}
