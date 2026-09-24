import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { VideoWebSocket, WebSocketStatus } from '../services/websocket'
import { useToast } from './Toast'

type SummaryDepth = 'Short TL;DR' | 'Detailed Breakdown' | 'Full Study Guide'
type Domain = 'Academic Lecture' | 'Tech Demo' | 'Business Meeting' | 'General'

const PIPELINE_STAGES_DEF = [
  { key: 'ingest', label: 'Validating & Ingesting', icon: '', duration: 2000 },
  { key: 'audio', label: 'Extracting Audio Track', icon: '', duration: 3000 },
  { key: 'asr', label: 'Whisper ASR Transcription', icon: '', duration: 6000 },
  { key: 'nlp', label: 'NLP Post-Processing', icon: '', duration: 2500 },
  { key: 'summarize', label: 'BART Summarization', icon: '', duration: 4000 },
  { key: 'moments', label: 'Key Moment Detection', icon: '', duration: 3000 },
  { key: 'embed', label: 'Semantic Embeddings', icon: '', duration: 2000 },
  { key: 'done', label: 'Finalizing & Indexing', icon: 'OK', duration: 1000 },
]

interface QueueItem {
  id: string
  name: string
  size: string
  uploadPct: number
  stage: string
  done: boolean
  error?: boolean
  pipelineStage?: number
  wsConnection?: VideoWebSocket
}

const INITIAL_QUEUE: QueueItem[] = []

