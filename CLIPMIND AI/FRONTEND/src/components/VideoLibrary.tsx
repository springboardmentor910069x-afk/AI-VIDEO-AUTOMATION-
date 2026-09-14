import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, VideoItem } from '../services/api'
import { useToast } from './Toast'

interface VideoCard {
  id: string
  title: string
  duration: string
  durationSecs: number
  date: string
  dateTs: number
  wordCount: string
  wordCountNum: number
  status: 'Completed' | 'Transcribing' | 'Failed'
  summary: string
  tags: string[]
  color: string
  wer: number
  views: number
  thumbnailUrl?: string
}

type ViewMode = 'grid' | 'list'
type StatusFilter = 'All' | 'Completed' | 'Transcribing' | 'Failed'
type SortKey = 'Date' | 'Duration' | 'Word Count' | 'Title' | 'Views' | 'WER'

function sortVideos(videos: VideoCard[], key: SortKey): VideoCard[] {
  return [...videos].sort((a, b) => {
    switch (key) {
      case 'Date': return b.dateTs - a.dateTs
      case 'Duration': return b.durationSecs - a.durationSecs
      case 'Word Count': return b.wordCountNum - a.wordCountNum
      case 'Title': return a.title.localeCompare(b.title)
      case 'Views': return b.views - a.views
      case 'WER': return b.wer - a.wer
    }
  })
}

