import React, { useState, useRef, useEffect } from 'react'

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

export default function MindMapViewer({ data, loading, onSeek, onNodeClick }: MindMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  if (loading) {
    return (
      <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-secondary)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--accent-indigo)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Generating AI Concept Mind Map...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 42, opacity: 0.8 }}>🧠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>No Mind Map Available Yet</div>
        <div style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.5 }}>
          Once the video finishes AI transcription and summarization, your interactive concept tree will appear here automatically.
        </div>
      </div>
    )
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

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.mindmap-interactive-btn')) return
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
  const handleZoomIn = () => setZoom(z => Math.min(2.0, z + 0.15))
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.15))
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
    link.download = `${data.label.replace(/\s+/g, '_')}_mindmap.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Recursive tree render layout
  const renderTree = (node: MindMapNode, depth = 0, index = 0): React.ReactNode => {
    const isCollapsed = collapsedNodes.has(node.id)
    const isSelected = selectedNodeId === node.id
    const hasChildren = Boolean(node.children && node.children.length > 0)
    const isMatched = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase())

    const nodeColor = node.color || (node.type === 'root' ? '#6366F1' : '#06B6D4')

    return (
      <div
        key={node.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          position: 'relative',
          margin: depth === 0 ? 0 : '8px 0',
        }}
      >
        {/* Node Card */}
        <div
          onClick={() => {
            setSelectedNodeId(node.id)
            if (node.timestamp_sec !== undefined && onSeek) {
              onSeek(node.timestamp_sec)
            }
            if (onNodeClick) onNodeClick(node)
          }}
          className="mindmap-interactive-btn"
          style={{
            padding: depth === 0 ? '16px 24px' : '10px 16px',
            borderRadius: depth === 0 ? 16 : 12,
            background: isMatched
              ? 'rgba(245, 158, 11, 0.25)'
              : depth === 0
              ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(6,182,212,0.2))'
              : isSelected
              ? 'rgba(99,102,241,0.2)'
              : 'var(--bg-surface)',
            border: `2px solid ${isMatched ? 'var(--accent-amber)' : isSelected ? 'var(--accent-cyan)' : depth === 0 ? 'var(--accent-indigo)' : nodeColor + '66'}`,
            boxShadow: depth === 0
              ? '0 0 25px var(--accent-indigo-glow)'
              : isSelected
              ? '0 0 20px var(--accent-cyan-glow)'
              : '0 4px 14px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            minWidth: depth === 0 ? 220 : 160,
            maxWidth: depth === 0 ? 320 : 260,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: depth === 0 ? 16 : 12 }}>
              {depth === 0 ? '🧠' : node.type === 'chapter' ? '📑' : node.type === 'moment' ? '📍' : '💡'}
            </span>
            {node.timestamp && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (node.timestamp_sec !== undefined && onSeek) {
                    onSeek(node.timestamp_sec)
                  }
                }}
                title="Click to jump video player here"
                style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span>⏱</span> {node.timestamp}
              </span>
            )}
            {hasChildren && (
              <button
                onClick={(e) => toggleCollapse(node.id, e)}
                style={{
                  width: 20, height: 20, borderRadius: 6,
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-glass)',
                  color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: 0,
                }}
              >
                {isCollapsed ? '+' : '−'}
              </button>
            )}
          </div>

          <div style={{
            fontSize: depth === 0 ? 14 : 12,
            fontWeight: depth === 0 ? 800 : 600,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}>
            {node.label}
          </div>

          {node.summary && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.3, maxHeight: 36, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.summary}
            </div>
          )}
        </div>

        {/* Children Sub-Tree */}
        {hasChildren && !isCollapsed && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingLeft: 24,
            borderLeft: `2px dashed ${nodeColor + '55'}`,
            position: 'relative',
          }}>
            {node.children!.map((child, cIdx) => renderTree(child, depth + 1, cIdx))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 520,
        position: 'relative',
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.06) 0%, rgba(10,11,14,0.95) 100%)',
        borderRadius: 16,
        border: '1px solid var(--border-glass)',
        overflow: 'hidden',
      }}
    >
      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          background: 'rgba(17, 24, 39, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-glass)',
          padding: '8px 14px',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Interactive AI Mind Map
          </span>
          <span style={{ fontSize: 11, color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
            Click nodes to seek video
          </span>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 180 }}>
          <input
            type="text"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ height: 32, paddingLeft: 28, fontSize: 12, borderRadius: 8, background: 'var(--bg-surface)' }}
          />
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, opacity: 0.6 }}>🔍</span>
        </div>

        {/* Zoom & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleZoomIn}
            className="btn-glass"
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="btn-glass"
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="btn-glass"
            style={{ padding: '4px 10px', height: 32, borderRadius: 8, fontSize: 11, fontWeight: 600 }}
            title="Reset Zoom & Pan"
          >
            Fit
          </button>
          <button
            onClick={handleExportSVG}
            className="btn-primary"
            style={{ padding: '4px 12px', height: 32, borderRadius: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            title="Export Mind Map"
          >
            <span>📥</span> Export SVG
          </button>
        </div>
      </div>

      {/* Pannable Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '80px 40px 40px',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            display: 'inline-flex',
          }}
        >
          {renderTree(data)}
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span>💡 Drag canvas to pan • Scroll / buttons to zoom</span>
        <span>Click any timestamp chip (⏱) to jump the video player</span>
      </div>
    </div>
  )
}