export default function UploadStudio() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [youtubeApiKey, setYoutubeApiKey] = useState('')
  const [summaryDepth, setSummaryDepth] = useState<SummaryDepth>('Detailed Breakdown')
  const [sensitivity, setSensitivity] = useState(50)
  const [domain, setDomain] = useState<Domain>('Academic Lecture')
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE)
  const [accordionOpen, setAccordionOpen] = useState(true)
  const [storageTarget, setStorageTarget] = useState<'local' | 'google_drive'>('local')
  const [driveConnected, setDriveConnected] = useState(false)

  useEffect(() => {
    api.getDriveStorageStatus().then(status => {
      if (status.storage_target) {
        setStorageTarget(status.storage_target)
      } else if (status.connected) {
        setStorageTarget('google_drive')
      }
      setDriveConnected(Boolean(status.connected))
    }).catch(() => {})
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    addFilesToQueue(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    addFilesToQueue(files)
    e.target.value = ''
  }

  const addFilesToQueue = async (files: File[]) => {
    for (const f of files) {
      const tempId = crypto.randomUUID()
      const newItem: QueueItem = {
        id: tempId,
        name: f.name,
        size: formatSize(f.size),
        uploadPct: 10,
        stage: 'Uploading to secure storage...',
        done: false,
      }
      setQueue(prev => [newItem, ...prev])
      showToast(`Uploading ${f.name}...`, 'info')

      try {
        const formData = new FormData()
        formData.append('file', f)
        formData.append('title', f.name)
        formData.append('summary_depth', summaryDepth)
        formData.append('domain', domain)
        formData.append('category', domain)
        formData.append('storage_target', storageTarget)

        const vidRes = await api.uploadVideoWithProgress(formData, (pct) => {
          setQueue(prev => prev.map(q => q.id === tempId ? {
            ...q,
            uploadPct: pct,
            stage: pct >= 85 ? 'Finalizing upload & starting AI pipeline...' : `Uploading to secure storage (${pct}%)`
          } : q))
        })

        showToast(`${f.name} uploaded! AI Pipeline Active...`, 'success')

        // Map backend stage name to UI pipeline index
        const getStageIndex = (stageName: string) => {
          const map: Record<string, number> = {
            'queued': 0,
            'stage1_ingestion': 0,
            'ingest': 0,
            'keyframe_extraction': 1,
            'stage2_processing': 1,
            'audio_extraction': 1,
            'audio': 1,
            'whisper_asr_transcription': 2,
            'stage3_transcription': 2,
            'asr': 2,
            'nlp_summarization': 3,
            'stage4_summarization': 3,
            'nlp': 3,
            'summarize': 4,
            'key_moments_detection': 5,
            'stage5_key_moments': 5,
            'moments': 5,
            'stage6_content_insights': 6,
            'embed': 6,
            'stage7_delivery': 7,
            'completed': 7,
            'done': 7
          }
          return map[stageName] ?? 0
        }

        // Connect WS for server-sent real events
        const ws = new VideoWebSocket(
          vidRes.id,
          (status: WebSocketStatus) => {
            const idx = getStageIndex(status.stage)
            const isFinished = status.stage === 'completed' || status.stage === 'stage7_delivery' || status.overallProgress >= 100
            setQueue(prev => prev.map(q => (q.id === tempId || q.id === vidRes.id) ? {
              ...q,
              id: vidRes.id,
              stage: status.message || `${PIPELINE_STAGES_DEF[idx]?.icon || ''} ${PIPELINE_STAGES_DEF[idx]?.label || 'Processing'}...`,
              pipelineStage: isFinished ? PIPELINE_STAGES_DEF.length - 1 : idx,
              uploadPct: 100,
              done: isFinished
            } : q))

            if (isFinished) {
              setTimeout(() => navigate(`/dashboard/videos/${vidRes.id}`), 1200)
            }
          },
          () => {}
        )
        ws.connect()

        // Fallback poller to verify status in case WebSocket drops
        const pollInterval = setInterval(async () => {
          try {
            const currentVid = await api.getVideo(vidRes.id)
            const isCompleted = currentVid.status === 'completed' || (currentVid as any).stage === 'stage7_delivery' || currentVid.progress >= 100
            if (isCompleted) {
              clearInterval(pollInterval)
              setQueue(prev => prev.map(q => (q.id === tempId || q.id === vidRes.id) ? {
                ...q,
                id: vidRes.id,
                stage: 'AI processing complete. All outputs ready.',
                pipelineStage: PIPELINE_STAGES_DEF.length - 1,
                uploadPct: 100,
                done: true
              } : q))
              setTimeout(() => navigate(`/dashboard/videos/${vidRes.id}`), 1200)
            } else {
              const stageKey = (currentVid as any).stage || (currentVid as any).processing_stage || currentVid.status
              const idx = getStageIndex(stageKey)
              setQueue(prev => prev.map(q => (q.id === tempId || q.id === vidRes.id) ? {
                ...q,
                id: vidRes.id,
                stage: `${PIPELINE_STAGES_DEF[idx]?.icon || ''} ${PIPELINE_STAGES_DEF[idx]?.label || 'Processing'}...`,
                pipelineStage: idx,
                uploadPct: 100
              } : q))
            }
          } catch (e) {
            // silent ignore
          }
        }, 1500)


        setQueue(prev => prev.map(q => q.id === tempId ? { 
          ...q, 
          id: vidRes.id, 
          uploadPct: 100, 
          stage: 'AI Pipeline Active...', 
          pipelineStage: 0,
          wsConnection: ws
        } : q))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Upload error:', err)
        showToast(`Upload error: ${msg}`, 'error')
        setQueue(prev => prev.map(q => q.id === tempId ? {
          ...q,
          error: true,
          stage: 'Upload failed'
        } : q))
      }
    }
  }

  const removeItem = (id: string) => {
    const item = queue.find(q => q.id === id)
    if (item?.wsConnection) {
      item.wsConnection.disconnect()
    }
    if (item) {
      showToast(`Removed ${item.name} from queue`, 'info')
    }
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  // Cleanup WebSocket connections on unmount
  useEffect(() => {
    return () => {
      queue.forEach(item => {
        if (item.wsConnection) {
          item.wsConnection.disconnect()
        }
      })
    }
  }, [queue])

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const sensitivityLabel = sensitivity < 33 ? 'Standard' : sensitivity < 66 ? 'High Precision' : 'Scene Shifts'

  return (
    <div className="responsive-page-container" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Upload & Process Video Asset</h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Drag & drop video files or paste YouTube/Web URLs for AI transcription and summarization.</p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="glass-card"
        style={{
          padding: '36px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          border: `2px dashed ${dragOver ? 'var(--accent-cyan)' : 'var(--accent-indigo)'}`,
          boxShadow: dragOver ? '0 0 40px var(--accent-cyan-glow)' : '0 0 24px var(--accent-indigo-glow)',
          background: dragOver ? 'rgba(6,182,212,0.05)' : 'var(--accent-indigo-dim)',
          transition: 'all 0.25s',
          marginBottom: 24,
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept="video/*" onChange={handleFileInput} style={{ display: 'none' }} aria-label="Upload video files" />

        <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 20px' }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: dragOver ? 'rgba(6,182,212,0.2)' : 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.15))',
            border: `2px solid ${dragOver ? 'var(--accent-cyan)' : 'var(--accent-indigo)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: dragOver ? '0 0 35px var(--accent-cyan-glow)' : '0 0 25px var(--accent-indigo-glow)',
            animation: 'pulse-glow 2.5s ease-in-out infinite',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--accent-cyan)' : 'var(--accent-indigo)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          {dragOver ? 'Release to upload video' : 'Drag & drop video files here, or click to browse'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Supports MP4, MOV, AVI, WEBM &nbsp;•&nbsp; Up to 2GB per file &nbsp;•&nbsp; Auto-Transcribed & Summarized
        </div>

        {/* Floating AI Badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span className="tag-pill" style={{ fontSize: 11, padding: '3px 10px' }}> Whisper v3 ASR</span>
          <span className="tag-pill" style={{ fontSize: 11, padding: '3px 10px' }}> Groq LPU Summarizer</span>
          <span className="tag-pill" style={{ fontSize: 11, padding: '3px 10px' }}> Visual Key Moments</span>
          <span className="tag-pill" style={{ fontSize: 11, padding: '3px 10px' }}> 98%+ WER Accuracy</span>
        </div>

        {/* Prominent Start / Browse Files Button */}
        <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            style={{
              padding: '12px 28px',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              boxShadow: '0 4px 20px var(--accent-indigo-glow)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Video Processing / Browse Files
          </button>
        </div>

        {/* URL input inside dropzone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 540, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="url"
              className="input-field"
              placeholder="Paste YouTube or Video Link URL (e.g., https://youtube.com/watch?...)"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              style={{ flex: 1, minWidth: 'min(100%, 260px)', height: 42, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <button
              className="btn-primary"
              onClick={async () => { 
                if (urlInput.trim()) { 
                  const targetUrl = urlInput.trim()
                  setUrlInput('')
                  const tempId = `url-${Date.now()}`
                  const initialTitle = targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')
                    ? 'YouTube Video Asset'
                    : targetUrl.split('/').pop() || 'Web Video Asset'

                  showToast('Ingesting video metadata & extracting transcript...', 'info')

                  const newItem: QueueItem = {
                    id: tempId,
                    name: initialTitle,
                    size: 'Web Stream',
                    uploadPct: 40,
                    stage: 'Ingesting video metadata & transcript...',
                    done: false,
                    pipelineStage: 0,
                  }
                  setQueue(prev => [newItem, ...prev])

                  try {
                    const formData = new FormData()
                    formData.append('video_url', targetUrl)
                    formData.append('summary_depth', summaryDepth)
                    formData.append('domain', domain)
                    formData.append('category', domain)
                    formData.append('storage_target', storageTarget)
                    if (youtubeApiKey.trim()) {
                      formData.append('youtube_api_key', youtubeApiKey.trim())
                    }
                    
                    const vidRes = await api.uploadVideo(formData)
                    const realTitle = vidRes?.title || initialTitle
                    showToast(`Ingested '${realTitle}'. Processing AI summary...`, 'success')

                    setQueue(prev => prev.map(q => q.id === tempId ? {
                      ...q,
                      id: vidRes.id,
                      name: realTitle,
                      uploadPct: 80,
                      stage: 'Generating AI summary & key moments...',
                      pipelineStage: 4
                    } : q))

                    setTimeout(() => {
                      navigate(`/dashboard/videos/${vidRes.id}`)
                    }, 1500)
                  } catch (err: any) {
                    const msg = err instanceof Error ? err.message : String(err)
                    console.error('URL ingestion error:', err)
                    showToast(`URL ingestion failed: ${msg}`, 'error')
                    setQueue(prev => prev.map(q => q.id === tempId ? {
                      ...q,
                      error: true,
                      uploadPct: 0,
                      stage: `Ingestion failed: ${msg}`,
                      done: false
                    } : q))
                  }
                }
              }}
              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px', height: 42 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Ingest Stream
            </button>
          </div>
        </div>
      </div>

      {/* AI Preset Accordion */}
      <div className="glass-card" style={{ marginBottom: 28, overflow: 'hidden' }}>
        <button
          onClick={() => setAccordionOpen(!accordionOpen)}
          style={{
            width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚙️</span> AI Processing Configuration
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {accordionOpen && (
          <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border-glass)' }}>
            {/* Summary depth */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Summary Depth
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['Short TL;DR', 'Detailed Breakdown', 'Full Study Guide'] as SummaryDepth[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { setSummaryDepth(d); showToast(`Summary depth set to: ${d}`, 'info', 2000) }}
                    style={{
                      padding: '9px 20px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      background: summaryDepth === d ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'var(--bg-surface)',
                      color: summaryDepth === d ? '#fff' : 'var(--text-secondary)',
                      boxShadow: summaryDepth === d ? '0 0 16px var(--accent-indigo-glow)' : 'none',
                      borderWidth: 1, borderStyle: 'solid',
                      borderColor: summaryDepth === d ? 'transparent' : 'var(--border-glass)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Storage Target Selector */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                Storage Destination
                {driveConnected && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)', fontWeight: 600 }}>Zero-Loss Auto-Backup Active</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setStorageTarget('local')}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: '1px solid', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
                    borderColor: storageTarget === 'local' ? 'var(--accent-indigo)' : 'var(--border-glass)',
                    background: storageTarget === 'local' ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                    color: storageTarget === 'local' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                    fontFamily: 'inherit'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  Local Server Storage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!driveConnected) {
                      showToast('Connect Google Drive in Account Settings first', 'info')
                      navigate('/dashboard/settings?tab=storage')
                    } else {
                      setStorageTarget('google_drive')
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: '1px solid', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
                    borderColor: storageTarget === 'google_drive' ? 'var(--accent-indigo)' : 'var(--border-glass)',
                    background: storageTarget === 'google_drive' ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                    color: storageTarget === 'google_drive' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                    fontFamily: 'inherit'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                  Google Drive Cloud {driveConnected && '✓'}
                </button>
              </div>
            </div>

            {/* Key moments sensitivity */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Moments Sensitivity</span>
                <span style={{ fontWeight: 600, color: 'var(--text-accent)' }}>{sensitivityLabel}</span>
              </div>
              <input
                type="range" min={0} max={100} value={sensitivity}
                onChange={e => {
                  const newVal = Number(e.target.value)
                  setSensitivity(newVal)
                  const label = newVal < 33 ? 'Standard' : newVal < 66 ? 'High Precision' : 'Scene Shifts'
                  showToast(`Key moments sensitivity: ${label}`, 'info', 1500)
                }}
                aria-label="Key moments sensitivity"
                style={{
                  width: '100%', height: 6, borderRadius: 3, outline: 'none',
                  background: `linear-gradient(90deg, var(--accent-indigo) ${sensitivity}%, var(--border-glass) ${sensitivity}%)`,
                  cursor: 'pointer', accentColor: 'var(--accent-indigo)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                <span>Standard</span><span>High Precision</span><span>Scene Shifts</span>
              </div>
            </div>

            {/* Domain preset */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Domain Preset
              </div>
              <select
                value={domain}
                onChange={e => {
                  const newDomain = e.target.value as Domain
                  setDomain(newDomain)
                  showToast(`Domain preset: ${newDomain}`, 'info', 2000)
                }}
                className="input-field"
                style={{ maxWidth: 300 }}
                aria-label="Domain preset"
              >
                {(['Academic Lecture', 'Tech Demo', 'Business Meeting', 'General'] as Domain[]).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Processing Queue <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>({queue.length} files)</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {queue.map(item => (
              <QueueCard key={item.id} item={item} onRemove={() => removeItem(item.id)} onView={() => { showToast('Opening Intelligence Studio...', 'info'); navigate(`/dashboard/videos/${item.id}`) }} />
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse-glow{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  )
}

function QueueCard({ item, onRemove, onView }: { item: QueueItem; onRemove: () => void; onView: () => void }) {
  const isUploading = item.uploadPct < 100
  const isPipelining = item.uploadPct === 100 && !item.done
  const pipelineStage = item.pipelineStage ?? -1

  return (
    <div className="glass-card" style={{ padding: '18px 22px', transition: 'box-shadow 0.3s', boxShadow: item.done ? '0 0 14px rgba(16,185,129,0.15)' : isPipelining ? '0 0 14px rgba(245,158,11,0.12)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: (isPipelining) ? 14 : 0 }}>
        <div style={{
          width: 76, height: 50, borderRadius: 10, flexShrink: 0,
          position: 'relative', overflow: 'hidden',
          background: item.done
            ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.2))'
            : isPipelining
            ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(99,102,241,0.25))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${item.done ? 'rgba(16,185,129,0.3)' : isPipelining ? 'rgba(6,182,212,0.4)' : 'var(--border-glass)'}`,
        }}>
          {isPipelining && <div className="laser-scan-beam" />}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={item.done ? 'var(--accent-emerald)' : isPipelining ? 'var(--accent-cyan)' : 'var(--accent-indigo)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{item.size}</span>
            {item.done && <span className="badge badge-success">✓ Ready</span>}
            {isPipelining && <span className="badge badge-warning"> Processing</span>}
          </div>

          {isUploading && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
                <span>Uploading to secure storage</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-accent)' }}>{item.uploadPct.toFixed(0)}%</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${item.uploadPct}%` }} /></div>
            </div>
          )}

          {!isUploading && !isPipelining && item.done && (
            <div style={{ fontSize: 13, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> AI processing complete — transcript, summary, and key moments ready
            </div>
          )}

          {isPipelining && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--accent-amber)' }}>
              <div style={{ width: 13, height: 13, border: '2px solid rgba(245,158,11,0.3)', borderTop: '2px solid var(--accent-amber)', borderRadius: '50%' }} className="animate-spin-slow" />
              <span>{item.stage}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {item.done && <button className="btn-primary" onClick={onView} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13 }}>View Studio</button>}
          <button className="btn-glass" onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, color: 'var(--accent-rose)', borderColor: 'rgba(239,68,68,0.2)' }}>
            {item.done ? 'Remove' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* High-Tech Animated Pipeline Visualization */}
      {isPipelining && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 16 }}>
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Pipeline Active • Live Processing
              </span>
            </div>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-accent)' }}>
              Step {Math.max(1, pipelineStage + 1)} of {PIPELINE_STAGES_DEF.length}
            </span>
          </div>

          <div className="tabs-scroll-container" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {PIPELINE_STAGES_DEF.map((s, i) => {
              const isDone = i < pipelineStage
              const isActive = i === pipelineStage
              return (
                <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 70, flex: 1, position: 'relative' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{
                      width: '100%', height: 4, borderRadius: 9999,
                      background: isDone
                        ? 'linear-gradient(90deg, #10B981, #06B6D4)'
                        : isActive
                        ? 'linear-gradient(90deg, #6366F1, #06B6D4)'
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: isActive
                        ? '0 0 12px rgba(6,182,212,0.65)'
                        : isDone
                        ? '0 0 8px rgba(16,185,129,0.35)'
                        : 'none',
                      transition: 'all 0.4s ease',
                    }} />
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: -3, right: '40%', width: 10, height: 10,
                        borderRadius: '50%', background: 'var(--accent-cyan)',
                        boxShadow: '0 0 12px var(--accent-cyan)',
                        animation: 'pulse-glow 1s infinite'
                      }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: isActive || isDone ? 700 : 500,
                    color: isDone ? 'var(--accent-emerald)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'color 0.3s'
                  }}>
                    <span>{isDone ? '✓' : s.icon}</span> {s.label.split(' ')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
