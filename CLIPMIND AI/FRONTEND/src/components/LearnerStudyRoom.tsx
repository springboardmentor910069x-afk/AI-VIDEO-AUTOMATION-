import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, VideoData, Segment, Bookmark } from '../services/api'
import { useToast } from './Toast'

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
  const { showToast } = useToast()

  const [selectedVideoId, setSelectedVideoId] = useState<string>(id || '')
  const [video, setVideo] = useState<VideoData | null>(null)
  const [availableVideos, setAvailableVideos] = useState<VideoData[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [playing, setPlaying] = useState(false)
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [speed, setSpeed] = useState('1.0x')

  // Chat
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hello! I am your AI study assistant. Ask any question about this lecture's concepts, transcripts, or key moments.", timestamp: 'Just now' },
  ])
  const [inputVal, setInputVal] = useState('')
  const [thinking, setThinking] = useState(false)

  // 4 Tabs: chat, flashcards, quiz, transcript
  const [activeSection, setActiveSection] = useState<'chat' | 'flashcards' | 'quiz' | 'transcript'>('chat')

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [cardIdx, setCardIdx] = useState(0)
  const [flashcardFilter, setFlashcardFilter] = useState<'all' | 'review' | 'know'>('all')

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizRevealed, setQuizRevealed] = useState<boolean[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false)

  // Transcript state
  const [transcriptSegments, setTranscriptSegments] = useState<Segment[]>([])
  const [transcriptSearch, setTranscriptSearch] = useState('')

  // In-lecture quick study notes (bookmarks)
  const [videoNotes, setVideoNotes] = useState<Bookmark[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

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

  // Heartbeat to record genuine study time to backend every 15s
  useEffect(() => {
    if (!selectedVideoId) return
    const hb = setInterval(() => {
      api.recordStudySession(selectedVideoId, 15, currentTimeSec)
    }, 15000)
    return () => clearInterval(hb)
  }, [selectedVideoId, currentTimeSec])

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

        // Key moments
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

        // Flashcards
        const fc = await api.getFlashcards(selectedVideoId)
        if (fc && fc.flashcards && fc.flashcards.length > 0) {
          setFlashcards(fc.flashcards.map((f: any) => ({
            id: f.id,
            front: f.front || f.question,
            back: f.back || f.answer,
            timestamp: f.timestamp || '00:00',
            flipped: false,
            score: f.score || null
          })))
          setCardIdx(0)
        } else {
          setFlashcards([])
        }

        // Quizzes
        const qRes = await api.getQuizzes(selectedVideoId)
        if (qRes && qRes.questions && qRes.questions.length > 0) {
          setQuizQuestions(qRes.questions)
          setQuizAnswers(Array(qRes.questions.length).fill(null))
          setQuizRevealed(Array(qRes.questions.length).fill(false))
          setQuizIdx(0)
          setQuizSubmitted(false)
        } else {
          setQuizQuestions([])
          setQuizAnswers([])
          setQuizRevealed([])
          setQuizSubmitted(false)
        }

        // Transcript
        try {
          const trRes = await api.getTranscript(selectedVideoId)
          if (trRes && trRes.segments) {
            setTranscriptSegments(trRes.segments)
          } else {
            setTranscriptSegments([])
          }
        } catch (e) {
          setTranscriptSegments([])
        }

        // Video notes / bookmarks
        try {
          const bmRes = await api.getBookmarks(selectedVideoId)
          if (bmRes && Array.isArray(bmRes)) {
            setVideoNotes(bmRes)
          } else {
            setVideoNotes([])
          }
        } catch (e) {
          setVideoNotes([])
        }

      } catch (e) {
        console.error('Failed to load video study data:', e)
      }
    }
    loadVideoData()
  }, [selectedVideoId])

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const ytPlayerRef = useRef<any>(null)

  const ytMatch = video?.file_path?.match(/youtube:\/\/([a-zA-Z0-9_-]+)/)
    || video?.filename?.match(/youtube_([a-zA-Z0-9_-]+)\.mp4/)
    || video?.thumbnail_url?.match(/\/vi\/([a-zA-Z0-9_-]+)\//)
  const ytId = ytMatch ? ytMatch[1] : null

  const postYTCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        )
      } catch {}
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const totalSec = video?.duration_sec || 300

  // Official YouTube IFrame API Integration
  useEffect(() => {
    if (!ytId) return
    let isMounted = true

    const initPlayer = () => {
      if ((window as any).YT && (window as any).YT.Player && iframeRef.current) {
        try {
          ytPlayerRef.current = new (window as any).YT.Player(iframeRef.current, {
            events: {
              onReady: (event: any) => {
                if (!isMounted) return
                const dur = event.target?.getDuration?.()
                if (dur && dur > 0) {
                  setVideo((prev: VideoData | null) => prev ? { ...prev, duration_sec: Math.floor(dur) } : prev)
                }
                const rate = parseFloat(speed.replace('x', '')) || 1.0
                event.target?.setPlaybackRate?.(rate)
              },
              onStateChange: (event: any) => {
                if (!isMounted) return
                if (event.data === 1) {
                  setPlaying(true)
                } else if (event.data === 2 || event.data === 0) {
                  setPlaying(false)
                }
              }
            }
          })
        } catch (err) {
          console.log('YT Player study room init notice:', err)
        }
      }
    }

    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
      const prevOnReady = (window as any).onYouTubeIframeAPIReady
      ;(window as any).onYouTubeIframeAPIReady = () => {
        if (prevOnReady) prevOnReady()
        initPlayer()
      }
    } else {
      initPlayer()
    }

    return () => {
      isMounted = false
      if (ytPlayerRef.current?.destroy) {
        try { ytPlayerRef.current.destroy() } catch {}
      }
      ytPlayerRef.current = null
    }
  }, [ytId])

  // Real-time message listener from YouTube iframe
  useEffect(() => {
    if (!ytId) return
    const handleMsg = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data) return
        if (data.event === 'onStateChange') {
          if (data.info === 1) setPlaying(true)
          else if (data.info === 2 || data.info === 0) setPlaying(false)
        } else if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            setCurrentTimeSec(Math.floor(data.info.currentTime))
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            setVideo((prev: VideoData | null) => prev ? { ...prev, duration_sec: Math.floor(data.info.duration) } : prev)
          }
          if (typeof data.info.playerState === 'number') {
            setPlaying(data.info.playerState === 1)
          }
        }
      } catch {}
    }
    window.addEventListener('message', handleMsg)
    return () => window.removeEventListener('message', handleMsg)
  }, [ytId])

  // High-frequency polling (200ms) during YouTube playback
  useEffect(() => {
    if (!ytId || !playing) return
    const timer = setInterval(() => {
      if (ytPlayerRef.current?.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime()
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTimeSec(Math.floor(t))
          }
          const d = ytPlayerRef.current.getDuration?.()
          if (typeof d === 'number' && d > 0 && !isNaN(d)) {
            setVideo((prev: VideoData | null) => prev ? { ...prev, duration_sec: Math.floor(d) } : prev)
          }
        } catch {}
      } else {
        postYTCommand('getCurrentTime')
      }
    }, 200)
    return () => clearInterval(timer)
  }, [ytId, playing, postYTCommand])

  const seekTo = (sec: number) => {
    const target = Math.max(0, Math.min(sec, totalSec))
    setCurrentTimeSec(target)
    if (ytId) {
      if (ytPlayerRef.current?.seekTo) {
        try { ytPlayerRef.current.seekTo(target, true) } catch {}
      }
      postYTCommand('seekTo', [target, true])
      if (!playing) {
        if (ytPlayerRef.current?.playVideo) {
          try { ytPlayerRef.current.playVideo() } catch {}
        }
        postYTCommand('playVideo')
        setPlaying(true)
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = target
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(true))
      }
    }
  }

  const skipSeconds = (delta: number) => {
    seekTo(currentTimeSec + delta)
  }

  const togglePlay = () => {
    if (ytId) {
      if (playing) {
        if (ytPlayerRef.current?.pauseVideo) {
          try { ytPlayerRef.current.pauseVideo() } catch {}
        }
        postYTCommand('pauseVideo')
        setPlaying(false)
      } else {
        if (ytPlayerRef.current?.playVideo) {
          try { ytPlayerRef.current.playVideo() } catch {}
        }
        postYTCommand('playVideo')
        setPlaying(true)
      }
    } else if (videoRef.current && !videoError) {
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
    const rate = parseFloat(s.replace('x', '')) || 1.0
    if (ytId) {
      if (ytPlayerRef.current?.setPlaybackRate) {
        try { ytPlayerRef.current.setPlaybackRate(rate) } catch {}
      }
      postYTCommand('setPlaybackRate', [rate])
    } else if (videoRef.current) {
      videoRef.current.playbackRate = rate
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

  // Handle Flashcard Mastery
  const handleScoreCard = async (status: 'know' | 'review') => {
    if (filteredCards.length === 0) return
    const current = filteredCards[cardIdx]
    const cardId = current.id || `fc-${cardIdx + 1}`

    setFlashcards(prev => prev.map(c => c.id === cardId || (c.front === current.front) ? { ...c, score: status } : c))

    try {
      await api.saveFlashcardMastery(selectedVideoId, cardId, status)
      showToast(status === 'know' ? 'Mastered card! 🌟' : 'Saved for review 📝', 'success')
      if (cardIdx < filteredCards.length - 1) {
        setCardIdx(i => i + 1)
      }
    } catch (e) {
      console.error('Failed to save flashcard mastery:', e)
    }
  }

  // Handle Note / Bookmark Creation
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim() || !selectedVideoId || savingNote) return
    setSavingNote(true)
    try {
      const created = await api.createBookmark(
        selectedVideoId,
        currentTimeSec,
        formatTime(currentTimeSec),
        newNoteText.trim(),
        `Note recorded at ${formatTime(currentTimeSec)}`
      )
      setVideoNotes(prev => [created, ...prev])
      setNewNoteText('')
      setNoteFormOpen(false)
      showToast('Study note saved at current timestamp! 📝', 'success')
    } catch (err) {
      showToast('Failed to save study note', 'error')
    } finally {
      setSavingNote(false)
    }
  }

  // Handle Quiz Answer & Submit
  const handleQuizAnswer = (optIdx: number) => {
    if (quizRevealed[quizIdx]) return
    setQuizAnswers(prev => prev.map((a, i) => i === quizIdx ? optIdx : a))
  }

  const handleRevealAnswer = async () => {
    setQuizRevealed(prev => prev.map((r, i) => i === quizIdx ? true : r))

    // Check if this was the last question, submit quiz result to backend
    const nextAnswers = [...quizAnswers]
    const isComplete = nextAnswers.every(a => a !== null)
    if (isComplete && !quizSubmitted) {
      setQuizSubmitted(true)
      const correctCount = nextAnswers.filter((ans, idx) => ans === quizQuestions[idx]?.correct).length
      try {
        await api.submitQuizResult(selectedVideoId, correctCount, quizQuestions.length, nextAnswers)
        const pct = Math.round((correctCount / quizQuestions.length) * 100)
        showToast(`Quiz completed! Score: ${correctCount}/${quizQuestions.length} (${pct}%) 🎉`, 'success')
      } catch (err) {
        console.error('Failed to record quiz submission:', err)
      }
    }
  }

  // Filtered flashcards
  const filteredCards = useMemo(() => {
    if (flashcardFilter === 'all') return flashcards
    if (flashcardFilter === 'know') return flashcards.filter(f => f.score === 'know')
    if (flashcardFilter === 'review') return flashcards.filter(f => f.score === 'review')
    return flashcards
  }, [flashcards, flashcardFilter])

  // Filtered transcript segments
  const filteredTranscript = useMemo(() => {
    if (!transcriptSearch.trim()) return transcriptSegments
    return transcriptSegments.filter(s => (s.text || '').toLowerCase().includes(transcriptSearch.toLowerCase()))
  }, [transcriptSegments, transcriptSearch])

  const masteredCount = flashcards.filter(f => f.score === 'know').length

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
          Upload a video lecture to unlock interactive AI study chat, timestamped flashcards, synchronized transcripts, and automated quizzes.
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

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Subheader Banner */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderRadius: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-glass"
            onClick={() => navigate('/dashboard/learner')}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>←</span> Back to Dashboard
          </button>
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
        {/* LEFT — video player, controls, study notes & key moments */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div ref={videoContainerRef} className="glass-card" style={{ overflow: 'hidden' }}>
            <div
              style={{ position: 'relative', paddingTop: '56.25%', background: '#000', cursor: ytId ? 'default' : 'pointer' }}
              onClick={ytId ? undefined : togglePlay}
            >
              {ytId ? (
                <iframe
                  id="learner-yt-player"
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&widgetid=1`}
                  title={video?.title || 'YouTube Lecture'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => postYTCommand('listening')}
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

              {/* Waveform bars */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn-glass" onClick={togglePlay} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>
                    {playing ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button className="btn-glass" onClick={() => skipSeconds(-10)} title="Skip backward 10s" style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}>
                    ⏪ -10s
                  </button>
                  <button className="btn-glass" onClick={() => skipSeconds(10)} title="Skip forward 10s" style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}>
                    ⏩ +10s
                  </button>
                  <button className="btn-glass" onClick={() => seekTo(0)} style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}>
                    ⏮ Reset
                  </button>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatTime(currentTimeSec)} / {formatTime(totalSec)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Quick Note Trigger */}
                  <button
                    className="btn-glass"
                    onClick={() => setNoteFormOpen(!noteFormOpen)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 12,
                      background: noteFormOpen ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                      borderColor: noteFormOpen ? 'var(--accent-indigo)' : 'var(--border-glass)'
                    }}
                  >
                    📝 Add Note [{formatTime(currentTimeSec)}]
                  </button>

                  {/* Playback speed buttons */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {['0.75x', '1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                      <button key={s} onClick={() => handleSpeedChange(s)} style={{ padding: '3px 7px', borderRadius: 6, fontSize: 11, border: 'none', background: speed === s ? 'var(--accent-indigo)' : 'var(--bg-surface)', color: speed === s ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note Taking Drawer Form */}
              {noteFormOpen && (
                <form onSubmit={handleCreateNote} style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--accent-indigo)', display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={`Take a study note at ${formatTime(currentTimeSec)}...`}
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    style={{ flex: 1, height: 36, fontSize: 12 }}
                    autoFocus
                  />
                  <button type="submit" className="btn-primary" disabled={!newNoteText.trim() || savingNote} style={{ padding: '0 14px', borderRadius: 8, fontSize: 12 }}>
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* In-Lecture Saved Notes */}
          {videoNotes.length > 0 && (
            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span>📝 My Notes on This Lecture ({videoNotes.length})</span>
                <span style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>Click to jump to time</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {videoNotes.map(n => (
                  <div
                    key={n.id}
                    onClick={() => seekTo(n.timestamp_sec)}
                    style={{
                      padding: '8px 12px', borderRadius: 6, background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {n.label || n.note}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                      {n.timestamp_str}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      seekTo(sec || 0)
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

        {/* RIGHT — 4 Interactive Study Tabs: AI Tutor / Flashcards / Quiz / Transcript */}
        <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border-glass)' }}>
            <button
              onClick={() => setActiveSection('chat')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'chat' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'chat' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              💬 AI Tutor
            </button>
            <button
              onClick={() => setActiveSection('flashcards')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'flashcards' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'flashcards' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              🃏 Cards ({flashcards.length})
            </button>
            <button
              onClick={() => setActiveSection('quiz')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'quiz' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'quiz' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              📝 Quiz ({quizQuestions.length})
            </button>
            <button
              onClick={() => setActiveSection('transcript')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: activeSection === 'transcript' ? 'var(--accent-indigo)' : 'transparent', color: activeSection === 'transcript' ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              📜 Transcript
            </button>
          </div>

          {/* TAB 1: AI CHAT */}
          {activeSection === 'chat' && (
            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 500, overflow: 'hidden' }}>
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

          {/* TAB 2: FLASHCARDS WITH PERSISTENT MASTERY */}
          {activeSection === 'flashcards' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {flashcards.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🃏</div>
                  <p>No flashcards generated yet. Audio transcript is needed to build study cards.</p>
                </div>
              ) : (
                <>
                  {/* Flashcard Mastery Gauge & Filter */}
                  <div className="glass-card" style={{ padding: '12px 16px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Mastery:</span>
                      <div style={{ width: 80, height: 6, background: 'var(--border-glass)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${flashcards.length > 0 ? (masteredCount / flashcards.length) * 100 : 0}%`,
                          height: '100%', background: 'var(--accent-emerald)', transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {masteredCount}/{flashcards.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['all', 'review', 'know'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => { setFlashcardFilter(f); setCardIdx(0) }}
                          style={{
                            padding: '3px 8px', borderRadius: 6, border: 'none',
                            background: flashcardFilter === f ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                            color: flashcardFilter === f ? '#fff' : 'var(--text-secondary)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                          }}
                        >
                          {f === 'all' ? 'All' : f === 'know' ? '✅ Mastered' : '😅 Review'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredCards.length === 0 ? (
                    <div className="glass-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No cards found in the "{flashcardFilter}" category.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Card {cardIdx + 1} of {filteredCards.length}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-glass" onClick={() => setCardIdx(prev => Math.max(0, prev - 1))} disabled={cardIdx === 0} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, opacity: cardIdx === 0 ? 0.4 : 1 }}>← Prev</button>
                          <button className="btn-glass" onClick={() => setCardIdx(prev => Math.min(filteredCards.length - 1, prev + 1))} disabled={cardIdx === filteredCards.length - 1} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, opacity: cardIdx === filteredCards.length - 1 ? 0.4 : 1 }}>Next →</button>
                        </div>
                      </div>

                      {/* Flip card */}
                      <div onClick={() => setFlashcards(prev => prev.map(c => c.id === filteredCards[cardIdx].id ? { ...c, flipped: !c.flipped } : c))} style={{ height: 230, cursor: 'pointer', perspective: 1000, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, transition: 'transform 0.4s', transformStyle: 'preserve-3d', transform: filteredCards[cardIdx].flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                          {/* Front */}
                          <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, border: '1px solid var(--accent-indigo)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>QUESTION [{filteredCards[cardIdx].timestamp}]</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.5 }}>
                              {filteredCards[cardIdx].front}
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>Click to reveal answer →</div>
                          </div>
                          {/* Back */}
                          <div className="glass-card" style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, border: '1px solid var(--accent-cyan)', background: 'rgba(6,182,212,0.05)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>ANSWER</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.6, overflowY: 'auto', maxHeight: 150 }}>
                              {filteredCards[cardIdx].back}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => handleScoreCard('review')}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-rose)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          😅 Need Review
                        </button>
                        <button
                          onClick={() => handleScoreCard('know')}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          ✅ Know It
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: QUIZ WITH INSTANT EXPLANATIONS & BACKEND PERSISTENCE */}
          {activeSection === 'quiz' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {quizQuestions.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  <p>No quiz questions available for this video yet.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>Question {quizIdx + 1} of {quizQuestions.length}</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      {quizAnswers.filter((a, i) => a === quizQuestions[i]?.correct).length} / {quizAnswers.filter(a => a !== null).length} correct
                    </span>
                  </div>

                  <div className="glass-card" style={{ padding: '18px 20px', border: '1px solid var(--accent-indigo)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 14 }}>
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
                            onClick={() => handleQuizAnswer(i)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: bg, cursor: quizRevealed[quizIdx] ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 13, color: textColor, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10 }}
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
                      <button className="btn-primary" onClick={handleRevealAnswer} style={{ marginTop: 14, padding: '7px 18px', borderRadius: 8, fontSize: 13 }}>
                        Check Answer
                      </button>
                    )}

                    {quizRevealed[quizIdx] && (
                      <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 8 }}>
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
                      <button className="btn-primary" onClick={() => { setQuizIdx(0); setQuizAnswers(Array(quizQuestions.length).fill(null)); setQuizRevealed(Array(quizQuestions.length).fill(false)); setQuizSubmitted(false) }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13 }}>🔄 Restart Quiz</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SYNCHRONIZED INTERACTIVE TRANSCRIPT */}
          {activeSection === 'transcript' && (
            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 500, overflow: 'hidden' }}>
              {/* Search input in transcript */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass)' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search spoken words in this lecture..."
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  style={{ height: 34, fontSize: 12 }}
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredTranscript.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>
                    No transcript segments match your search.
                  </div>
                ) : (
                  filteredTranscript.map((seg, i) => {
                    const startSec = Math.floor(seg.start || 0)
                    const isCurrent = currentTimeSec >= startSec && currentTimeSec < (seg.end || startSec + 5)

                    return (
                      <div
                        key={i}
                        onClick={() => seekTo(startSec)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: isCurrent ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                          border: isCurrent ? '1px solid var(--accent-indigo)' : '1px solid var(--border-glass)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>
                            ⏱ {seg.timestamp || formatTime(startSec)}
                          </span>
                          {isCurrent && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-indigo)', color: '#fff', fontWeight: 700 }}>
                              Playing
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: isCurrent ? '#fff' : 'var(--text-primary)', lineHeight: 1.5 }}>
                          {seg.text}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
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
