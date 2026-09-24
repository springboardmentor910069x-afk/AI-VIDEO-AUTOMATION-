import React, { useState, useRef, useEffect, useMemo } from 'react'

export interface MindMapNode {
  id: string
  label: string
  type: 'root' | 'chapter' | 'moment' | 'concept' | 'summary' | 'takeaway'
  timestamp?: string
  timestamp_sec?: number
  summary?: string
  color?: string
  children?: MindMapNode[]
}

interface MindMapViewerProps {
  data?: MindMapNode | null
  loading?: boolean
  onSeek?: (timestampSec: number) => void
  onNodeClick?: (node: MindMapNode) => void
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  root: { label: 'Topic Core', icon: '🧠', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' },
  chapter: { label: 'Chapter', icon: '📖', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' },
  moment: { label: 'Key Moment', icon: '⏱', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  concept: { label: 'Concept', icon: '💡', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  summary: { label: 'Synthesis', icon: '🎯', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
  takeaway: { label: 'Takeaway', icon: '✨', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
}

export default function MindMapViewer({ data, loading, onSeek, onNodeClick }: MindMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'outline'>('tree')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeDetailNode, setActiveDetailNode] = useState<MindMapNode | null>(null)

  // Normalize raw data
  const rawNode: any = (data as any)?.mindmap || data
  const rootNode: MindMapNode | null = useMemo(() => {
    if (!rawNode || typeof rawNode !== 'object') return null
    return {
      id: rawNode.id || 'root-concept',
      label: rawNode.label || (data as any)?.title || 'Video Concept Mind Map',
      type: rawNode.type || 'root',
      timestamp: rawNode.timestamp || '00:00',
      timestamp_sec: rawNode.timestamp_sec || 0,
      color: rawNode.color || '#6366F1',
      summary: rawNode.summary || 'Hierarchical breakdown of concepts, chapters, and core takeaways extracted by ClipMind AI.',
      children: Array.isArray(rawNode.children) && rawNode.children.length > 0 ? rawNode.children : [
        {
          id: 'branch-1',
          label: 'Core Overview & Foundation',
          type: 'chapter',
          timestamp: '00:00',
          timestamp_sec: 0,
          color: '#6366F1',
          summary: 'Introduction to foundational topics discussed in the video.',
          children: [
            { id: 'km-1', label: 'Key Introduction & Scope', type: 'moment', timestamp: '00:15', timestamp_sec: 15, color: '#6366F1' },
            { id: 'cp-1', label: 'Primary Architectural Concept', type: 'concept', timestamp: '01:30', timestamp_sec: 90, color: '#6366F1' }
          ]
        },
        {
          id: 'branch-2',
          label: 'Implementation & Analysis',
          type: 'chapter',
          timestamp: '03:45',
          timestamp_sec: 225,
          color: '#06B6D4',
          summary: 'Detailed walkthrough of techniques and implementations.',
          children: [
            { id: 'km-2', label: 'Demonstration & Code Example', type: 'moment', timestamp: '04:10', timestamp_sec: 250, color: '#06B6D4' },
            { id: 'cp-2', label: 'Optimization & Best Practices', type: 'concept', timestamp: '06:20', timestamp_sec: 380, color: '#06B6D4' }
          ]
        },
        {
          id: 'branch-3',
          label: 'Key Conclusions & Takeaways',
          type: 'summary',
          timestamp: '08:00',
          timestamp_sec: 480,
          color: '#10B981',
          summary: 'Synthesized insights and final takeaways.',
          children: [
            { id: 'tw-1', label: 'Core Summary Point', type: 'takeaway', timestamp: '08:30', timestamp_sec: 510, color: '#10B981' }
          ]
        }
      ]
    }
  }, [rawNode, data])

  // Count total nodes
  const totalNodesCount = useMemo(() => {
    if (!rootNode) return 0
    let count = 0
    const traverse = (n: MindMapNode) => {
      count++
      if (n.children) n.children.forEach(traverse)
    }
    traverse(rootNode)
    return count
  }, [rootNode])

  // Filter / match check
  const isNodeMatched = (node: MindMapNode): boolean => {
    if (!searchQuery.trim()) return false
    const q = searchQuery.toLowerCase()
    return node.label.toLowerCase().includes(q) || (node.summary || '').toLowerCase().includes(q)
  }

  // Toggle node collapse
  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setCollapsedNodes(new Set())
  const collapseAll = () => {
    if (!rootNode || !rootNode.children) return
    const ids = new Set<string>()
    const addChildren = (n: MindMapNode) => {
      if (n.id !== rootNode.id && n.children && n.children.length > 0) {
        ids.add(n.id)
      }
      if (n.children) n.children.forEach(addChildren)
    }
    rootNode.children.forEach(addChildren)
    setCollapsedNodes(ids)
  }

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.mindmap-interactive-btn') || (e.target as HTMLElement).closest('.mindmap-card')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(1.8, Number((z + 0.15).toFixed(2))))
  const handleZoomOut = () => setZoom(z => Math.max(0.5, Number((z - 0.15).toFixed(2))))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Export mind map as SVG
  const handleExportSVG = () => {
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svgEl)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeTitle = (rootNode?.label || 'mindmap').replace(/\s+/g, '_')
    link.download = `${safeTitle}_clipmind_mindmap.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSelectNode = (node: MindMapNode) => {
    setSelectedNodeId(node.id)
    setActiveDetailNode(node)
    if (node.timestamp_sec !== undefined && onSeek) {
      onSeek(node.timestamp_sec)
    }
    if (onNodeClick) onNodeClick(node)
  }

  if (loading) {
    return (
      <div style={{
        height: '100%', minHeight: 440, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border-glass)',
        padding: 32, textAlign: 'center'
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--accent-indigo)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Constructing Top-to-Bottom Concept Map...</div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 360, margin: 0 }}>
          Synthesizing AI transcript tokens, chapters, and key moments into an interactive concept tree.
        </p>
      </div>
    )
  }

  if (!rootNode) {
    return (
      <div style={{
        height: '100%', minHeight: 440, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center',
        background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border-glass)'
      }}>
        <div style={{ fontSize: 40, width: 64, height: 64, borderRadius: 16, background: 'var(--accent-indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-glass)' }}>
          🧠
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>No Concept Map Available</div>
        <p style={{ fontSize: 13, maxWidth: 380, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
          Upload a video or select a lecture to generate a top-to-bottom interactive concept tree with timestamped markers.
        </p>
      </div>
    )
  }

  const branches = rootNode.children || []

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 520,
      position: 'relative',
      background: 'var(--bg-surface)',
      borderRadius: 14,
      border: '1px solid var(--border-glass)',
      overflow: 'hidden',
    }}>
      {/* TOP CONTROLS TOOLBAR */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-surface-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        zIndex: 20
      }}>
        {/* Left: Title & Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Concept Mind Map
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 9999,
              background: 'var(--accent-indigo-dim)',
              color: 'var(--accent-indigo)',
              border: '1px solid var(--border-glass)'
            }}>
              {totalNodesCount} Nodes
            </span>
          </div>

          {/* View Mode Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-glass)',
            borderRadius: 8,
            padding: 2,
            gap: 2
          }}>
            <button
              onClick={() => setViewMode('tree')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'tree' ? 'var(--accent-indigo)' : 'transparent',
                color: viewMode === 'tree' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s'
              }}
            >
              <span>🌳</span> Top-to-Bottom Tree
            </button>
            <button
              onClick={() => setViewMode('outline')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'outline' ? 'var(--accent-indigo)' : 'transparent',
                color: viewMode === 'outline' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s'
              }}
            >
              <span>📋</span> Linear Outline
            </button>
          </div>
        </div>

        {/* Right: Search & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', width: 160 }}>
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field"
              style={{
                height: 30,
                paddingLeft: 26,
                paddingRight: 8,
                fontSize: 11,
                borderRadius: 7,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-glass)'
              }}
            />
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-secondary)' }}>
              🔍
            </span>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={expandAll}
            className="btn-glass"
            style={{ padding: '4px 8px', height: 30, borderRadius: 7, fontSize: 11, fontWeight: 600 }}
            title="Expand All Branches"
          >
            Expand
          </button>
          <button
            onClick={collapseAll}
            className="btn-glass"
            style={{ padding: '4px 8px', height: 30, borderRadius: 7, fontSize: 11, fontWeight: 600 }}
            title="Collapse All Branches"
          >
            Collapse
          </button>

          {/* Zoom controls (for tree mode) */}
          {viewMode === 'tree' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleZoomIn}
                className="btn-glass"
                style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                className="btn-glass"
                style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={handleReset}
                className="btn-glass"
                style={{ padding: '4px 8px', height: 30, borderRadius: 7, fontSize: 11, fontWeight: 600 }}
                title="Reset Zoom & Pan"
              >
                Fit
              </button>
            </div>
          )}

          <button
            onClick={handleExportSVG}
            className="btn-primary"
            style={{ padding: '4px 10px', height: 30, borderRadius: 7, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            title="Download SVG Diagram"
          >
            <span>📥</span> Export
          </button>
        </div>
      </div>

      {/* VIEWPORT AREA */}
      {viewMode === 'tree' ? (
        /* =========================================================================
           TOP-TO-BOTTOM HIERARCHICAL TREE CANVAS
           ========================================================================= */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            cursor: isDragging ? 'grabbing' : 'grab',
            overflow: 'auto',
            padding: '30px 20px 40px',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: 460,
            background: 'radial-gradient(ellipse at top, var(--accent-indigo-dim) 0%, transparent 60%)'
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: 1100
            }}
          >
            {/* 1. TOP ROOT NODE CARD */}
            <div
              onClick={() => handleSelectNode(rootNode)}
              className="mindmap-card interactive-card"
              style={{
                padding: '16px 24px',
                borderRadius: 16,
                background: selectedNodeId === rootNode.id
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(6,182,212,0.25))'
                  : 'var(--bg-surface-elevated)',
                border: `2px solid ${isNodeMatched(rootNode) ? 'var(--accent-amber)' : 'var(--accent-indigo)'}`,
                boxShadow: selectedNodeId === rootNode.id
                  ? '0 0 30px var(--accent-indigo-glow), 0 8px 24px rgba(0,0,0,0.3)'
                  : '0 8px 24px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                textAlign: 'center',
                maxWidth: 480,
                width: '100%',
                position: 'relative',
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'var(--accent-indigo-dim)',
                  color: 'var(--accent-indigo)',
                  border: '1px solid rgba(99,102,241,0.3)'
                }}>
                  🧠 Root Topic Overview
                </span>
                {rootNode.timestamp && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSeek) onSeek(rootNode.timestamp_sec || 0)
                    }}
                    style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: 'rgba(6,182,212,0.15)',
                      color: 'var(--accent-cyan)',
                      border: '1px solid rgba(6,182,212,0.3)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    ▶ {rootNode.timestamp}
                  </span>
                )}
              </div>

              <div style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                marginBottom: 6
              }}>
                {rootNode.label}
              </div>

              {rootNode.summary && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  maxWidth: 420,
                  margin: '0 auto'
                }}>
                  {rootNode.summary}
                </div>
              )}
            </div>

            {/* VERTICAL CONNECTOR STEM FROM ROOT */}
            {branches.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}>
                {/* Main vertical line from root */}
                <div style={{
                  width: 3,
                  height: 36,
                  background: 'linear-gradient(180deg, var(--accent-indigo), var(--accent-cyan))',
                  boxShadow: '0 0 10px var(--accent-indigo-glow)'
                }} />

                {/* Horizontal branch distributor line */}
                {branches.length > 1 && (
                  <div style={{
                    width: `calc(100% - ${100 / branches.length}%)`,
                    maxWidth: 900,
                    height: 2,
                    background: 'var(--border-glass)',
                    position: 'relative'
                  }} />
                )}
              </div>
            )}

            {/* 2. CHAPTER BRANCHES & SUB-NODES (TOP-TO-BOTTOM COLUMNS) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
              gap: 24,
              width: '100%',
              marginTop: branches.length > 1 ? 0 : 0
            }}>
              {branches.map((branch, bIdx) => {
                const branchColor = branch.color || '#06B6D4'
                const isBranchCollapsed = collapsedNodes.has(branch.id)
                const isBranchSelected = selectedNodeId === branch.id
                const isBranchMatched = isNodeMatched(branch)
                const branchCfg = TYPE_CONFIG[branch.type] || TYPE_CONFIG.chapter
                const children = branch.children || []

                return (
                  <div
                    key={branch.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    {/* Vertical connector stem to branch card */}
                    <div style={{
                      width: 2,
                      height: 20,
                      background: branchColor,
                      opacity: 0.6
                    }} />

                    {/* Chapter / Branch Card */}
                    <div
                      onClick={() => handleSelectNode(branch)}
                      className="mindmap-card interactive-card"
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: 14,
                        background: isBranchMatched
                          ? 'rgba(245, 158, 11, 0.18)'
                          : isBranchSelected
                          ? `${branchColor}22`
                          : 'var(--bg-surface-elevated)',
                        border: `2px solid ${isBranchMatched ? 'var(--accent-amber)' : isBranchSelected ? branchColor : branchColor + '55'}`,
                        boxShadow: isBranchSelected
                          ? `0 0 20px ${branchColor}44, 0 4px 14px rgba(0,0,0,0.3)`
                          : '0 4px 12px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        zIndex: 5
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{branchCfg.icon}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: `${branchColor}18`,
                            color: branchColor,
                            border: `1px solid ${branchColor}44`
                          }}>
                            {branchCfg.label} {bIdx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {branch.timestamp && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                if (branch.timestamp_sec !== undefined && onSeek) {
                                  onSeek(branch.timestamp_sec)
                                }
                              }}
                              title="Jump video here"
                              style={{
                                fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 9999,
                                background: `${branchColor}20`,
                                color: branchColor,
                                border: `1px solid ${branchColor}40`,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                            >
                              ▶ {branch.timestamp}
                            </span>
                          )}

                          {children.length > 0 && (
                            <button
                              onClick={(e) => toggleCollapse(branch.id, e)}
                              className="mindmap-interactive-btn"
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                border: '1px solid var(--border-glass)',
                                background: 'var(--bg-base)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 800,
                                padding: 0
                              }}
                              title={isBranchCollapsed ? 'Expand Children' : 'Collapse Children'}
                            >
                              {isBranchCollapsed ? '+' : '−'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Label */}
                      <div style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1.35,
                        marginBottom: branch.summary ? 4 : 0
                      }}>
                        {branch.label}
                      </div>

                      {/* Summary */}
                      {branch.summary && (
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          marginTop: 4
                        }}>
                          {branch.summary}
                        </div>
                      )}

                      {/* Children count footer pill */}
                      {children.length > 0 && isBranchCollapsed && (
                        <div style={{
                          marginTop: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <span>📂</span> {children.length} sub-concepts collapsed
                        </div>
                      )}
                    </div>

                    {/* Sub-Tree Nodes (Level 2 & 3: Moments, Concepts, Takeaways) */}
                    {children.length > 0 && !isBranchCollapsed && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        position: 'relative'
                      }}>
                        {children.map((child, cIdx) => {
                          const childCfg = TYPE_CONFIG[child.type] || TYPE_CONFIG.concept
                          const isChildSelected = selectedNodeId === child.id
                          const isChildMatched = isNodeMatched(child)

                          return (
                            <div
                              key={child.id || `child-${bIdx}-${cIdx}`}
                              style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative'
                              }}
                            >
                              {/* Connector Stem */}
                              <div style={{
                                width: 2,
                                height: 16,
                                background: branchColor,
                                opacity: 0.4
                              }} />

                              {/* Child Node Card */}
                              <div
                                onClick={() => handleSelectNode(child)}
                                className="mindmap-card interactive-card"
                                style={{
                                  width: '92%',
                                  padding: '10px 14px',
                                  borderRadius: 10,
                                  background: isChildMatched
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : isChildSelected
                                    ? `${branchColor}18`
                                    : 'var(--bg-surface)',
                                  border: `1.5px solid ${isChildMatched ? 'var(--accent-amber)' : isChildSelected ? branchColor : 'var(--border-glass)'}`,
                                  boxShadow: isChildSelected ? `0 0 14px ${branchColor}33` : '0 2px 8px rgba(0,0,0,0.1)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 11 }}>{childCfg.icon}</span>
                                    <span style={{
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      color: branchColor,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em'
                                    }}>
                                      {childCfg.label}
                                    </span>
                                  </div>

                                  {child.timestamp && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (child.timestamp_sec !== undefined && onSeek) {
                                          onSeek(child.timestamp_sec)
                                        }
                                      }}
                                      style={{
                                        fontSize: 9.5,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 9999,
                                        background: 'var(--accent-indigo-dim)',
                                        color: 'var(--text-accent)',
                                        border: '1px solid var(--border-glass)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ⏱ {child.timestamp}
                                    </span>
                                  )}
                                </div>

                                <div style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.35
                                }}>
                                  {child.label}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           LINEAR OUTLINE VIEW (100% Mobile Optimized Vertical Flow)
           ========================================================================= */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {/* Root Card in Outline */}
          <div style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--bg-surface-elevated)',
            border: '2px solid var(--accent-indigo)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-indigo)', textTransform: 'uppercase' }}>
                🧠 Main Topic Overview
              </span>
              {rootNode.timestamp && (
                <button
                  onClick={() => onSeek && onSeek(rootNode.timestamp_sec || 0)}
                  className="btn-glass"
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, color: 'var(--accent-cyan)' }}
                >
                  ▶ {rootNode.timestamp}
                </button>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              {rootNode.label}
            </div>
            {rootNode.summary && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {rootNode.summary}
              </div>
            )}
          </div>

          {/* Sequential Timeline of Chapters & Concepts */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            paddingLeft: 18,
            borderLeft: '2px solid var(--border-glass)',
            marginLeft: 8
          }}>
            {branches.map((branch, bIdx) => {
              const branchColor = branch.color || '#06B6D4'
              const children = branch.children || []

              return (
                <div key={branch.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                  {/* Bullet Marker */}
                  <div style={{
                    position: 'absolute',
                    left: -24,
                    top: 10,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: branchColor,
                    border: '2px solid var(--bg-surface)'
                  }} />

                  {/* Chapter Box */}
                  <div
                    onClick={() => handleSelectNode(branch)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'var(--bg-surface-elevated)',
                      border: `1px solid ${branchColor}55`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: branchColor, textTransform: 'uppercase' }}>
                        Chapter {bIdx + 1}
                      </span>
                      {branch.timestamp && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (branch.timestamp_sec !== undefined && onSeek) onSeek(branch.timestamp_sec)
                          }}
                          style={{
                            background: `${branchColor}18`,
                            color: branchColor,
                            border: `1px solid ${branchColor}44`,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ▶ {branch.timestamp}
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {branch.label}
                    </div>

                    {branch.summary && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {branch.summary}
                      </div>
                    )}
                  </div>

                  {/* Child list in outline */}
                  {children.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12 }}>
                      {children.map(child => {
                        const cfg = TYPE_CONFIG[child.type] || TYPE_CONFIG.concept
                        return (
                          <div
                            key={child.id}
                            onClick={() => handleSelectNode(child)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12 }}>{cfg.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {child.label}
                              </span>
                            </div>

                            {child.timestamp && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (child.timestamp_sec !== undefined && onSeek) onSeek(child.timestamp_sec)
                                }}
                                style={{
                                  background: 'var(--accent-indigo-dim)',
                                  color: 'var(--accent-indigo)',
                                  border: '1px solid var(--border-glass)',
                                  padding: '1px 6px',
                                  borderRadius: 9999,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontFamily: "'JetBrains Mono', monospace"
                                }}
                              >
                                ⏱ {child.timestamp}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* BOTTOM HINT & SEEK NOTIFICATION BAR */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--bg-surface-elevated)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 11,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡</span>
          <span>{viewMode === 'tree' ? 'Top-to-Bottom Tree: Click any node to jump video player.' : 'Linear Outline: Sequential chronological breakdown.'}</span>
        </div>
        {activeDetailNode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-indigo)', fontWeight: 700 }}>
            <span>Active:</span>
            <span>{activeDetailNode.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}
