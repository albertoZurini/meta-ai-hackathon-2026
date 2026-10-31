import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { send, streamUrl, useBus } from '../bus'
import type { BusEvent } from '../bus'
import { Duck } from '../duck/Duck'
import { HELLO, NO, THINK, THUMBS, play, reset } from '../duck/player'
import type { Message, Performance, ShowTell } from '../duck/types'
import { CssDuck } from '../components/CssDuck'
import { Aquarium } from '../scenes/Aquarium'
import { Submarine } from '../scenes/Submarine'
import { onAudioBlocked, quack, unlockAudio } from '../sound'

/**
 * Hands-free flow (see docs/FLOW.md):
 * look at the camera → sub arrives → "Hey, there's a message from X!" → zoom → duck performs →
 * message card → mandatory photo reply (live camera + 3-2-1) → sent → sub leaves.
 */
type Phase =
  | 'idle' | 'arriving' | 'nomsg' | 'hasmsg' | 'leaving'
  | 'zoom' | 'perform' | 'card' | 'reply' | 'uploading' | 'sent'
  | 'st-countdown' | 'st-thinking' | 'st-perform' | 'st-done'

const SUB_IN: Phase[] = ['arriving', 'nomsg', 'hasmsg', 'st-thinking']
const PORTHOLE: Phase[] = ['zoom', 'perform', 'card', 'reply', 'uploading', 'sent', 'st-perform', 'st-done']
const WITH_CARD: Phase[] = ['card', 'reply', 'uploading', 'sent']

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- demo data for the simulation keys (see docs/KEYS.md) ----------
const CROWN = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 50"><path d="M6 44 L10 8 L24 28 L34 4 L44 28 L58 8 L62 44 Z" ' +
  'fill="#7C3AED" stroke="#1F2430" stroke-width="4" stroke-linejoin="round"/></svg>')
const BANANA = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M14 70 Q50 96 86 40 Q92 30 84 28 Q60 72 18 58 Z" ' +
  'fill="#FACC15" stroke="#1F2430" stroke-width="5" stroke-linejoin="round"/></svg>')
const WIGGLE: Performance = { title: 'Wiggle', duration_ms: 3000, props: [], bubble: [],
  tracks: [{ target: 'duck', keyframes: [{ t: 0, rotate: 0 }, { t: 0.25, rotate: -6 }, { t: 0.75, rotate: 6 }, { t: 1, rotate: 0 }], iterations: 3 }] }

function demoMessage(perf: Performance = WIGGLE): Message {
  return {
    id: 'demo', created: Date.now() / 1000, friend_id: 'demo', from_name: 'Marco', prompt: perf.title,
    text: 'I got the job!! Drinks Friday? 🍻', video: null, transcript: '', status: 'pending', performance: perf,
    accessory: { url: CROWN, slot: 'hat', bbox: { x: 92, y: 0, w: 68, h: 50 } },
  }
}

/** Live camera frames from the Mac (/camera), relayed by the backend over a WebSocket. */
function LiveCam({ frozen }: { frozen: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  const frozenRef = useRef(frozen)
  frozenRef.current = frozen
  useEffect(() => {
    const ws = new WebSocket(streamUrl('tank'))
    ws.binaryType = 'blob'
    let current: string | null = null
    ws.onmessage = (e) => {
      if (frozenRef.current) return
      const url = URL.createObjectURL(e.data as Blob)
      setSrc(url)
      if (current) URL.revokeObjectURL(current)
      current = url
    }
    const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 10000)
    return () => {
      clearInterval(ping)
      ws.close()
      if (current) URL.revokeObjectURL(current)
    }
  }, [])
  return src ? <img src={src} className="live-cam mirror" alt="" /> : <div className="live-cam waiting">📷 waiting for camera…</div>
}

