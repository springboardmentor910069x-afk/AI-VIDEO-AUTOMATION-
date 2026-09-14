import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, LearnerDashboardData, LearnerLectureProgress } from '../services/api'
import { useToast } from './Toast'

export default function LearnerDashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LearnerDashboardData | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('clipmind_learner_daily_goal')
    return saved ? parseInt(saved, 10) : 30
  })

  // Quick interactive practice deck state
  const [activeDeckVideoId, setActiveDeckVideoId] = useState<string>('')
  const [flashcards, setFlashcards] = useState<any[]>([])
  const [cardIdx, setCardIdx] = useState(0)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)

  // Live session timer in current view
  const [sessionSeconds, setSessionSeconds] = useState(0)

  const studentName = (() => {
    try {
      const stored = localStorage.getItem('clipmind_user')
      if (stored) {
        const u = JSON.parse(stored)
        return u.name || u.email?.split('@')[0] || 'Learner'
      }
    } catch (e) {}
    return 'Learner'
  })()

  // Track session timer
  useEffect(() => {
    const timer = setInterval(() => setSessionSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load genuine dashboard data from backend
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.getLearnerDashboard()
      setData(res)
      if (res.recent_lectures && res.recent_lectures.length > 0 && !activeDeckVideoId) {
        setActiveDeckVideoId(res.recent_lectures[0].id)
      }
    } catch (err) {
      console.error('Failed to load learner dashboard data:', err)
      showToast('Could not refresh study stats from backend', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeDeckVideoId, showToast])

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 15000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  // Load flashcards for quick practice hub when activeDeckVideoId changes
  useEffect(() => {
    if (!activeDeckVideoId) return
    const fetchCards = async () => {
      try {
        setCardLoading(true)
        const fcRes = await api.getFlashcards(activeDeckVideoId)
        if (fcRes && fcRes.flashcards) {
          setFlashcards(fcRes.flashcards)
          setCardIdx(0)
          setCardFlipped(false)
        } else {
          setFlashcards([])
        }
      } catch (e) {
        setFlashcards([])
      } finally {
        setCardLoading(false)
      }
    }
    fetchCards()
  }, [activeDeckVideoId])

  const handleCardMastery = async (status: 'know' | 'review') => {
    if (!activeDeckVideoId || flashcards.length === 0) return
    const currentCard = flashcards[cardIdx]
    const cardId = currentCard.id || `fc-${cardIdx + 1}`

    // Optimistic update
    setFlashcards(prev => prev.map((c, i) => i === cardIdx ? { ...c, score: status } : c))

    try {
      await api.saveFlashcardMastery(activeDeckVideoId, cardId, status)
      showToast(status === 'know' ? 'Card mastered! 🌟' : 'Marked for review 📝', 'success')
      // Advance to next card
      if (cardIdx < flashcards.length - 1) {
        setCardIdx(i => i + 1)
        setCardFlipped(false)
      }
      loadDashboard()
    } catch (e) {
      console.error('Failed to save flashcard mastery:', e)
    }
  }

  const handleGoalChange = (newGoal: number) => {
    setDailyGoal(newGoal)
    localStorage.setItem('clipmind_learner_daily_goal', String(newGoal))
    showToast(`Daily study goal set to ${newGoal} minutes`, 'info')
  }

  // Format seconds to mm:ss
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Categories list for filtering
  const categories = useMemo(() => {
    if (!data?.recent_lectures) return ['All']
    const set = new Set<string>(['All'])
    data.recent_lectures.forEach(l => {
      if (l.category) set.add(l.category)
    })
    return Array.from(set)
  }, [data])

  // Filtered lectures
  const filteredLectures = useMemo(() => {
    if (!data?.recent_lectures) return []
    return data.recent_lectures.filter(l => {
      const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.category.toLowerCase().includes(search.toLowerCase())
      const matchCat = selectedCategory === 'All' || l.category === selectedCategory
      return matchSearch && matchCat
    })
  }, [data, search, selectedCategory])

  const goalProgressPct = data ? Math.min(100, Math.round((data.today_study_minutes / dailyGoal) * 100)) : 0

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Loading Student Dashboard...</div>
      </div>
    )
  }

  const totalStudyMinutes = data?.total_study_minutes || 0
  const lecturesStudied = data?.lectures_studied || 0
  const totalLectures = data?.total_lectures || 0
  const flashcardsMastered = data?.flashcards_mastered || 0
  const flashcardsTotal = data?.flashcards_total || 0
  const flashcardMasteryPct = data?.flashcard_mastery_pct || 0
  const quizzesTaken = data?.quizzes_taken || 0
  const quizAccuracyPct = data?.quiz_accuracy_pct || 0
  const streakDays = data?.streak_days || 0
  const todayMinutes = data?.today_study_minutes || 0

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Welcome & Motivation Banner */}
      <div className="glass-card" style={{
        padding: '24px 28px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24 }}>👋</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Welcome back, {studentName}!
            </h1>
            <span style={{
              background: streakDays > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface)',
              border: streakDays > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-glass)',
              color: streakDays > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              🔥 {streakDays > 0 ? `${streakDays} Day Streak` : 'Start your streak today'}
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Explore your video lectures, test your knowledge with AI flashcards, and track your genuine mastery.
          </p>
        </div>

        {/* Daily Study Goal & Live Session Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Daily goal circular / progress widget */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            padding: '10px 16px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5 }}>Daily Study Goal</span>
                <select
                  value={dailyGoal}
                  onChange={e => handleGoalChange(parseInt(e.target.value, 10))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                >
                  <option value={15} style={{ background: '#111827', color: '#fff' }}>15m goal</option>
                  <option value={30} style={{ background: '#111827', color: '#fff' }}>30m goal</option>
                  <option value={45} style={{ background: '#111827', color: '#fff' }}>45m goal</option>
                  <option value={60} style={{ background: '#111827', color: '#fff' }}>60m goal</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 110, height: 7, background: 'var(--border-glass)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${goalProgressPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))',
                    borderRadius: 4,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {todayMinutes} / {dailyGoal}m
                </span>
              </div>
            </div>
          </div>

          {/* Active Session timer */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            padding: '10px 14px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ fontSize: 16 }}>⏱️</span>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: 700 }}>Active Session</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                {formatSeconds(sessionSeconds)}
              </div>
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => navigate('/dashboard/upload')}
            style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>📤</span>
            Upload New Lecture
          </button>
        </div>
      </div>

      {/* 4 Core Real Metric Cards (Zero Fake Numbers) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Total study time */}
        <div className="glass-card" style={{ padding: '18px 22px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Total Study Time
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {totalStudyMinutes >= 60 ? `${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m` : `${totalStudyMinutes} mins`}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              ⏱️
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {todayMinutes > 0 ? `+${todayMinutes} mins logged today` : 'Tracked from your active study sessions'}
          </div>
        </div>

        {/* Lectures studied */}
        <div className="glass-card" style={{ padding: '18px 22px', borderLeft: '4px solid var(--accent-indigo)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Lectures Explored
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {lecturesStudied} <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>/ {totalLectures}</span>
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              📚
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {totalLectures > 0 ? `${Math.round((lecturesStudied / totalLectures) * 100)}% course catalog engagement` : 'Upload lectures to begin'}
          </div>
        </div>

        {/* Flashcard mastery */}
        <div className="glass-card" style={{ padding: '18px 22px', borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Flashcard Mastery
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-emerald)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {flashcardMasteryPct}%
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🃏
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {flashcardsTotal > 0 ? `${flashcardsMastered} mastered out of ${flashcardsTotal} practiced` : 'Practice cards below to test recall'}
          </div>
        </div>

        {/* Quiz performance */}
        <div className="glass-card" style={{ padding: '18px 22px', borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Quiz Accuracy
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-amber)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {quizzesTaken > 0 ? `${quizAccuracyPct}%` : '0%'}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🎯
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {quizzesTaken > 0 ? `${quizzesTaken} quiz challenges completed` : 'Take video quizzes to verify mastery'}
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Course Lectures & Continue Learning; Right = Quick Practice & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 24, alignItems: 'start' }}>
        {/* LEFT: Lecture Catalog & Learning Pathways */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header & Filter Controls */}
          <div className="glass-card" style={{ padding: '18px 20px', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  📚 My Video Lectures
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Interactive study rooms with synchronized transcripts and AI tutoring
                </span>
              </div>

              {/* Search field */}
              <div style={{ position: 'relative', width: 220 }}>
                <input
                  type="text"
                  placeholder="Search lecture..."
                  className="input-field"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ height: 34, paddingLeft: 30, fontSize: 12, borderRadius: 8 }}
                />
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, opacity: 0.6 }}>🔍</span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: '1px solid',
                    borderColor: selectedCategory === cat ? 'var(--accent-indigo)' : 'var(--border-glass)',
                    background: selectedCategory === cat ? 'var(--accent-indigo-dim)' : 'var(--bg-surface)',
                    color: selectedCategory === cat ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Lecture Cards List */}
          {filteredLectures.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No Lectures Found</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                {search || selectedCategory !== 'All' ? 'Try adjusting your search or category filter.' : 'Upload your first lecture to unlock interactive AI study tools.'}
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate('/dashboard/upload')}
                style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, fontSize: 13 }}
              >
                Upload Video Lecture
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredLectures.map(lecture => {
                const durMin = Math.floor(lecture.duration_sec / 60)
                const durSec = lecture.duration_sec % 60
                const formattedDuration = `${durMin}:${durSec.toString().padStart(2, '0')}`

                return (
                  <div
                    key={lecture.id}
                    className="glass-card"
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid var(--border-glass)',
                      transition: 'transform 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-glass)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Thumbnail preview */}
                    <div style={{ position: 'relative', height: 140, background: '#0a0e1a', overflow: 'hidden' }}>
                      {lecture.thumbnail_url ? (
                        <img
                          src={api.getThumbnailUrl(lecture.thumbnail_url)}
                          alt={lecture.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 100%)' }}>
                          <span style={{ fontSize: 36 }}>🎓</span>
                        </div>
                      )}

                      {/* Duration pill */}
                      <span style={{
                        position: 'absolute', bottom: 8, right: 8,
                        background: 'rgba(0,0,0,0.75)', color: '#fff',
                        fontSize: 11, fontWeight: 700, padding: '2px 6px',
                        borderRadius: 4, fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        {formattedDuration}
                      </span>

                      {/* Category tag */}
                      <span style={{
                        position: 'absolute', top: 8, left: 8,
                        background: 'rgba(99,102,241,0.85)', color: '#fff',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 20
                      }}>
                        {lecture.category}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1, gap: 10 }}>
                      <h3 style={{
                        fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                        margin: 0, lineHeight: 1.4, height: 40, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                      }}>
                        {lecture.title}
                      </h3>

                      {/* Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          <span>Course Progress</span>
                          <span style={{ fontWeight: 700, color: lecture.progress_pct > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                            {lecture.progress_pct}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 5, background: 'var(--border-glass)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${lecture.progress_pct}%`,
                            height: '100%',
                            background: lecture.completed ? 'var(--accent-emerald)' : 'linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))',
                            borderRadius: 3
                          }} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/dashboard/learner/study/${lecture.id}`)}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12,
                            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <span>▶</span>
                          {lecture.progress_pct > 0 ? 'Resume' : 'Study'}
                        </button>
                        <button
                          className="btn-glass"
                          onClick={() => {
                            setActiveDeckVideoId(lecture.id)
                            showToast(`Loaded flashcards for: ${lecture.title.substring(0, 24)}...`, 'info')
                          }}
                          title="Practice Flashcards"
                          style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
                        >
                          🃏
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Badges and Milestones Section */}
          <div className="glass-card" style={{ padding: '20px 22px', borderRadius: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginBottom: 14 }}>
              🏆 Study Achievements & Milestones
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {(data?.milestones || []).map(m => (
                <div
                  key={m.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: m.unlocked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface)',
                    border: m.unlocked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <span style={{ fontSize: 24, filter: m.unlocked ? 'none' : 'grayscale(100%) opacity(0.4)' }}>
                    {m.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: m.unlocked ? 'var(--accent-emerald)' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      {m.title}
                      {m.unlocked && <span style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {m.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Interactive Flashcard Practice Hub & Recent Study Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Quick Flashcard Trainer Hub */}
          <div className="glass-card" style={{ padding: '20px 22px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  🃏 Flashcard Quick-Practice
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Test your recall with real persistent mastery tracking
                </span>
              </div>

              {/* Lecture Selector for Flashcards */}
              <select
                value={activeDeckVideoId}
                onChange={e => setActiveDeckVideoId(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid var(--border-glass)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  maxWidth: 150,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {(data?.recent_lectures || []).map(l => (
                  <option key={l.id} value={l.id} style={{ background: '#111827', color: '#fff' }}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            {cardLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Loading deck...
              </div>
            ) : flashcards.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
                No flashcards available for this video yet. Upload a lecture with audio to auto-generate cards.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Card {cardIdx + 1} of {flashcards.length}</span>
                  <span style={{
                    color: flashcards[cardIdx]?.score === 'know' ? 'var(--accent-emerald)' : flashcards[cardIdx]?.score === 'review' ? 'var(--accent-rose)' : 'var(--text-secondary)',
                    fontWeight: 700
                  }}>
                    {flashcards[cardIdx]?.score === 'know' ? '✅ Mastered' : flashcards[cardIdx]?.score === 'review' ? '😅 Needs Review' : 'Not practiced yet'}
                  </span>
                </div>

                {/* 3D Flip Flashcard */}
                <div
                  onClick={() => setCardFlipped(!cardFlipped)}
                  style={{
                    height: 200,
                    cursor: 'pointer',
                    perspective: 1000,
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    transition: 'transform 0.4s ease',
                    transformStyle: 'preserve-3d',
                    transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}>
                    {/* Front */}
                    <div className="glass-card" style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', padding: 20, textAlign: 'center',
                      border: '1px solid var(--accent-indigo)'
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        QUESTION [{flashcards[cardIdx]?.timestamp || '00:00'}]
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {flashcards[cardIdx]?.front || flashcards[cardIdx]?.question}
                      </div>
                      <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
                        Click to flip and reveal answer →
                      </div>
                    </div>

                    {/* Back */}
                    <div className="glass-card" style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', padding: 20, textAlign: 'center',
                      border: '1px solid var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.05)'
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        ANSWER & EXPLANATION
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, overflowY: 'auto', maxHeight: 120 }}>
                        {flashcards[cardIdx]?.back || flashcards[cardIdx]?.answer}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating / Next actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCardMastery('review')}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8,
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--accent-rose)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                    }}
                  >
                    😅 Need Review
                  </button>
                  <button
                    onClick={() => handleCardMastery('know')}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--accent-emerald)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                    }}
                  >
                    ✅ Know It
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <button
                    className="btn-glass"
                    onClick={() => { setCardIdx(i => Math.max(0, i - 1)); setCardFlipped(false) }}
                    disabled={cardIdx === 0}
                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, opacity: cardIdx === 0 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>
                  <button
                    className="btn-glass"
                    onClick={() => { setCardIdx(i => Math.min(flashcards.length - 1, i + 1)); setCardFlipped(false) }}
                    disabled={cardIdx === flashcards.length - 1}
                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, opacity: cardIdx === flashcards.length - 1 ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent In-Lecture Notes / Bookmarks */}
          <div className="glass-card" style={{ padding: '20px 22px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  📝 My In-Lecture Study Notes
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Timestamped bookmarks taken during video playback
                </span>
              </div>
              <button
                className="btn-glass"
                onClick={() => navigate('/dashboard/bookmarks')}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}
              >
                View All →
              </button>
            </div>

            {(!data?.recent_notes || data.recent_notes.length === 0) ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                No study notes taken yet. While watching any lecture in the Study Room, click "Add Study Note" to capture key timestamps!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recent_notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => navigate(`/dashboard/learner/study/${note.video_id}`)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-glass-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.label || note.note || 'Study Note'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {note.video_title}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: 'var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0
                    }}>
                      ⏱ {note.timestamp_str}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
