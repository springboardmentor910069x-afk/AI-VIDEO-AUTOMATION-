import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, VideoData, Segment as ApiSegment } from '../services/api'
import { useToast } from './Toast'

interface Segment {
  id: string
  speaker: string
  speakerLabel: string
  startTime: string
  endTime: string
  text: string
  type: 'speech' | 'section-break' | 'annotation'
  edited?: boolean
  annotation?: string
}

interface Chapter {
  title: string
  timeRange: string
  summary: string
  bulletPoints: string[]
}

interface QuizQ {
  id?: string
  question: string
  options: string[]
  correct: number
  explanation: string
}

interface FlashcardItem {
  id?: string
  front: string
  back: string
  timestamp: string
}

const SPEAKERS = ['Speaker 1', 'Speaker 2', 'Speaker 3', 'Speaker 4', 'Instructor']
const SPEAKER_LABELS: Record<string, string> = {
  'Speaker 1': 'Lead Instructor',
  'Speaker 2': 'Student Question',
  'Speaker 3': 'Teaching Assistant',
  'Speaker 4': 'Guest Speaker',
  'Instructor': 'Lead Instructor'
}
const SPEAKER_COLORS: Record<string, string> = {
  'Speaker 1': 'var(--accent-indigo)',
  'Speaker 2': 'var(--accent-cyan)',
  'Speaker 3': 'var(--accent-emerald)',
  'Speaker 4': 'var(--accent-amber)',
  'Instructor': 'var(--accent-indigo)',
  'Unknown': 'var(--text-secondary)'
}

