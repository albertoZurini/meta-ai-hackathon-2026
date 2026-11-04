import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { send, streamUrl, useBus } from '../bus'
import type { BusEvent } from '../bus'
import type { ShowTell } from '../duck/types'
import { captureFrame, MotionDetector, workerInterval } from '../media'

type Detection = { prompt: string; score: number; area: number; box: [number, number, number, number]; mask: string | null }
type Presence = { present: boolean; holding: boolean; detections: Detection[]; ms: number; face_ms: number }
type LogLine = { t: number; text: string; kind?: 'ok' | 'warn' | 'err' }

const COLORS: Record<string, string> = { face: '#4ade80', hand: '#ec4899', 'object held in hand': '#ec4899' }
const MOTION_THRESHOLD = 0.03
const SHOWTELL_DELAY = 2100 // matches the tank's 3-2-1 countdown

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Mac-side page: owns the webcam, runs presence/Show & Tell detection, records replies, shows debug info. */
export default function Camera() {
  const video = useRef<HTMLVideoElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const cooldown = useRef(0)
  const busy = useRef(false)
  const tankPhase = useRef('?') // '?' = no tank connected

  const [camera, setCamera] = useState('starting…')
  const [mode, setMode] = useState('?')
  const [phase, setPhase] = useState('?')
  const [motion, setMotion] = useState(0)
  const [auto, setAuto] = useState(true)
  const [samState, setSamState] = useState('idle')
  const [last, setLast] = useState<Presence | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [st, setSt] = useState<{ frame: string; item?: ShowTell; error?: string } | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [, tick] = useState(0)

  const addLog = useCallback((text: string, kind?: LogLine['kind']) => {
    setLog((l) => [{ t: Date.now(), text, kind }, ...l].slice(0, 40))
  }, [])

  // ---------- webcam ----------
  useEffect(() => {
    let cancelled = false
    api.health().then((h) => setMode(h.mode)).catch(() => setMode('backend down'))
    ;(async () => {
      try {
        let s: MediaStream
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
        } catch {
          s = await navigator.mediaDevices.getUserMedia({ video: true })
        }
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        video.current!.srcObject = s
        await video.current!.play()
        setCamera(s.getAudioTracks().length ? 'on · mic on' : 'on · no mic')
      } catch (e) {
        setCamera(`off: ${(e as Error).message}`)
      }
    })()
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Re-render every second for timers.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ---------- debug overlay ----------
  useEffect(() => {
    const c = overlay.current
    const v = video.current
    if (!c || !v) return
    const ctx = c.getContext('2d')!
    c.width = v.videoWidth || 1280
    c.height = v.videoHeight || 720
    ctx.clearRect(0, 0, c.width, c.height)
    if (!last) return
    let cancelled = false
    for (const d of last.detections) {
      const color = COLORS[d.prompt] ?? '#facc15'
      const img = new Image()
      if (d.mask) img.onload = () => {
        if (cancelled) return
        const tmp = document.createElement('canvas')
        tmp.width = c.width
        tmp.height = c.height
        const t = tmp.getContext('2d')!
        t.drawImage(img, 0, 0, c.width, c.height)
        t.globalCompositeOperation = 'source-in'
        t.fillStyle = color
        t.fillRect(0, 0, c.width, c.height)
        ctx.globalAlpha = 0.35
        ctx.drawImage(tmp, 0, 0)
        ctx.globalAlpha = 1
      }
      if (d.mask) img.src = d.mask
      const [x0, y0, x1, y1] = d.box
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.strokeRect(x0 * c.width, y0 * c.height, (x1 - x0) * c.width, (y1 - y0) * c.height)
      // Labels are drawn un-mirrored (the canvas itself is mirrored with the video).
      const label = `${d.prompt} ${(d.score * 100).toFixed(0)}%`
      ctx.save()
      ctx.scale(-1, 1)
      ctx.font = 'bold 26px ui-monospace, Menlo, monospace'
      const w = ctx.measureText(label).width + 16
      const lx = Math.min(Math.max(-x1 * c.width, -c.width), -w)
      const ly = Math.max(y0 * c.height - 34, 0)
      ctx.fillStyle = color
      ctx.fillRect(lx, ly, w, 32)
      ctx.fillStyle = '#0b1020'
      ctx.fillText(label, lx + 8, ly + 24)
      ctx.restore()
    }
    return () => {
      cancelled = true
    }
  }, [last])

  // ---------- Show & Tell ----------
  const showAndTell = useCallback(async () => {
    if (tankPhase.current !== 'idle' || !video.current?.videoWidth) {
      addLog(`show&tell ignored (tank phase: ${tankPhase.current})`, 'warn')
      return
    }
    busy.current = true
    addLog('show&tell: telling tank to count down', 'ok')
    send('tank', { type: 'showtell-start' })
    await sleep(SHOWTELL_DELAY)
    const frame = await captureFrame(video.current)
    setSt({ frame: URL.createObjectURL(frame) })
    setSamState('show&tell: SAM cutout + gag…')
    const t = Date.now()
    try {
      const item = await api.showtell(frame)
      setSt((s) => s && { ...s, item })
      addLog(`show&tell: "${item.label}" cut out in ${Date.now() - t} ms`, 'ok')
      send('tank', { type: 'showtell-result', item })
    } catch (e) {
      const error = (e as Error).message
      setSt((s) => s && { ...s, error })
      addLog(`show&tell failed: ${error}`, 'err')
      send('tank', { type: 'showtell-error', error })
    } finally {
      setSamState('idle')
      cooldown.current = Date.now() + 8000
      busy.current = false
    }
  }, [addLog])

  // ---------- presence loop: motion → local SAM ----------
  useEffect(() => {
    const md = new MotionDetector()
    const stop = workerInterval(async () => {
      const v = video.current
      if (!v || !v.videoWidth) return
      const m = md.sample(v)
      setMotion(m)
      // Detection runs even without a tank (debug overlay); it only triggers the tank when one is idle.
      const tankIdle = tankPhase.current === 'idle'
      const tankBusy = tankPhase.current !== 'idle' && tankPhase.current !== '?'
      if (!auto || busy.current || tankBusy || Date.now() < cooldown.current || m < MOTION_THRESHOLD) return
      busy.current = true
      setSamState('presence: SAM 3.1 face + hand…')
      try {
        const res = (await api.presence(await captureFrame(v, 512))) as Presence
        setLast(res)
        const scores = res.detections.map((d) => `${d.prompt} ${(d.score * 100).toFixed(0)}%`).join(', ') || 'nothing'
        if (!tankIdle) {
          addLog(`${res.ms} ms: ${scores}${res.holding ? ' → object ✓' : res.present ? ' → face ✓' : ''} (no tank connected, not triggering)`)
          cooldown.current = Date.now() + 1500
          return
        }
        if (res.holding) {
          addLog(`${res.ms} ms: ${scores} → object held up → Show & Tell`, 'ok')
          busy.current = false
          await showAndTell()
          return
        }
        if (res.present) {
          addLog(`${res.ms} ms: ${scores} → face → wake tank`, 'ok')
          send('tank', { type: 'wake' })
          cooldown.current = Date.now() + 6000
        } else {
          addLog(`face check ${res.face_ms} ms → no face`)
          cooldown.current = Date.now() + 1500
        }
      } catch (e) {
        addLog(`presence error: ${(e as Error).message}`, 'err')
        cooldown.current = Date.now() + 5000
      } finally {
        busy.current = false
        setSamState('idle')
      }
    }, 400)
    return stop
  }, [auto, addLog, showAndTell])

  // ---------- live stream to the tank (JPEG frames over WebSocket) + photo replies ----------
  useEffect(() => {
    if (!streaming) return
    const ws = new WebSocket(streamUrl('camera'))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    let inFlight = 0
    // ~30 fps, 480 px wide JPEGs; at most 2 frames encoding at once so it never backs up.
    const stop = workerInterval(() => {
      const v = video.current
      if (ws.readyState !== WebSocket.OPEN || inFlight >= 2 || !v?.videoWidth) return
      if (ws.bufferedAmount > 512 * 1024) return // network can't keep up: skip a frame
      inFlight++
      canvas.width = 480
      canvas.height = Math.round((v.videoHeight * 480) / v.videoWidth)
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => {
        if (b && ws.readyState === WebSocket.OPEN) ws.send(b)
        inFlight--
      }, 'image/jpeg', 0.65)
    }, 33)
    addLog('streaming camera to tank', 'ok')
    return () => {
      stop()
      ws.close()
    }
  }, [streaming, addLog])

  // Several tank windows may be open; answer each message only once.
  const snapped = useRef(new Map<string, Promise<string | undefined>>())

  const snap = useCallback(async (messageId: string, name: string) => {
    const prev = snapped.current.get(messageId)
    if (prev && messageId !== 'demo') {
      addLog(`duplicate snap request for ${name} ignored (another tank asked)`, 'warn')
      const photo = await prev
      send('tank', { type: 'snap-done', ok: !!photo, photo })
      return
    }
    const v = video.current
    if (!v?.videoWidth) {
      send('tank', { type: 'snap-done', ok: false, error: 'no camera' })
      return
    }
    let resolve: (p: string | undefined) => void = () => {}
    snapped.current.set(messageId, new Promise((r) => (resolve = r)))
    const photo = await captureFrame(v, 1280)
    addLog(`📸 snapped reply for ${name} (${(photo.size / 1024).toFixed(0)} KB)`, 'ok')
    if (messageId === 'demo') {
      // Demo: no upload; send a data URL (blob URLs don't work across pages).
      const dataUrl = await new Promise<string>((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result as string)
        fr.readAsDataURL(photo)
      })
      send('tank', { type: 'snap-done', ok: true, photo: dataUrl })
      return
    }
    try {
      const r = await api.replyPhoto(messageId, photo)
      addLog('reply sent ✓', 'ok')
      resolve(r.photo)
      send('tank', { type: 'snap-done', ok: true, photo: r.photo })
    } catch (e) {
      resolve(undefined)
      snapped.current.delete(messageId)
      addLog(`reply failed: ${(e as Error).message}`, 'err')
      send('tank', { type: 'snap-done', ok: false, error: (e as Error).message })
    }
  }, [addLog])

  const tankOnline = useBus('camera', (e: BusEvent) => {
    switch (e.type) {
      case 'peer':
        addLog(`tank ${e.online ? 'connected' : 'disconnected'}`, e.online ? 'ok' : 'warn')
        if (!e.online) {
          tankPhase.current = '?'
          setPhase('?')
        }
        break
      case 'phase':
        tankPhase.current = e.phase
        setPhase(e.phase)
        break
      case 'stream': setStreaming(e.on); break
      case 'snap': snap(e.messageId, e.name); break
    }
  })

  // ---------- keyboard: forward to tank ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'a') return setAuto((x) => !x)
      if (e.key === 's') return void showAndTell()
      if ([' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        send('tank', { type: 'key', key: e.key })
        addLog(`key "${e.key === ' ' ? 'space' : e.key}" → tank`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addLog, showAndTell])


  return (
    <div className="camera-page">
      <div className="cam-view">
        <div className="cam-mirror">
          <video ref={video} muted playsInline />
          <canvas ref={overlay} />
        </div>
        {streaming && <div className="cam-rec"><span className="dot" /> LIVE on the tank · smile!</div>}
        {samState !== 'idle' && <div className="cam-sam">🧠 {samState}</div>}
      </div>

      <aside className="cam-panel">
        <h2>🦆 Duck camera</h2>
        <dl>
          <dt>Tank</dt><dd className={tankOnline ? 'ok' : 'err'}>{tankOnline ? 'connected' : 'not connected'}</dd>
          <dt>Tank phase</dt><dd>{phase}</dd>
          <dt>Camera</dt><dd>{camera}</dd>
          <dt>AI mode</dt><dd>{mode}</dd>
          <dt>Auto-trigger</dt><dd>{auto ? 'on' : 'off'} <small>(A)</small></dd>
          <dt>Motion</dt>
          <dd>
            <div className="meter"><span style={{ width: `${Math.min(motion / 0.15, 1) * 100}%` }} />
              <i style={{ left: `${(MOTION_THRESHOLD / 0.15) * 100}%` }} /></div>
            {(motion * 100).toFixed(1)}%
          </dd>
          <dt>Last check</dt>
          <dd>
            {last ? (
              <>
                face/hand check {last.ms} ms (SAM 3.1, local) · showing something {last.holding ? '✓ (hand up)' : '✗'}
                {last.detections.map((d, i) => (
                  <div key={i} className="det" style={{ color: COLORS[d.prompt] }}>
                    {d.prompt}: {(d.score * 100).toFixed(0)}% · {(d.area * 100).toFixed(1)}% of frame
                  </div>
                ))}
              </>
            ) : '—'}
          </dd>
        </dl>

        {st && (
          <div className="cam-st">
            <h3>Show &amp; Tell</h3>
            <div className="st-row">
              <img src={st.frame} alt="captured frame" />
              {st.item && <img src={st.item.cutout} alt="cutout" className="cutout" />}
            </div>
            <p>{st.item ? `"${st.item.label}" → ${st.item.performance.title}` : st.error ?? 'working…'}</p>
          </div>
        )}

        <div className="cam-buttons">
          <button onClick={() => send('tank', { type: 'wake' })}>Wake duck</button>
          <button onClick={showAndTell}>Show &amp; Tell (S)</button>
        </div>

        <h3>Log</h3>
        <ol className="cam-log">
          {log.map((l, i) => (
            <li key={i} className={l.kind}>
              <time>{new Date(l.t).toLocaleTimeString()}</time> {l.text}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
