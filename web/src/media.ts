/** Webcam helpers: frame capture, motion detection, recording. */

export function captureFrame(video: HTMLVideoElement, maxSide = 768, type = 'image/jpeg'): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(video.videoWidth * scale)
  c.height = Math.round(video.videoHeight * scale)
  c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no frame'))), type, 0.9))
}

/** Cheap pixel-difference motion detector (no AI model). Returns 0–1 changed fraction. */
export class MotionDetector {
  private prev: Uint8ClampedArray | null = null
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private w: number
  private h: number

  constructor(w = 64, h = 48) {
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
  }

  sample(video: HTMLVideoElement): number {
    if (!video.videoWidth) return 0
    this.ctx.drawImage(video, 0, 0, this.w, this.h)
    const data = this.ctx.getImageData(0, 0, this.w, this.h).data
    const gray = new Uint8ClampedArray(this.w * this.h)
    for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3
    let changed = 0
    if (this.prev) for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - this.prev[i]) > 25) changed++
    this.prev = gray
    return changed / gray.length
  }
}

export function pickMime(): string {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

/** Record a stream until stop() or maxMs. */
export function record(stream: MediaStream, maxMs = 15000) {
  const mime = pickMime()
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }))
  })
  rec.start(250)
  const timer = window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs)
  return {
    done,
    stop: () => {
      clearTimeout(timer)
      if (rec.state !== 'inactive') rec.stop()
    },
  }
}

/**
 * setInterval driven by a Web Worker: not throttled when the tab is in the background
 * (Chrome limits main-thread timers in hidden tabs to ~1/s).
 */
export function workerInterval(fn: () => void, ms: number): () => void {
  const src = `let id; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data) }`
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  const worker = new Worker(url)
  worker.onmessage = fn
  worker.postMessage(ms)
  return () => {
    worker.terminate()
    URL.revokeObjectURL(url)
  }
}
