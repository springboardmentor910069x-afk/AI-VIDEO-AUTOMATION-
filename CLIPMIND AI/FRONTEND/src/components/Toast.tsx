import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast-${++toastCounter}`
    setToasts(prev => [...prev, { id, type, message, duration }])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [entering, setEntering] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10)
    return () => clearTimeout(t)
  }, [])

  const colorMap: Record<ToastType, { bg: string; border: string; icon: string; shadow: string }> = {
    success: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.4)',
      icon: 'OK',
      shadow: '0 8px 24px rgba(16,185,129,0.15)',
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.4)',
      icon: 'Cancel',
      shadow: '0 8px 24px rgba(239,68,68,0.15)',
    },
    info: {
      bg: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.4)',
      icon: 'ℹ️',
      shadow: '0 8px 24px rgba(99,102,241,0.15)',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.4)',
      icon: '',
      shadow: '0 8px 24px rgba(245,158,11,0.15)',
    },
  }

  const c = colorMap[toast.type]

  return (
    <div
      onClick={onClose}
      style={{
        pointerEvents: 'auto',
        background: c.bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 280,
        maxWidth: 380,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: c.shadow,
        cursor: 'pointer',
        transform: entering ? 'translateX(20px)' : 'translateX(0)',
        opacity: entering ? 0 : 1,
        transition: 'transform 0.25s ease, opacity 0.25s ease',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{c.icon}</span>
      <div style={{
        flex: 1,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-primary)',
        lineHeight: 1.5,
      }}>
        {toast.message}
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0 }}>✕</span>
    </div>
  )
}