function formatDuration(secs: number) {
  if (!secs || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoLibrary() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortBy, setSortBy] = useState<SortKey>('Date')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVideos = useCallback(async () => {
    try {
      const fetchedVideos = await api.getVideos()
      setVideos(fetchedVideos)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos()
    const interval = setInterval(fetchVideos, 3000)
    return () => clearInterval(interval)
  }, [fetchVideos])

  // Convert VideoItem to VideoCard format strictly using live DB properties
  const VIDEOS: VideoCard[] = useMemo(() => {
    return videos.map((v: VideoItem) => {
      const summary = (v as any).summary?.tldr || (v as any).summary_tldr || (v as any).description || 'Video intelligence generated and indexed.'
      const rawTags = (v as any).keywords || (v as any).tags || (v.category ? [`#${v.category}`] : ['#Video'])
      const tags = Array.isArray(rawTags) ? rawTags.map(t => typeof t === 'string' ? t : (t?.name || t?.label || String(t))) : [String(rawTags)]
      const views = (v as any).views_count || (v as any).views || 0
      const thumb = v.thumbnail_url || (v as any).thumbnail_path || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'

      return {
        id: v.id,
        title: v.title || 'Untitled Video',
        duration: formatDuration(v.duration_sec || 0),
        durationSecs: v.duration_sec || 0,
        date: new Date(v.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateTs: new Date(v.created_at || Date.now()).getTime(),
        wordCount: `${(v.word_count || 0).toLocaleString()} words`,
        wordCountNum: v.word_count || 0,
        status: v.status === 'failed' ? 'Failed' : (v.status === 'transcribing' || v.status === 'processing' || v.status === 'queued') ? 'Transcribing' : 'Completed',
        summary,
        tags,
        color: v.status === 'failed' ? '#EF4444' : (v.status === 'transcribing' || v.status === 'processing') ? '#F59E0B' : '#6366F1',
        wer: v.wer_accuracy || 0,
        views,
        thumbnailUrl: thumb,
      }
    })
  }, [videos])


  const filtered = useMemo(() => {
    const f = VIDEOS.filter((v: VideoCard) => {
      const matchSearch = (v.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.tags || []).some((t: any) => String(t || '').toLowerCase().includes(search.toLowerCase()))
      const matchStatus = statusFilter === 'All' || v.status === statusFilter
      return matchSearch && matchStatus
    })
    return sortVideos(f, sortBy)
  }, [VIDEOS, search, statusFilter, sortBy])

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const allSelected = filtered.length > 0 && filtered.every(v => selected.has(v.id))

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(v => next.delete(v.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(v => next.add(v.id))
        return next
      })
    }
  }, [allSelected, filtered])

  const handleDeleteSingle = useCallback(async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete '${title}'?`)) {
      try {
        await api.deleteVideo(id)
        showToast(`Video '${title}' deleted successfully`, 'success')
        await fetchVideos()
      } catch (err: any) {
        console.error('Delete video error:', err)
        showToast(err.message || 'Failed to delete video', 'error')
      }
    }
  }, [fetchVideos, showToast])

  const handleDownloadPDF = useCallback(async (id: string, title: string) => {
    try {
      await api.downloadExport(id, 'pdf', title)
    } catch (err) {
      console.error('Download PDF error:', err)
    }
  }, [])

  const bulkDelete = useCallback(async () => {
    if (!bulkConfirm) { setBulkConfirm(true); return }
    try {
      for (const id of selected) {
        await api.deleteVideo(id)
      }
      await fetchVideos()
      setSelected(new Set())
      setBulkConfirm(false)
    } catch (error) {
      console.error('Failed to delete videos:', error)
    }
  }, [bulkConfirm, selected, fetchVideos])

  const bulkExport = useCallback(() => {
    setSelected(new Set())
  }, [])

  const previewVideo = filtered.find(v => v.id === previewId) ?? null

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Video Library</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{filtered.length} of {VIDEOS.length} videos</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/dashboard/upload')} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Upload New
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          borderRadius: 10, marginBottom: 16, border: '1px solid var(--accent-indigo)',
          background: 'var(--accent-indigo-dim)', animation: 'stream-in 0.2s ease',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-indigo)' }}>
            {selected.size} video{selected.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={bulkExport} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-glass)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Selected
          </button>
          <button onClick={bulkDelete} style={{
            padding: '6px 14px', borderRadius: 8, border: `1px solid ${bulkConfirm ? 'var(--accent-rose)' : 'rgba(239,68,68,0.3)'}`,
            background: bulkConfirm ? 'var(--accent-rose)' : 'transparent',
            color: bulkConfirm ? '#fff' : 'var(--accent-rose)', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            {bulkConfirm ? 'Confirm Delete' : 'Delete Selected'}
          </button>
          <button onClick={() => { setSelected(new Set()); setBulkConfirm(false) }} style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-glass)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}>
            Clear
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={toggleAll} style={{
          width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${allSelected ? 'var(--accent-indigo)' : 'var(--border-glass)'}`,
          background: allSelected ? 'var(--accent-indigo)' : 'var(--bg-surface)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
        }} aria-label="Select all">
          {allSelected ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          )}
        </button>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="search" className="input-field" placeholder="Search videos, tags..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, height: 36, background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
        </div>

        {(['All', 'Completed', 'Transcribing', 'Failed'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 14px', borderRadius: 9999, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
            background: statusFilter === s ? 'var(--accent-indigo)' : 'var(--bg-surface)',
            color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
            borderWidth: 1, borderStyle: 'solid',
            borderColor: statusFilter === s ? 'transparent' : 'var(--border-glass)',
          }}>
            {s}
          </button>
        ))}

        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="input-field" style={{ width: 'auto', height: 36, paddingLeft: 14, paddingRight: 28, background: 'var(--bg-surface)', color: 'var(--text-primary)' }} aria-label="Sort by">
          {(['Date', 'Duration', 'Word Count', 'Title', 'Views', 'WER'] as SortKey[]).map(o => <option key={o} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>{o}</option>)}
        </select>

        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 9, border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
          {(['grid', 'list'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '8px 12px', border: 'none', cursor: 'pointer',
              background: viewMode === v ? 'var(--accent-indigo-dim)' : 'transparent',
              color: viewMode === v ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }} aria-label={v === 'grid' ? 'Grid view' : 'List view'}>
              {v === 'grid' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid / List */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map(v => (
            <VideoGridCard
              key={v.id}
              video={v}
              selected={selected.has(v.id)}
              onSelect={() => toggleSelect(v.id)}
              onOpen={() => navigate(`/dashboard/videos/${v.id}`)}
              onPreview={() => setPreviewId(previewId === v.id ? null : v.id)}
              onDelete={() => handleDeleteSingle(v.id, v.title)}
              onDownload={() => handleDownloadPDF(v.id, v.title)}
              previewing={previewId === v.id}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(v => (
            <VideoListRow
              key={v.id}
              video={v}
              selected={selected.has(v.id)}
              onSelect={() => toggleSelect(v.id)}
              onOpen={() => navigate(`/dashboard/videos/${v.id}`)}
              onPreview={() => setPreviewId(previewId === v.id ? null : v.id)}
              onDelete={() => handleDeleteSingle(v.id, v.title)}
              onDownload={() => handleDownloadPDF(v.id, v.title)}
              previewing={previewId === v.id}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (() => {
        let currentRole = 'Creator'
        try {
          const stored = localStorage.getItem('clipmind_user')
          if (stored) {
            const u = JSON.parse(stored)
            if (u.role) currentRole = u.role
          }
        } catch (e) {}
        if (!currentRole || currentRole === 'Creator') {
          currentRole = localStorage.getItem('clipmind_active_role') || 'Creator'
        }
        const isLearner = currentRole === 'Learner'

        return (
          <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{isLearner ? '🎓' : '🎬'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              {isLearner ? 'No study lectures available yet' : 'No videos in your library yet'}
            </div>
            <div style={{ fontSize: 14, marginBottom: 20 }}>
              Upload your video lecture or paste a YouTube URL to automatically generate transcripts, summaries, quizzes, and flashcards.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
              <button className="btn-primary" onClick={() => navigate('/dashboard/upload')} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14 }}>
                + Upload Video / Lecture
              </button>
              {isLearner && (
                <button className="btn-primary" onClick={() => navigate('/dashboard/learner/study')} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))' }}>
                  🎓 Open Study Room
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Inline preview panel */}
      {previewVideo && (
        <InlinePreview video={previewVideo} onClose={() => setPreviewId(null)} onOpen={() => navigate(`/dashboard/videos/${previewVideo.id}`)} />
      )}
    </div>
  )
}

function InlinePreview({ video, onClose, onOpen }: { video: VideoCard; onClose: () => void; onOpen: () => void }) {
  return (
    <div style={{
      position: 'fixed', right: 24, bottom: 24, width: 380, zIndex: 200,
      borderRadius: 16, border: `1px solid ${video.color}55`,
      background: 'var(--bg-surface)', boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${video.color}22`,
      animation: 'stream-in 0.2s ease', overflow: 'hidden',
    }}>
      {/* Video thumbnail cover */}
      <div style={{ position: 'relative', paddingTop: '52%', background: `linear-gradient(135deg, ${video.color}33, ${video.color}0a)`, overflow: 'hidden' }}>
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt={video.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2))' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${video.color}cc`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${video.color}88` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <span style={{ fontSize: 12, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 10px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace" }}>
            {video.duration}
          </span>
        </div>
        <button onClick={onClose} style={{
          position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} aria-label="Close preview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <span className={`badge badge-${video.status === 'Completed' ? 'success' : video.status === 'Transcribing' ? 'warning' : 'error'}`}>
            {video.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{video.wordCount}</span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8 }}>{video.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{video.summary}</div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-glass)', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-indigo)', fontFamily: "'JetBrains Mono', monospace" }}>{video.views.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Views</div>
          </div>
          {video.wer > 0 && (
            <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-glass)', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: "'JetBrains Mono', monospace" }}>{video.wer}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>WER Accuracy</div>
            </div>
          )}
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-glass)', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono', monospace" }}>{video.duration}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Duration</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {video.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
        </div>

        <button className="btn-primary" onClick={onOpen} style={{ width: '100%', padding: '9px', borderRadius: 9, fontSize: 13 }}>
          Open Intelligence Studio →
        </button>
      </div>
    </div>
  )
}

interface CardProps {
  video: VideoCard
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onPreview: () => void
  onDelete: () => void
  onDownload: () => void
  previewing: boolean
}

function VideoGridCard({ video, selected, onSelect, onOpen, onPreview, onDelete, onDownload, previewing }: CardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="glass-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        overflow: 'hidden', cursor: 'pointer', position: 'relative',
        border: selected ? `1.5px solid var(--accent-indigo)` : hovered ? `1px solid ${video.color}55` : '1px solid var(--border-glass)',
        boxShadow: selected ? '0 0 0 3px var(--accent-indigo-dim)' : hovered ? `0 0 20px ${video.color}22` : 'none',
        background: selected ? 'var(--accent-indigo-dim)' : undefined,
        transition: 'all 0.2s',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 10,
          width: 22, height: 22, borderRadius: 6,
          border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.4)'}`,
          background: selected ? 'var(--accent-indigo)' : 'rgba(0,0,0,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered || selected ? 1 : 0, transition: 'all 0.15s',
        }}
        aria-label="Select video"
      >
        {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </button>

      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: `linear-gradient(135deg, ${video.color}22, ${video.color}0a)`, overflow: 'hidden' }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={video.color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />

        {/* Duration overlay */}
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
          {video.duration}
        </div>
        {/* Views badge */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {video.views.toLocaleString()}
        </div>
        {/* Hover overlay */}
        {hovered && !selected && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
            <button onClick={e => { e.stopPropagation(); onOpen() }} style={{
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.9)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} aria-label="Open studio">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); onPreview() }} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: previewing ? 'var(--accent-cyan)' : 'rgba(6,182,212,0.85)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} aria-label="Quick preview">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className={`badge badge-${video.status === 'Completed' ? 'success' : video.status === 'Transcribing' ? 'warning' : 'error'}`}>
            {video.status === 'Transcribing' ? '⟳ ' : ''}{video.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{video.wordCount}</span>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {video.title}
        </h3>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {video.summary}
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {video.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
        </div>

        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
          <button className="btn-primary" onClick={onOpen} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12 }}>
            Open Studio
          </button>
          <button className="btn-glass" onClick={e => { e.stopPropagation(); onPreview() }} style={{ padding: '7px 10px', borderRadius: 8, borderColor: previewing ? 'var(--accent-cyan)' : undefined, color: previewing ? 'var(--accent-cyan)' : undefined }} title="Quick preview" aria-label="Quick preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button className="btn-glass" onClick={e => { e.stopPropagation(); onDownload() }} style={{ padding: '7px 10px', borderRadius: 8 }} title="Download PDF" aria-label="Download PDF">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button className="btn-glass" onClick={e => { e.stopPropagation(); onDelete() }} style={{ padding: '7px 10px', borderRadius: 8, borderColor: 'rgba(239,68,68,0.2)', color: 'var(--accent-rose)' }} title="Delete" aria-label="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>{video.date}</div>
      </div>
    </div>
  )
}

function VideoListRow({ video, selected, onSelect, onOpen, onPreview, onDelete, onDownload, previewing }: CardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="glass-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s',
        border: selected ? '1.5px solid var(--accent-indigo)' : hovered ? '1px solid var(--border-glass)' : '1px solid transparent',
        background: selected ? 'var(--accent-indigo-dim)' : undefined,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-glass)'}`,
          background: selected ? 'var(--accent-indigo)' : 'var(--bg-surface)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered || selected ? 1 : 0.4, transition: 'all 0.15s',
        }}
        aria-label="Select video"
      >
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </button>

      {/* Thumbnail */}
      <div style={{ width: 80, height: 50, borderRadius: 8, background: `linear-gradient(135deg, ${video.color}22, ${video.color}0a)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={video.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        )}
        <div style={{ position: 'absolute', bottom: 2, right: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>{video.duration}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.summary}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{video.views.toLocaleString()} views</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>{video.wordCount}</span>
        <span className={`badge badge-${video.status === 'Completed' ? 'success' : video.status === 'Transcribing' ? 'warning' : 'error'}`}>{video.status}</span>
        <button onClick={onPreview} className="btn-glass" style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, borderColor: previewing ? 'var(--accent-cyan)' : undefined, color: previewing ? 'var(--accent-cyan)' : undefined }} aria-label="Quick preview">Preview</button>
        <button onClick={onDownload} className="btn-glass" style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12 }} title="Download PDF" aria-label="Download PDF">PDF</button>
        <button onClick={onDelete} className="btn-glass" style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, borderColor: 'rgba(239,68,68,0.2)', color: 'var(--accent-rose)' }} title="Delete" aria-label="Delete">Delete</button>
        <button className="btn-primary" onClick={onOpen} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>Open Studio</button>
      </div>
    </div>
  )
}