export default function EducatorEditor() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<'transcript' | 'chapters' | 'quizzes' | 'flashcards' | 'preview'>('transcript')
  const [availableVideos, setAvailableVideos] = useState<VideoData[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string>(id || '')
  const [videoTitle, setVideoTitle] = useState<string>('Lecture Studio')
  const [loading, setLoading] = useState<boolean>(true)

  // Transcript state
  const [segments, setSegments] = useState<Segment[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [publishingTranscript, setPublishingTranscript] = useState(false)
  const [showAddSection, setShowAddSection] = useState<string | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Chapters state
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [savingChapters, setSavingChapters] = useState(false)

  // Quizzes state
  const [quizzes, setQuizzes] = useState<QuizQ[]>([])
  const [savingQuizzes, setSavingQuizzes] = useState(false)

  // Flashcards state
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([])
  const [savingFlashcards, setSavingFlashcards] = useState(false)

  // Student Preview state
  const [previewFlippedCard, setPreviewFlippedCard] = useState<number | null>(null)

  // Fetch available lectures
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
        console.error('Failed to load videos:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchVideos()
  }, [id])

  // Load all lecture data when selectedVideoId changes
  useEffect(() => {
    if (!selectedVideoId) return
    const loadLectureData = async () => {
      try {
        const v = await api.getVideo(selectedVideoId)
        if (v) setVideoTitle(v.title)

        // 1. Transcript
        const trRes = await api.getTranscript(selectedVideoId).catch(() => null)
        if (trRes && trRes.segments && trRes.segments.length > 0) {
          const mapped: Segment[] = trRes.segments.map((s: ApiSegment, idx: number) => ({
            id: `seg-${s.id || idx}`,
            speaker: s.speaker || 'Speaker 1',
            speakerLabel: SPEAKER_LABELS[s.speaker] || s.speaker || 'Lead Instructor',
            startTime: s.timestamp || '00:00',
            endTime: s.timestamp || '00:15',
            text: s.text,
            type: 'speech'
          }))
          setSegments(mapped)
        } else {
          setSegments([])
        }

        // 2. Chapters (from Summary)
        const sumRes = await api.getSummary(selectedVideoId).catch(() => null)
        if (sumRes && sumRes.sections && sumRes.sections.length > 0) {
          setChapters(sumRes.sections.map((sec: any) => ({
            title: sec.title || sec.heading || 'Chapter',
            timeRange: sec.timeRange || sec.timestamp_range || '00:00 - 01:00',
            summary: sec.summary || '',
            bulletPoints: sec.bulletPoints || sec.points || []
          })))
        } else {
          setChapters([
            {
              title: 'Introduction & Foundations',
              timeRange: '00:00 - 00:45',
              summary: 'Overview of core objectives and fundamental architecture.',
              bulletPoints: ['Key terminology definition', 'Course overview']
            }
          ])
        }

        // 3. Quizzes
        const qRes = await api.getEducatorQuizzes(selectedVideoId).catch(() => null)
        if (qRes && qRes.questions && qRes.questions.length > 0) {
          setQuizzes(qRes.questions)
        } else {
          setQuizzes([])
        }

        // 4. Flashcards
        const fcRes = await api.getEducatorFlashcards(selectedVideoId).catch(() => null)
        if (fcRes && fcRes.flashcards && fcRes.flashcards.length > 0) {
          setFlashcards(fcRes.flashcards)
        } else {
          setFlashcards([])
        }
      } catch (e) {
        console.error('Failed to load lecture materials:', e)
      }
    }
    loadLectureData()
  }, [selectedVideoId])

  // --- TRANSCRIPT HANDLERS ---
  const startEdit = (seg: Segment) => {
    setEditingId(seg.id)
    setEditText(seg.text)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const saveEdit = (segId: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, text: editText, edited: true } : s))
    setEditingId(null)
    showToast('Segment updated', 'success', 1500)
  }

  const setSpeaker = (segId: string, speaker: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, speaker, speakerLabel: SPEAKER_LABELS[speaker] ?? speaker, edited: true } : s))
    setEditingSpeakerId(null)
    showToast(`Speaker assigned: ${SPEAKER_LABELS[speaker] ?? speaker}`, 'info', 1500)
  }

  const addSectionBreak = (afterId: string) => {
    if (!newSectionTitle.trim()) return
    const idx = segments.findIndex(s => s.id === afterId)
    const prev = segments[idx]
    const newBreak: Segment = {
      id: `b-${Date.now()}`,
      speaker: '',
      speakerLabel: '',
      startTime: prev ? prev.endTime : '00:00',
      endTime: prev ? prev.endTime : '00:00',
      text: `SECTION: ${newSectionTitle}`,
      type: 'section-break',
      annotation: `Section divider — ${newSectionTitle}`
    }
    const updated = [...segments]
    updated.splice(idx + 1, 0, newBreak)
    setSegments(updated)
    setNewSectionTitle('')
    setShowAddSection(null)
    showToast(`Section break added: ${newSectionTitle}`, 'success', 1800)
  }

  const removeSegment = (segId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segId))
    showToast('Item removed', 'info', 1500)
  }

  const handlePublishTranscript = async () => {
    if (!selectedVideoId) return
    setPublishingTranscript(true)
    try {
      const formattedSegs = segments
        .filter(s => s.type === 'speech')
        .map((s, idx) => ({
          id: idx + 1,
          start: idx * 15.0,
          end: (idx + 1) * 15.0,
          timestamp: s.startTime,
          speaker: s.speakerLabel || s.speaker,
          text: s.text,
          confidence: 0.98
        }))
      await api.updateEducatorTranscript(selectedVideoId, formattedSegs)
      showToast('✓ Transcript published to Student Portal', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save transcript', 'error')
    } finally {
      setPublishingTranscript(false)
    }
  }

  // --- CHAPTERS HANDLERS ---
  const handleSaveChapters = async () => {
    if (!selectedVideoId) return
    setSavingChapters(true)
    try {
      await api.updateEducatorChapters(selectedVideoId, chapters)
      showToast('✓ Chapters saved and published to Student Portal', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save chapters', 'error')
    } finally {
      setSavingChapters(false)
    }
  }

  const addChapter = () => {
    setChapters(prev => [
      ...prev,
      {
        title: `Chapter ${prev.length + 1}: New Topic`,
        timeRange: '01:00 - 02:00',
        summary: 'Detailed explanation of key topic.',
        bulletPoints: ['Key takeaway point']
      }
    ])
    showToast('New chapter added', 'info')
  }

  // --- QUIZZES HANDLERS ---
  const handleSaveQuizzes = async () => {
    if (!selectedVideoId) return
    setSavingQuizzes(true)
    try {
      await api.saveEducatorQuiz(selectedVideoId, quizzes)
      showToast('✓ Custom quiz saved and published to Student Portal', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save quiz', 'error')
    } finally {
      setSavingQuizzes(false)
    }
  }

  const addQuizQuestion = () => {
    setQuizzes(prev => [
      ...prev,
      {
        id: `q-${prev.length + 1}`,
        question: `Question ${prev.length + 1}: What core concept was discussed?`,
        options: [
          'Primary conceptual framework explained in the lecture',
          'Alternative theoretical approach',
          'Unrelated external methodology',
          'Deprecated legacy pattern'
        ],
        correct: 0,
        explanation: 'This answer directly aligns with the lecture findings.'
      }
    ])
    showToast('New quiz question added', 'info')
  }

  // --- FLASHCARDS HANDLERS ---
  const handleSaveFlashcards = async () => {
    if (!selectedVideoId) return
    setSavingFlashcards(true)
    try {
      await api.saveEducatorFlashcards(selectedVideoId, flashcards)
      showToast('✓ Custom flashcards saved and published to Student Portal', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save flashcards', 'error')
    } finally {
      setSavingFlashcards(false)
    }
  }

  const addFlashcard = () => {
    setFlashcards(prev => [
      ...prev,
      {
        id: `fc-${prev.length + 1}`,
        front: `Core Concept ${prev.length + 1}: What is the primary definition?`,
        back: 'The structured definition and explanation provided in the lecture.',
        timestamp: '00:30'
      }
    ])
    showToast('New flashcard added', 'info')
  }

  const editedCount = segments.filter(s => s.edited).length

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div>Loading Educator Lecture Studio...</div>
      </div>
    )
  }

  if (availableVideos.length === 0) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>✏️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>No Lecture Videos Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 440, textAlign: 'center', lineHeight: 1.6 }}>
          Upload a video lecture to edit transcripts, annotate section breaks, build quizzes, and organize study chapters.
        </p>
        <button className="btn-primary" onClick={() => navigate('/dashboard/upload')}>
          Upload Lecture Video
        </button>
      </div>
    )
  }

  return (
    <div className="responsive-page-container" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Subheader Banner */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderRadius: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🎓</span> Educator Curriculum Studio
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Lecture Asset:</span>
            <select
              value={selectedVideoId}
              onChange={e => {
                setSelectedVideoId(e.target.value)
                navigate(`/dashboard/educator/lectures/${e.target.value}/edit`)
              }}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: 13,
                border: '1px solid var(--border-glass)',
                borderRadius: 8,
                padding: '4px 10px',
                outline: 'none',
                maxWidth: 'min(100%, 340px)',
                textOverflow: 'ellipsis'
              }}
            >
              {availableVideos.map(v => (
                <option key={v.id} value={v.id} style={{ background: '#111827', color: '#fff' }}>
                  {v.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div className="tabs-scroll-container" style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border-glass)', gap: 4, maxWidth: '100%' }}>
          {[
            { id: 'transcript', label: '🎙️ Transcript', count: segments.length },
            { id: 'chapters', label: '📑 Chapters', count: chapters.length },
            { id: 'quizzes', label: '📝 Quizzes', count: quizzes.length },
            { id: 'flashcards', label: '🃏 Flashcards', count: flashcards.length },
            { id: 'preview', label: '👁️ Student Preview' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent-indigo)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{ fontSize: 11, background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--border-glass)', padding: '1px 6px', borderRadius: 9999 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: TRANSCRIPT DIARIZATION */}
      {activeTab === 'transcript' && (
        <div className="stack-on-tablet" style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 240px)' }}>
          {/* LEFT Sidebar */}
          <div style={{ flex: '1 1 240px', maxWidth: 'min(100%, 280px)', width: '100%', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-glass)', padding: '20px 16px', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Speaker Diarization</div>
              {Object.entries(SPEAKER_LABELS).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SPEAKER_COLORS[key] || 'var(--accent-indigo)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{key}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Transcript Stats</div>
              {[
                { label: 'Total Segments', value: segments.filter(s => s.type === 'speech').length },
                { label: 'Edited Segments', value: editedCount },
                { label: 'Section Breaks', value: segments.filter(s => s.type === 'section-break').length },
              ].map((stat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</span>
                </div>
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={handlePublishTranscript}
              disabled={publishingTranscript || segments.length === 0}
              style={{ marginTop: 'auto', padding: '10px 16px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {publishingTranscript ? 'Publishing...' : '🚀 Publish Transcript'}
            </button>
          </div>

          {/* RIGHT Segment Editor */}
          <div style={{ flex: '2 1 320px', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {segments.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
                <p>No transcript segments available. Transcribing or processing lecture audio...</p>
              </div>
            ) : (
              segments.map((seg, idx) => (
                <div key={seg.id || idx}>
                  {seg.type === 'section-break' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--accent-indigo)' }} />
                      <div style={{ background: 'var(--accent-indigo-dim)', border: '1px solid var(--accent-indigo)', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'var(--text-accent)' }}>
                        {seg.text}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'var(--accent-indigo)' }} />
                      <button onClick={() => removeSegment(seg.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <div className="glass-card" style={{ padding: 16, border: seg.edited ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            {seg.startTime}
                          </span>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setEditingSpeakerId(editingSpeakerId === seg.id ? null : seg.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: SPEAKER_COLORS[seg.speaker] || 'var(--text-accent)', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              {seg.speakerLabel} ▾
                            </button>
                            {editingSpeakerId === seg.id && (
                              <div style={{ position: 'absolute', top: 24, left: 0, zIndex: 10, background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: 8, padding: 4, width: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                {SPEAKERS.map(spk => (
                                  <button
                                    key={spk}
                                    onClick={() => setSpeaker(seg.id, spk)}
                                    style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'transparent', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                                  >
                                    {SPEAKER_LABELS[spk] || spk}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-glass" onClick={() => startEdit(seg)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}>Edit</button>
                          <button className="btn-glass" onClick={() => setShowAddSection(seg.id)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}>+ Section</button>
                          <button onClick={() => removeSegment(seg.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', fontSize: 13 }}>🗑</button>
                        </div>
                      </div>

                      {editingId === seg.id ? (
                        <div style={{ marginTop: 8 }}>
                          <textarea
                            ref={textareaRef}
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={3}
                            className="input-field"
                            style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}
                          />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn-glass" onClick={() => setEditingId(null)} style={{ padding: '4px 12px', fontSize: 12 }}>Cancel</button>
                            <button className="btn-primary" onClick={() => saveEdit(seg.id)} style={{ padding: '4px 14px', fontSize: 12 }}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{seg.text}</div>
                      )}

                      {showAddSection === seg.id && (
                        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--accent-indigo)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-accent)' }}>Insert Section Divider After This Segment:</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="e.g. Part 2: Implementation Details"
                              value={newSectionTitle}
                              onChange={e => setNewSectionTitle(e.target.value)}
                              style={{ flex: 1, fontSize: 12 }}
                            />
                            <button className="btn-primary" onClick={() => addSectionBreak(seg.id)} style={{ padding: '4px 12px', fontSize: 12 }}>Add</button>
                            <button className="btn-glass" onClick={() => setShowAddSection(null)} style={{ padding: '4px 10px', fontSize: 12 }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHAPTERS & TOPICS */}
      {activeTab === 'chapters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Structured Curriculum Chapters</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Organize lecture sections, time boundaries, and key takeaway bullets displayed to students.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-glass" onClick={addChapter} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
                + Add Chapter
              </button>
              <button className="btn-primary" onClick={handleSaveChapters} disabled={savingChapters} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13 }}>
                {savingChapters ? 'Saving...' : '💾 Save & Publish Chapters'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chapters.map((ch, idx) => (
              <div key={idx} className="glass-card" style={{ padding: 18, border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-cyan)' }}>#{idx + 1}</span>
                  <input
                    type="text"
                    className="input-field"
                    value={ch.title}
                    onChange={e => {
                      const updated = [...chapters]
                      updated[idx].title = e.target.value
                      setChapters(updated)
                    }}
                    placeholder="Chapter Title"
                    style={{ flex: '2 1 200px', minWidth: 'min(100%, 180px)', fontWeight: 700, fontSize: 14 }}
                  />
                  <input
                    type="text"
                    className="input-field"
                    value={ch.timeRange}
                    onChange={e => {
                      const updated = [...chapters]
                      updated[idx].timeRange = e.target.value
                      setChapters(updated)
                    }}
                    placeholder="Time Range (e.g. 00:00 - 01:30)"
                    style={{ flex: '1 1 120px', minWidth: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                  />
                  <button
                    onClick={() => setChapters(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: 14 }}
                  >
                    🗑
                  </button>
                </div>

                <textarea
                  className="input-field"
                  rows={2}
                  value={ch.summary}
                  onChange={e => {
                    const updated = [...chapters]
                    updated[idx].summary = e.target.value
                    setChapters(updated)
                  }}
                  placeholder="Chapter summary and concepts covered..."
                  style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                />

                <input
                  type="text"
                  className="input-field"
                  value={ch.bulletPoints.join('; ')}
                  onChange={e => {
                    const updated = [...chapters]
                    updated[idx].bulletPoints = e.target.value.split(';').map(s => s.trim()).filter(Boolean)
                    setChapters(updated)
                  }}
                  placeholder="Bullet points separated by semicolon (e.g. Core concept; Architecture; Benchmarks)"
                  style={{ fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: QUIZ BUILDER */}
      {activeTab === 'quizzes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Student Quiz Questions</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Create customized multiple-choice questions for students in the Study Room.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-glass" onClick={addQuizQuestion} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
                + Add Question
              </button>
              <button className="btn-primary" onClick={handleSaveQuizzes} disabled={savingQuizzes} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13 }}>
                {savingQuizzes ? 'Saving...' : '💾 Save & Publish Quiz'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {quizzes.map((q, idx) => (
              <div key={idx} className="glass-card" style={{ padding: 18, border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-indigo)' }}>Q{idx + 1}:</span>
                  <input
                    type="text"
                    className="input-field"
                    value={q.question}
                    onChange={e => {
                      const updated = [...quizzes]
                      updated[idx].question = e.target.value
                      setQuizzes(updated)
                    }}
                    placeholder="Question prompt..."
                    style={{ flex: '1 1 240px', minWidth: 'min(100%, 200px)', fontWeight: 600, fontSize: 14 }}
                  />
                  <button
                    onClick={() => setQuizzes(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: 14 }}
                  >
                    🗑
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name={`correct-${idx}`}
                        checked={q.correct === optIdx}
                        onChange={() => {
                          const updated = [...quizzes]
                          updated[idx].correct = optIdx
                          setQuizzes(updated)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: q.correct === optIdx ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                        {String.fromCharCode(65 + optIdx)}:
                      </span>
                      <input
                        type="text"
                        className="input-field"
                        value={opt}
                        onChange={e => {
                          const updated = [...quizzes]
                          updated[idx].options[optIdx] = e.target.value
                          setQuizzes(updated)
                        }}
                        style={{ flex: 1, fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>

                <input
                  type="text"
                  className="input-field"
                  value={q.explanation}
                  onChange={e => {
                    const updated = [...quizzes]
                    updated[idx].explanation = e.target.value
                    setQuizzes(updated)
                  }}
                  placeholder="Answer explanation and lecture context..."
                  style={{ fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FLASHCARD BUILDER */}
      {activeTab === 'flashcards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Lecture Study Flashcards</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Build flashcards with active recall prompts and lecture timestamps.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-glass" onClick={addFlashcard} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
                + Add Card
              </button>
              <button className="btn-primary" onClick={handleSaveFlashcards} disabled={savingFlashcards} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13 }}>
                {savingFlashcards ? 'Saving...' : '💾 Save & Publish Flashcards'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
            {flashcards.map((fc, idx) => (
              <div key={idx} className="glass-card" style={{ padding: 16, border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={fc.timestamp}
                    onChange={e => {
                      const updated = [...flashcards]
                      updated[idx].timestamp = e.target.value
                      setFlashcards(updated)
                    }}
                    placeholder="00:00"
                    style={{ width: 80, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '3px 6px' }}
                  />
                  <button
                    onClick={() => setFlashcards(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: 14 }}
                  >
                    🗑
                  </button>
                </div>

                <textarea
                  className="input-field"
                  rows={2}
                  value={fc.front}
                  onChange={e => {
                    const updated = [...flashcards]
                    updated[idx].front = e.target.value
                    setFlashcards(updated)
                  }}
                  placeholder="Front Question / Concept Prompt"
                  style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
                />

                <textarea
                  className="input-field"
                  rows={3}
                  value={fc.back}
                  onChange={e => {
                    const updated = [...flashcards]
                    updated[idx].back = e.target.value
                    setFlashcards(updated)
                  }}
                  placeholder="Back Answer / Detailed Explanation"
                  style={{ width: '100%', fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STUDENT PREVIEW */}
      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(6,182,212,0.1)', border: '1px solid var(--accent-cyan)', borderRadius: 12, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>👁️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Live Student Preview Mode</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>This shows the exact study experience students will receive in the Study Room.</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => navigate(`/dashboard/learner/study/${selectedVideoId}`)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8 }}>
              Open in Study Room ↗
            </button>
          </div>

          {/* Chapters Preview */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--accent-cyan)' }}>📑 Published Chapters ({chapters.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chapters.map((ch, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{ch.title}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent-cyan)' }}>{ch.timeRange}</span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>{ch.summary}</p>
                  {ch.bulletPoints.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {ch.bulletPoints.map((pt, pti) => <li key={pti}>{pt}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quizzes Preview */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--accent-indigo)' }}>📝 Published Quiz Questions ({quizzes.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quizzes.map((q, i) => (
                <div key={i} style={{ padding: 14, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>Q{i + 1}: {q.question}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {q.options.map((opt, optI) => (
                      <div key={optI} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, background: optI === q.correct ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', border: optI === q.correct ? '1px solid var(--accent-emerald)' : '1px solid var(--border-glass)', color: optI === q.correct ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                        <b>{String.fromCharCode(65 + optI)}:</b> {opt} {optI === q.correct && '✓'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