export default function Tank() {
  const [phase, setPhaseState] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
    send('camera', { type: 'phase', phase: p })
  }

  const [msg, setMsg] = useState<Message | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [bubble, setBubble] = useState<string | null>(null)
  const [st, setSt] = useState<ShowTell | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [replyPhoto, setReplyPhoto] = useState<string | null>(null)
  const [cssPlay, setCssPlay] = useState(0) // bump to (re)start an AI-generated CSS animation
  const [toast, setToast] = useState<string | null>(null)
  const [hud, setHud] = useState(false)
  const [mode, setMode] = useState('?')
  const [audioBlocked, setAudioBlocked] = useState(false)

  const subDuck = useRef<SVGSVGElement>(null)
  const bigDuck = useRef<SVGSVGElement>(null)
  const stBox = useRef<{ result?: ShowTell; error?: string }>({})
  const snapBox = useRef<{ ok?: boolean; photo?: string; error?: string }>({})
  const cameraOnline = useRef(false)
  const videoEnded = useRef<() => void>(() => {})

  const flash = (text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    api.health().then((h) => setMode(h.mode)).catch(() => {})
    return onAudioBlocked(setAudioBlocked)
  }, [])

  // Poll pending messages for the message-in-a-bottle hint.
  useEffect(() => {
    const tick = () => api.pending().then((m) => setPendingCount(m.length)).catch(() => {})
    tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [])

  // ---------- flow ----------
  const leave = useCallback(async () => {
    setBubble(null)
    send('camera', { type: 'stream', on: false })
    setPhase('leaving')
    await sleep(1300)
    if (subDuck.current) reset(subDuck.current)
    if (bigDuck.current) reset(bigDuck.current)
    setMsg(null)
    setSt(null)
    setReplyPhoto(null)
    setPhase('idle')
  }, [])

  /** Mandatory photo reply: live camera on the tank, 3-2-1, snap on the Mac, upload, quack quack. */
  const reply = useCallback(async (m: Message) => {
    if (!cameraOnline.current) {
      flash('Open /camera on the Mac to reply')
      await sleep(2000)
      return leave()
    }
    snapBox.current = {}
    send('camera', { type: 'stream', on: true })
    setPhase('reply')
    await sleep(1200)
    for (const n of [3, 2, 1]) {
      setCountdown(n)
      await sleep(900)
    }
    setCountdown(0)
    setPhase('uploading')
    send('camera', { type: 'snap', messageId: m.id, name: m.from_name })
    for (let i = 0; i < 100 && snapBox.current.ok === undefined; i++) await sleep(100)
    send('camera', { type: 'stream', on: false })
    if (!snapBox.current.ok) {
      flash(`Reply failed: ${snapBox.current.error ?? 'timeout'}`)
      return leave()
    }
    setReplyPhoto(snapBox.current.photo ?? null)
    setPhase('sent')
    quack(2)
    await sleep(2600)
    await leave()
  }, [leave])

  const showMessage = useCallback(async (m: Message) => {
    setPhase('zoom')
    await sleep(900)
    setPhase('perform')
    await sleep(50)
    if (m.css) {
      // AI-generated: placed accessory + model CSS (sanitized by the backend).
      setCssPlay((k) => k + 1)
      if (m.bubble) {
        setBubble(m.bubble)
        setTimeout(() => setBubble((b) => (b === m.bubble ? null : b)), 2800)
      }
      await sleep(Math.min(Math.max(m.duration_ms ?? 3000, 1500), 10000) + 400)
    } else if (bigDuck.current) {
      await play(bigDuck.current, m.performance, { onBubble: setBubble })
    }
    if (m.id !== 'demo') api.viewed(m.id).then(() => setPendingCount((c) => Math.max(0, c - 1))).catch(() => {})
    setPhase('card')
    // Read time: video until it ends (max 40 s), text ~ 60 ms per character (4–12 s).
    if (m.video) {
      await Promise.race([new Promise<void>((r) => (videoEnded.current = r)), sleep(40000)])
      await sleep(800)
    } else {
      await sleep(Math.min(Math.max(4000, m.text.length * 60), 12000))
    }
    await reply(m)
  }, [reply])

  /** `override` lets the simulation keys force a scenario without touching the backend. */
  const wake = useCallback(async (override?: Message[]) => {
    if (phaseRef.current !== 'idle') return
    let pending: Message[] = override ?? []
    if (!override) {
      try {
        pending = await api.pending()
      } catch {
        flash('Backend unreachable')
      }
    }
    setPendingCount(pending.length)
    const m = pending[0] ?? null
    setMsg(m)
    setPhase('arriving')
    quack(1)
    await sleep(1500)
    if (!subDuck.current) return
    if (!m) {
      setPhase('nomsg')
      await play(subDuck.current, NO, { onBubble: setBubble })
      return leave()
    }
    setPhase('hasmsg')
    setBubble(`Hey, there's a message from ${m.from_name}!`)
    await play(subDuck.current, THUMBS, { hold: true })
    await sleep(1600)
    setBubble(null)
    await showMessage(m)
  }, [leave, showMessage])

  /** Started by the camera page when SAM sees an object held up (or the S key there). */
  const showAndTell = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    stBox.current = {}
    setPhase('st-countdown')
    for (const n of [3, 2, 1]) {
      setCountdown(n)
      await sleep(600)
    }
    setCountdown(0)
    setPhase('st-thinking')
    quack(1)
    await sleep(1500)
    while (!stBox.current.result && !stBox.current.error) {
      setBubble('Hmm… 🔍')
      if (subDuck.current) await play(subDuck.current, THINK)
      else await sleep(500)
    }
    setBubble(null)
    const item = stBox.current.result
    if (!item) {
      setBubble(stBox.current.error ?? 'Hmm, I missed it')
      await sleep(2500)
      return leave()
    }
    setSt(item)
    setPhase('zoom')
    await sleep(900)
    setPhase('st-perform')
    await sleep(50)
    if (bigDuck.current) await play(bigDuck.current, item.performance, { onBubble: setBubble })
    setPhase('st-done')
    setBubble(`Thanks for the ${item.label}!`)
    await sleep(2200)
    await leave()
  }, [leave])

  // ---------- simulation (keys documented in docs/KEYS.md) ----------
  const library = useRef<Performance[]>([])
  useEffect(() => {
    api.performances().then((l) => (library.current = Object.values(l))).catch(() => {})
  }, [])

  const demoPerform = useCallback(async (perf: Performance) => {
    if (phaseRef.current !== 'idle') return
    setMsg(demoMessage(perf))
    setPhase('zoom')
    await sleep(900)
    setPhase('perform')
    await sleep(50)
    if (bigDuck.current) await play(bigDuck.current, perf, { onBubble: setBubble })
    await leave()
  }, [leave])

  const demoShowAndTell = useCallback((fail: boolean) => {
    if (phaseRef.current !== 'idle') return
    showAndTell()
    setTimeout(() => {
      if (fail) stBox.current.error = "I couldn't see a thing"
      else stBox.current.result = {
        id: 'demo', label: 'banana', cutout: BANANA,
        performance: library.current.find((p) => p.title.startsWith('Wave')) ?? WIGGLE,
      }
    }, 4500)
  }, [showAndTell])

  /** Jump straight to a card state with the demo message. */
  const demoState = useCallback(async (p: Phase) => {
    if (phaseRef.current !== 'idle') return
    const m = demoMessage()
    setMsg(m)
    if (p === 'reply') return reply(m)
    setPhase(p)
    if (p === 'sent') quack(2)
    await sleep(3500)
    if (phaseRef.current === p) leave()
  }, [leave, reply])

  const simulate = useCallback((key: string): boolean => {
    const n = Number(key)
    if (key >= '1' && key <= '9' && library.current[n - 1]) return void demoPerform(library.current[n - 1]), true
    switch (key) {
      case 'q': wake([]); return true
      case 'w': wake([demoMessage(library.current[0] ?? WIGGLE)]); return true
      case 'e': demoShowAndTell(false); return true
      case 'E': demoShowAndTell(true); return true
      case 'r': demoState('card'); return true
      case 't': demoState('reply'); return true
      case 'u': demoState('uploading'); return true
      case 'i': demoState('sent'); return true
      case 'm': quack(1); return true
      case 'b': setPendingCount((c) => (c ? 0 : 1)); return true
      case 'x': if (phaseRef.current !== 'idle') leave(); return true
    }
    return false
  }, [wake, demoPerform, demoShowAndTell, demoState, leave])

  // ---------- input: local keyboard or keys forwarded from the camera page ----------
  const handleKey = useCallback((key: string) => {
    if (key === 'd') return setHud((h) => !h)
    if (simulate(key)) return
    if ((key === ' ' || key === 'Enter') && phaseRef.current === 'idle') wake()
  }, [wake, simulate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault()
      handleKey(e.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey])

  const cameraPeer = useBus('tank', (e: BusEvent) => {
    switch (e.type) {
      case 'peer':
        cameraOnline.current = e.online
        if (e.online) send('camera', { type: 'phase', phase: phaseRef.current })
        break
      case 'wake': wake(); break
      case 'key': handleKey(e.key); break
      case 'showtell-start': showAndTell(); break
      case 'showtell-result': stBox.current.result = e.item; break
      case 'showtell-error': stBox.current.error = e.error; break
      case 'snap-done': snapBox.current = { ok: e.ok, photo: e.photo, error: e.error }; break
    }
  })
  cameraOnline.current = cameraPeer

  // Wave hello when the sub has arrived.
  useEffect(() => {
    if (phase === 'arriving') {
      const t = setTimeout(() => subDuck.current && play(subDuck.current, HELLO), 900)
      return () => clearTimeout(t)
    }
  }, [phase])

  const subPos = SUB_IN.includes(phase) ? 'in' : phase === 'leaving' ? 'out' : 'hidden'
  const inPorthole = PORTHOLE.includes(phase)
  const accessories = msg?.accessory ? [msg.accessory] : []
  const held = st?.cutout ?? null

  return (
    <div className="tank-root" onClick={audioBlocked ? unlockAudio : undefined}>
      <div className="stage">
        <Aquarium bottle={phase === 'idle' && pendingCount > 0} />

        <div className={`sub sub-${subPos}`}>
          <Submarine>
            <Duck ref={subDuck} accessories={accessories} placed={msg?.placed} held={phase === 'st-thinking' ? null : held}
              props={phase === 'st-thinking' ? THINK.props : []} />
          </Submarine>
          {bubble && SUB_IN.includes(phase) && <div className="bubble sub-bubble">{bubble}</div>}
        </div>

        {inPorthole && (
          <div className={`porthole-view ${phase === 'zoom' ? 'zooming' : ''} ${WITH_CARD.includes(phase) ? 'with-card' : ''}`}>
            <div className="porthole-glass">
              <div className="big-duck">
                {msg?.css ? (
                  <CssDuck css={phase === 'perform' ? msg.css : null} playKey={cssPlay} placed={msg.placed}
                    showHands={WITH_CARD.includes(phase)} />
                ) : (
                  <Duck ref={bigDuck} accessories={accessories} held={held}
                    props={phase === 'perform' ? msg?.performance.props : phase === 'st-perform' ? st?.performance.props : []}
                    showHands={WITH_CARD.includes(phase)} />
                )}
              </div>
            </div>
            {/* Outside the glass so long lines aren't clipped by the round window. */}
            {bubble && <div className="bubble big-bubble">{bubble}</div>}

            {WITH_CARD.includes(phase) && msg && (
              <div className="card-wrap">
                <div className="glove left" />
                <div className="msg-card">
                  {phase === 'card' && (
                    <>
                      <div className="from">{msg.from_name}:</div>
                      {msg.video && (
                        <video src={msg.video} autoPlay playsInline className="msg-video"
                          onEnded={() => videoEnded.current()} />
                      )}
                      {msg.text && <p className="msg-text">“{msg.text}”</p>}
                      {msg.transcript && <p className="caption">🗣 {msg.transcript}</p>}
                    </>
                  )}
                  {(phase === 'reply' || phase === 'uploading') && (
                    <>
                      <div className="from">Smile for {msg.from_name}! 📸</div>
                      <div className="live-wrap">
                        <LiveCam frozen={phase === 'uploading'} />
                        {countdown > 0 && <div className="live-count">{countdown}</div>}
                        {phase === 'uploading' && <div className="live-flash" />}
                      </div>
                    </>
                  )}
                  {phase === 'sent' && (
                    <>
                      {replyPhoto && <img src={replyPhoto} className="msg-video" alt="your reply" />}
                      <p className="msg-text">Sent to {msg.from_name}! 🦆✨</p>
                    </>
                  )}
                </div>
                <div className="glove right" />
              </div>
            )}
          </div>
        )}

        {phase === 'st-countdown' && (
          <div className="st-countdown">
            <div className="count">{countdown || '📸'}</div>
            <p>Ooh, what's that? Hold it still! 👀</p>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
        {audioBlocked && <div className="audio-hint">🔇 click anywhere to enable the quack</div>}
      </div>

      {hud && (
        <div className="hud">
          <div>mode: {mode} · phase: {phase}</div>
          <div>camera page: {cameraPeer ? 'connected ✓' : 'not connected (open /camera)'}</div>
          <div>pending: {pendingCount}</div>
          <div className="keys">Space wake · D hud · K shark · M quack · 1-8 animations · Q W E R T U I B X scenes (docs/KEYS.md)</div>
        </div>
      )}
    </div>
  )
}
