export interface WebSocketStatus {
  jobId: string
  videoId: string
  stage: string
  stageProgress: number
  overallProgress: number
  message: string
  elapsedSeconds: number
  estimatedSecondsRemaining: number
  gpuMemoryGB: number
  werAccuracy?: number
}

export class VideoWebSocket {
  private ws: WebSocket | null = null
  private videoId: string
  private onStatus: (status: WebSocketStatus) => void
  private onError: (error: Event) => void
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000

  constructor(
    videoId: string,
    onStatus: (status: WebSocketStatus) => void,
    onError: (error: Event) => void
  ) {
    this.videoId = videoId
    this.onStatus = onStatus
    this.onError = onError
  }

  connect() {
    try {
      let wsBase = import.meta.env?.VITE_WS_URL
      if (!wsBase && import.meta.env?.VITE_BACKEND_URL) {
        wsBase = import.meta.env.VITE_BACKEND_URL
          .replace(/^http:\/\//, 'ws://')
          .replace(/^https:\/\//, 'wss://')
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = wsBase
        ? `${wsBase.replace(/\/$/, '')}/ws/videos/${this.videoId}/status`
        : `${protocol}//${host}/ws/videos/${this.videoId}/status`

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {

        console.log(`WebSocket connected for video ${this.videoId}`)
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const status: WebSocketStatus = JSON.parse(event.data)
          this.onStatus(status)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.onError(error)
      }

      this.ws.onclose = () => {
        console.log(`WebSocket closed for video ${this.videoId}`)
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`Reconnecting... attempt ${this.reconnectAttempts}`)
          setTimeout(() => this.connect(), this.reconnectDelay)
        }
      }
    } catch (e) {
      console.error('Failed to create WebSocket:', e)
      this.onError(new Event('connection-failed'))
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnection
  }

  send(data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }
}
