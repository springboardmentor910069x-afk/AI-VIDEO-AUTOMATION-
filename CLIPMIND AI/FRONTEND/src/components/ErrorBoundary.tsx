import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public handleNavigateDashboard = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--bg-surface-elevated)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              margin: '0 auto 16px auto',
            }}>
              
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {this.props.fallbackTitle || 'Something went wrong loading this tab'}
            </h2>

            <div style={{
              fontSize: 12.5,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#f87171',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-glass)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              lineHeight: 1.5,
              wordBreak: 'break-word',
              textAlign: 'left',
            }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                className="btn-primary"
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Refresh View
              </button>
              <button
                onClick={this.handleNavigateDashboard}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
