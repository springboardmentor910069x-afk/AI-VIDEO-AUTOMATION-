import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, VideoData } from '../services/api'

interface Message {
  role: 'user' | 'ai'
  text: string
  timestamp: string
}

interface Flashcard {
  id?: string
  front: string
  back: string
  timestamp?: string
  flipped: boolean
  score?: 'know' | 'review' | null
}

interface QuizQuestion {
  id?: string
  question: string
  options: string[]
  correct: number
  explanation: string
}

interface KeyMomentStudy {
  time: string
  title: string
  tag: string
}

export default function LearnerStudyRoom() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [selectedVideoId, setSelectedVideoId] = useState<string>(id || '')
  const [video, setVideo] = useState<VideoData | null>(null)
  const [availableVideos, setAvailableVideos] = useState<VideoData[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [playing, setPlaying] = useState(false)
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [speed, setSpeed] = useState('1.0x')
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hello! I am your AI study assistant. Ask any question about this lecture's concepts, transcripts, or key moments.", timestamp: 'Just now' },
  ])
  const [inputVal, setInputVal] = useState('')
  const [thinking, setThinking] = useState(false)

  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [cardIdx, setCardIdx] = useState(0)
  const [activeSection, setActiveSection] = useState<'chat' | 'flashcards' | 'quiz'>('chat')

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizRevealed, setQuizRevealed] = useState<boolean[]>([])

  const [studySessionTime, setStudySessionTime] = useState(0)
  const [keyMoments, setKeyMoments] = useState<KeyMomentStudy[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  const [videoError, setVideoError] = useState(false)
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer for active study session
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => setStudySessionTime(t => t + 1), 1000)
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current) }
  }, [])

  // Load available videos list
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true)
        const vids = await api.listVideos()
        setAvailableVideos(vids)
        if (vids.length > 0) {
          if (id && vids.some(v => v.id === id)) {
            setSelectedVideoId(id)
          } else {
            setSelectedVideoId(vids[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to list videos for study room:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchVideos()
  }, [id])

  // Load study materials when selectedVideoId changes
  useEffect(() => {
    if (!selectedVideoId) return
    setVideoError(false)
    const loadVideoData = async () => {
      try {
        const v = await api.getVideo(selectedVideoId)
        if (v) {
          setVideo(v)
          setMessages([
            {
              role: 'ai',
              text: `Hello! I am your real-time AI study assistant for "${v.title}". Ask me anything about the concepts, transcription, key moments, or exam prep!`,
              timestamp: 'Just now'
            }
          ])
          if (v.duration_sec && v.duration_sec > 0) {
            setCurrentTimeSec(0)
          }
        }
               
        const km = await api.getKeyMoments(selectedVideoId)
        if (km && km.moments && km.moments.length > 0) {
          setKeyMoments(km.moments.map(m => ({
            time: m.timestamp || '00:00',
            title: m.title,
            tag: m.importance || 'Core'
          })))
        } else {
          setKeyMoments([])
        }

        const fc = await api.getFlashcards(selectedVideoId)
        if (fc && fc.flashcards && fc.flashcards.length > 0) {
          setFlashcards(fc.flashcards.map((f: any) => ({
            id: f.id,
            front: f.front || f.question,
            back: f.back || f.answer,
            timestamp: f.timestamp || '00:00',
            flipped: false
          })))
          setCardIdx(0)
        } else {
          setFlashcards([])
        }

        const qRes = await api.getQuizzes(selectedVideoId)
        if (qRes && qRes.questions && qRes.questions.length > 0) {
          setQuizQuestions(qRes.questions)
          setQuizAnswers(Array(qRes.questions.length).fill(null))
          setQuizRevealed(Array(qRes.questions.length).fill(false))
          setQuizIdx(0)
        } else {
          setQuizQuestions([])
          setQuizAnswers([])
          setQuizRevealed([])
        }
      } catch (e) {
        console.error('Failed to load video study data:', e)
      }
    }
    loadVideoData()
  }, [selectedVideoId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const totalSec = video?.duration_sec || 300

  // Fallback timer when HTML5 video element is not available or videoError
  useEffect(() => {
    if (playing && (!videoRef.current || videoError)) {
      const multiplier = parseFloat(speed.replace('x', '')) || 1.0
      const intervalMs = Math.max(100, Math.floor(1000 / multiplier))
      intervalRef.current = setInterval(() => {
        setCurrentTimeSec(prev => {
          if (prev >= totalSec) { setPlaying(false); return totalSec }
          return prev + 1
        })
      }, intervalMs)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, totalSec, speed, videoError])

  const seekTo = (sec: number) => {
    const target = Math.max(0, Math.min(sec, totalSec))
    setCurrentTimeSec(target)
    if (videoRef.current) {
      videoRef.current.currentTime = target
    }
  }

  const togglePlay = () => {
    if (videoRef.current && !videoError) {
      if (playing) {
        videoRef.current.pause()
        setPlaying(false)
      } else {
        videoRef.current.play().then(() => {
          setPlaying(true)
        }).catch(() => {
          setPlaying(true)
        })
      }
    } else {
      setPlaying(!playing)
    }
  }

  const handleSpeedChange = (s: string) => {
    setSpeed(s)
    if (videoRef.current) {
      videoRef.current.playbackRate = parseFloat(s.replace('x', '')) || 1.0
    }
  }

  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault()
    const query = (customQuery || inputVal).trim()
    if (!query || !selectedVideoId || thinking) return
    const userMsg: Message = { role: 'user', text: query, timestamp: 'Just now' }
    setMessages(prev => [...prev, userMsg])
    if (!customQuery) setInputVal('')
    setThinking(true)

    try {
      const res = await api.sendLearnerChat(selectedVideoId, query)
      const aiMsg: Message = { role: 'ai', text: res.answer, timestamp: 'Just now' }
      setMessages(prev => [...prev, aiMsg])
      if (res.relevant_seconds !== undefined && res.relevant_seconds !== null && res.relevant_seconds > 0) {
        seekTo(res.relevant_seconds)
      }
    } catch (err) {
      const aiMsg: Message = {
        role: 'ai',
        text: `Unable to retrieve a response from the study assistant API. Please verify backend AI service is active.`,
        timestamp: 'Just now'
      }
      setMessages(prev => [...prev, aiMsg])
    } finally {
      setThinking(false)
    }
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const flipCard = (i: number) => {
    setFlashcards(prev => prev.map((c, idx) => idx === i ? { ...c, flipped: !c.flipped } : c))
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div>Loading Study Room...</div>
      </div>
    )
  }

  if (availableVideos.length === 0) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🎓</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>No Videos Available For Study</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 440, textAlign: 'center', lineHeight: 1.6 }}>
          Upload a video lecture to unlock interactive AI study chat, timestamped flashcards, and automated quizzes.
        </p>
        <Link to="/dashboard/upload" className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, textDecoration: 'none' }}>
          Upload Video Lecture
        </Link>
      </div>
    )
  }

  const streamUrl = selectedVideoId
    ? api.getVideoStreamUrl(selectedVideoId, video?.filename)
    : (video?.filename ? api.getVideoStreamUrl(undefined, video.filename) : '')
  const posterUrl = video?.thumbnail_url ? api.getThumbnailUrl(video.thumbnail_url) : ''
  const ytMatch = video?.file_path?.match(/youtube:\/\/([a-zA-Z0-9_-]+)/)
    || video?.filename?.match(/youtube_([a-zA-Z0-9_-]+)\.mp4/)
    || video?.thumbnail_url?.match(/\/vi\/([a-zA-Z0-9_-]+)\//)
  const ytId = ytMatch ? ytMatch[1] : null

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Subheader Banner */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderRadius: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🎓</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)', fontWeight: 700 }}>Interactive Study Room</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <select
                value={selectedVideoId}
                onChange={e => {
                  setSelectedVideoId(e.target.value)
                  navigate(`/dashboard/learner/study/${e.target.value}`)
                }}
                style={{
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 15,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  outline: 'none',
                  maxWidth: 360
                }}
              >
                {availableVideos.map(v => (
                  <option key={v.id} value={v.id} style={{ background: '#111827', color: '#fff' }}>
                    {v.title}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                onClick={() => navigate('/dashboard/upload')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))',
                  cursor: 'pointer'
                }}
              >
                <span>📤</span>
                + Upload Video / URL
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 6, padding: '4px 10px' }}>
            ⏱ {String(Math.floor(studySessionTime / 60)).padStart(2,'0')}:{String(studySessionTime % 60).padStart(2,'0')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Timeline:</span>
            <div style={{ width: 120, height: 6, background: 'var(--border-glass)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${totalSec > 0 ? (currentTimeSec / totalSec) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))', transition: 'width 0.5s' }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-accent)' }}>
              {totalSec > 0 ? Math.round((currentTimeSec / totalSec) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* LEFT — video player & key moments */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div ref={videoContainerRef} className="glass-card" style={{ overflow: 'hidden' }}>
            <div
              style={{ position: 'relative', paddingTop: '56.25%', background: '#000', cursor: ytId ? 'default' : 'pointer' }}
              onClick={ytId ? undefined : togglePlay}
            >
              {ytId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                  title={video?.title || 'YouTube Lecture'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                />
              ) : streamUrl && !videoError ? (
                <video
                  ref={videoRef}
                  src={streamUrl}
                  poster={posterUrl || undefined}
                  playsInline
                  preload="metadata"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={e => setCurrentTimeSec(Math.floor(e.currentTarget.currentTime))}
                  onLoadedMetadata={e => {
                    const dur = e.currentTarget?.duration
                    if (dur && !isNaN(dur) && dur > 0) {
                      const intDur = Math.floor(dur)
                      setVideo((prev: VideoData | null) => prev ? { ...prev, duration_sec: intDur } : prev)
                    }
                  }}
                  onError={() => {
                    console.log('Learner study room video stream error, showing visualizer fallback')
                    setVideoError(true)
                  }}
                  onEnded={() => setPlaying(false)}
                />
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: posterUrl
                    ? `linear-gradient(rgba(10,14,26,0.65), rgba(10,14,26,0.85)), url('${posterUrl}') center/cover`
                    : 'linear-gradient(135deg, #080c18 0%, #0c1830 50%, #080c18 100%)',
                  padding: 20, textAlign: 'center'
                }}>
                  <div style={{ fontSize: 42, marginBottom: 8 }}>🎓</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', maxWidth: '80%' }}>
                    {video?.title || 'Interactive Lecture Room'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {video?.category || 'Academic Lecture'} • {formatTime(currentTimeSec)} / {formatTime(totalSec)}
                  </div>
                </div>
              )}

              {/* Waveform bars (bottom) */}
              <div style={{ position: 'absolute', bottom: 12, left: 20, display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} style={{ width: 3, background: playing ? 'var(--accent-cyan)' : 'rgba(6,182,212,0.3)', borderRadius: 2, opacity: 0.8, height: '100%', transformOrigin: 'bottom', animation: playing ? `waveform-bar ${0.3 + (i % 5) * 0.09}s ${i * 0.04}s ease-in-out infinite alternate` : 'none', transform: `scaleY(${0.15 + Math.sin(i * 0.9) * 0.4 + 0.25})` }} />
                ))}
              </div>

              {!playing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(99,102,241,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(99,102,241,0.5)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 3 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
              )}

              <div style={{ position: 'absolute', bottom: 12, right: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#fff' }}>
                {formatTime(currentTimeSec)} / {formatTime(totalSec)}
              </div>
            </div>

            {/* Controls */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-glass)' }}>
              {/* Seek bar */}
              <div style={{ marginBottom: 12, position: 'relative', cursor: 'pointer', height: 6 }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  seekTo(Math.floor(pct * totalSec))
                }}>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--border-glass)', borderRadius: 3 }}>
                  <div style={{ width: `${totalSec > 0 ? (currentTimeSec / totalSec) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))', borderRadius: 3, position: 'relative' }}>
                    <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: '50%', background: 'white', boxShadow: '0 0 6px var(--accent-indigo)' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn-glass" onClick={togglePlay} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>
                    {playing ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button className="btn-glass" onClick={() => seekTo(0)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>
                    ⏮ Reset
                  </button>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatTime(currentTimeSec)} / {formatTime(totalSec)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {['0.75x', '1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                    <button key={s} onClick={() => handleSpeedChange(s)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, border: 'none', background: speed === s ? 'var(--accent-indigo)' : 'var(--bg-surface)', color: speed === s ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key Moments */}
          <div className="glass-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              📌 Key Moments in this Video
            </div>
            {keyMoments.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 0' }}>
                No key moments detected yet for this video asset.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keyMoments.map((km, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const parts = km.time.split(':').map(Number)
                      const sec = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]
                      setCurrentTimeSec(sec || 0)
                      setPlaying(true)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 700, background: 'rgba(6,182,212,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                        {km.time}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{km.title}</span>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: km.tag === 'Critical' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', color: km.tag === 'Critical' ? 'var(--accent-rose)' : 'var(--text-accent)', fontWeight: 600 }}>
                      {km.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Study tabs: AI Chat / Flashcards / Quiz */}
        <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border-glass)' }}>
            <button
              onClick={() => setActiveSection('chat')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'chat' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'chat' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              💬 AI Tutor
            </button>
            <button
              onClick={() => setActiveSection('flashcards')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'flashcards' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'flashcards' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              🃏 Flashcards ({flashcards.length})
            </button>
            <button
              onClick={() => setActiveSection('quiz')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'quiz' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'quiz' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              📝 Quiz ({quizQuestions.length})
            </button>
          </div>

          {/* AI CHAT */}
          {activeSection === 'chat' && (
            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 480, overflow: 'hidden' }}>
              {/* Quick AI Suggestions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass)' }}>
                {[
                  `Summarize "${video?.title || 'lecture'}"`,
                  'Explain key concepts',
                  'What are the core takeaways?',
                  'Quiz me on this topic'
                ].map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(undefined, s)}
                    disabled={thinking}
                    style={{
                      padding: '4px 10px', borderRadius: 9999,
                      background: 'var(--accent-indigo-dim)', border: '1px solid var(--border-glass)',
                      color: 'var(--accent-indigo)', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'
                    }}
                  >
                    💡 {s}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '12px 16px', borderRadius: 12,
                      background: m.role === 'user' ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                      border: `1px solid ${m.role === 'user' ? 'var(--accent-indigo)' : 'var(--border-glass)'}`,
                      color: '#fff', fontSize: 14, lineHeight: 1.55
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, padding: '0 4px' }}>{m.timestamp}</span>
                  </div>
                ))}
                {thinking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--bg-surface)', borderRadius: 10, width: 'fit-content' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'bounce 1s infinite' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'bounce 1s 0.2s infinite' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'bounce 1s 0.4s infinite' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI is analyzing transcript...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ask AI about this video lecture..."
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  disabled={thinking}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" disabled={!inputVal.trim() || thinking} style={{ padding: '0 18px', borderRadius: 10, fontSize: 14, height: 42 }}>
                  Send
                </button>
              </form>
            </div>
          )}

          {/* FLASHCARDS */}
          {activeSection === 'flashcards' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {flashcards.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🃏</div>
                  <p>No flashcards generated yet. Audio transcript is needed to build study cards.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Card {cardIdx + 1} of {flashcards.length}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-glass" onClick={() => setCardIdx(prev => Math.max(0, prev - 1))} disabled={cardIdx === 0} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, opacity: cardIdx === 0 ? 0.4 : 1 }}>← Prev</button>
                      <button className="btn-glass" onClick={() => setCardIdx(prev => Math.min(flashcards.length - 1, prev + 1))} disabled={cardIdx === flashcards.length - 1} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, opacity: cardIdx === flashcards.length - 1 ? 0.4 : 1 }}>Next →</button>
                    </div>
                  </div>

                  <div onClick={() => flipCard(cardIdx)} style={{ height: 220, cursor: 'pointer', perspective: 1000, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: flashcards[cardIdx].flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                      {/* Front */}
                      <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, border: '1px solid var(--accent-indigo)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>QUESTION [{flashcards[cardIdx].timestamp}]</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.5 }}>
                          {flashcards[cardIdx].front}
                        </div>
                        <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>Click to reveal answer →</div>
                      </div>
                      {/* Back */}
                      <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, border: '1px solid var(--accent-cyan)', background: 'rgba(6,182,212,0.05)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>ANSWER</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.6 }}>
                          {flashcards[cardIdx].back}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { setFlashcards(prev => prev.map((c, i) => i === cardIdx ? { ...c, score: 'review' } : c)); setCardIdx(i => Math.min(i + 1, flashcards.length - 1)) }}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-rose)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                    >😅 Need Review</button>
                    <button
                      onClick={() => { setFlashcards(prev => prev.map((c, i) => i === cardIdx ? { ...c, score: 'know' } : c)); setCardIdx(i => Math.min(i + 1, flashcards.length - 1)) }}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                    >✅ Know It</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* QUIZ */}
          {activeSection === 'quiz' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {quizQuestions.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  <p>No quiz questions available for this video yet.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span>Question {quizIdx + 1} of {quizQuestions.length}</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      {quizAnswers.filter((a, i) => a === quizQuestions[i]?.correct).length} / {quizAnswers.filter(a => a !== null).length} correct
                    </span>
                  </div>

                  <div className="glass-card" style={{ padding: '20px 22px', border: '1px solid var(--accent-indigo)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 16 }}>
                      {quizQuestions[quizIdx].question}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {quizQuestions[quizIdx].options.map((opt, i) => {
                        const selected = quizAnswers[quizIdx] === i
                        const revealed = quizRevealed[quizIdx]
                        const isCorrect = i === quizQuestions[quizIdx].correct
                        let bg = 'var(--bg-surface)'
                        let borderColor = 'var(--border-glass)'
                        let textColor = 'var(--text-primary)'
                        if (revealed) {
                          if (isCorrect) { bg = 'rgba(16,185,129,0.12)'; borderColor = 'var(--accent-emerald)'; textColor = 'var(--accent-emerald)' }
                          else if (selected) { bg = 'rgba(239,68,68,0.1)'; borderColor = 'var(--accent-rose)'; textColor = 'var(--accent-rose)' }
                        } else if (selected) {
                          bg = 'var(--accent-indigo-dim)'; borderColor = 'var(--accent-indigo)'
                        }
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (quizRevealed[quizIdx]) return
                              setQuizAnswers(prev => prev.map((a, qi) => qi === quizIdx ? i : a))
                            }}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${borderColor}`, background: bg, cursor: quizRevealed[quizIdx] ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 13, color: textColor, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                          >
                            <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {revealed ? (isCorrect ? '✓' : selected ? '✗' : String.fromCharCode(65 + i)) : String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                          </button>
                        )
                      })}
                    </div>

                    {quizAnswers[quizIdx] !== null && !quizRevealed[quizIdx] && (
                      <button className="btn-primary" onClick={() => setQuizRevealed(prev => prev.map((r, i) => i === quizIdx ? true : r))} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 8, fontSize: 13 }}>
                        Check Answer
                      </button>
                    )}

                    {quizRevealed[quizIdx] && (
                      <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 4 }}>💡 Explanation</div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{quizQuestions[quizIdx].explanation}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-glass" onClick={() => setQuizIdx(i => Math.max(0, i - 1))} disabled={quizIdx === 0} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, opacity: quizIdx === 0 ? 0.4 : 1 }}>← Previous</button>
                    {quizIdx < quizQuestions.length - 1 ? (
                      <button className="btn-primary" onClick={() => setQuizIdx(i => i + 1)} disabled={!quizRevealed[quizIdx]} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, opacity: !quizRevealed[quizIdx] ? 0.4 : 1 }}>Next →</button>
                    ) : (
                      <button className="btn-primary" onClick={() => { setQuizIdx(0); setQuizAnswers(Array(quizQuestions.length).fill(null)); setQuizRevealed(Array(quizQuestions.length).fill(false)) }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13 }}>🔄 Restart Quiz</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes waveform-bar{0%,100%{transform:scaleY(0.15)}50%{transform:scaleY(1)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
      `}</style>
    </div>
  )
}
