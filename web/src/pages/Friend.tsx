import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { CssDuck } from '../components/CssDuck'
import { WaitingDuck } from '../components/WaitingDuck'
import { COLORS, DrawPad, DrawTools, exportDrawing, QualitySlider, SIZES } from '../components/DrawPad'
import type { Stroke } from '../components/DrawPad'
import { Duck } from '../duck/Duck'
import { play } from '../duck/player'
import type { Draft, Reply } from '../duck/types'

function friendId(): string {
  let id = localStorage.getItem('duck-friend-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('duck-friend-id', id)
  }
  return id
}

/** Loops the AI draft so the friend can decide whether to send it. */
function DraftPreview({ draft }: { draft: Draft }) {
  const [playKey, setPlayKey] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setPlayKey((k) => k + 1), draft.duration_ms + 900)
    return () => clearInterval(id)
  }, [draft])
  return (
    <div className="playable">
      <CssDuck css={draft.css} placed={draft.accessory} playKey={playKey} bubble={draft.bubble} />
    </div>
  )
}

/** The duck the friend sent: AI CSS animation if present, otherwise the canned performance. Loops. */
function SentDuck({ msg }: { msg: NonNullable<Reply['message']> }) {
  const ref = useRef<SVGSVGElement>(null)
  const [playKey, setPlayKey] = useState(0)
  useEffect(() => {
    const every = (msg.css ? msg.duration_ms ?? 3000 : msg.performance.duration_ms) + 900
    const id = setInterval(() => setPlayKey((k) => k + 1), every)
    return () => clearInterval(id)
  }, [msg])
  useEffect(() => {
    if (!msg.css && ref.current) play(ref.current, msg.performance)
  }, [msg, playKey])
  return (
    <div className="playable small">
      {msg.css
        ? <CssDuck css={msg.css} placed={msg.placed} playKey={playKey} bubble={msg.bubble} />
        : <Duck ref={ref} accessories={msg.accessory ? [msg.accessory] : []} props={msg.performance.props} />}
    </div>
  )
}

function GiftDuck({ reply }: { reply: Reply }) {
  const ref = useRef<SVGSVGElement>(null)
  const go = useCallback(() => {
    if (ref.current) play(ref.current, reply.performance)
  }, [reply])
  useEffect(() => {
    const t = setTimeout(go, 300)
    return () => clearTimeout(t)
  }, [go])
  return <div className="playable" onClick={go}><Duck ref={ref} held={reply.cutout ?? null} props={reply.performance.props} /></div>
}

/**
 * Friend page: draw anything on the duck + pick the AI quality + write a message → preview → send / start over.
 */
export default function Friend() {
  const { owner = 'alberto' } = useParams()
  const fid = useRef(friendId()).current
  const [name, setName] = useState(localStorage.getItem('duck-friend-name') ?? '')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [quality, setQuality] = useState(0.5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])

  useEffect(() => {
    const tick = () => api.replies(owner, fid).then((r) => setReplies([...r].reverse())).catch(() => {})
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [owner, fid])

  const preview = async () => {
    if (!name.trim()) return setError('Tell the duck your name first 🙂')
    if (!strokes.length) return setError('Draw something on the duck first!')
    setError(null)
    setBusy('The duck is getting dressed… 🦆')
    setGenerating(true)
    localStorage.setItem('duck-friend-name', name.trim())
    try {
      const d = await exportDrawing(strokes)
      setDraft(await api.draft({
        message: text.trim(), quality, doodle: d?.doodle, composite: d?.composite,
        bbox: d ? JSON.stringify(d.bbox) : undefined,
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
      setGenerating(false)
    }
  }

  const send = async () => {
    if (!draft) return
    setBusy('Sending… 🚀')
    try {
      await api.sendDraft({ owner, friend_id: fid, from_name: name.trim(), text: text.trim(), draft_id: draft.id })
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const startOver = () => {
    setDraft(null)
    setSent(false)
    setStrokes([])
    setText('')
  }

  const wobble = quality < 0.45 ? 'url(#wobble)'
    : quality > 0.6 ? `drop-shadow(0 ${(quality - 0.6) * 10}px ${(quality - 0.6) * 12}px rgba(0,0,0,.35))` : undefined

  return (
    <div className="friend">
      <header>
        <h1>🦆 Send something to <span className="cap">{owner}</span>'s duck</h1>
        <p>Draw anything on the duck, pick how fancy the AI makes it, add a message. It'll deliver it by submarine.</p>
      </header>

      {sent ? (
        <section className="panel sent">
          <h2>Delivered! 🚀</h2>
          <p>The duck will show it next time {owner} looks at the aquarium.</p>
          {draft && <DraftPreview draft={draft} />}
          <button onClick={startOver}>Send another</button>
        </section>
      ) : generating ? (
        <WaitingDuck />
      ) : draft ? (
        <section className="panel sent">
          <h2>Here's your duck</h2>
          <p>This is what {owner} will see. Send it like this?</p>
          <DraftPreview draft={draft} />
          {draft.label && <p className="hint">The AI saw: <b>{draft.label}</b></p>}
          <div className="actions-row">
            <button onClick={send} disabled={!!busy}>Send 🦆</button>
            <button className="ghost" onClick={startOver} disabled={!!busy}>Start over</button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <label className="field">Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marco" maxLength={40} />
            </label>
          </section>

          <section className="panel">
            <h2>1. Draw anything on the duck</h2>
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <filter id="wobble">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
                <feDisplacementMap in="SourceGraphic" scale={Math.max(0, (0.45 - quality) * 26)} />
              </filter>
            </svg>
            <DrawPad strokes={strokes} onChange={setStrokes} color={color} size={size} filter={wobble} />
            <DrawTools color={color} setColor={setColor} size={size} setSize={setSize} strokes={strokes} onChange={setStrokes} />
            <QualitySlider value={quality} onChange={setQuality} />
          </section>

          <section className="panel">
            <h2>2. Your message</h2>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3}
              placeholder="I got the job!! Drinks Friday? 🍻" />
          </section>

          {error && <p className="error">{error}</p>}
          <button className="send" onClick={preview} disabled={!!busy}>{busy ?? 'Preview the duck ✨'}</button>
        </>
      )}
      {busy && draft && <p className="hint">{busy}</p>}
      {error && (draft || sent) && <p className="error">{error}</p>}

      {replies.length > 0 && (
        <section className="panel replies">
          <h2>Replies from {owner} 💌</h2>
          {replies.map((r) => (
            <div key={r.id} className="reply">
              {r.kind === 'photo' ? (
                <>
                  <p>{owner} replied with a photo 📸</p>
                  <div className="reply-pair">
                    {r.message && (
                      <figure>
                        <SentDuck msg={r.message} />
                        <figcaption>Your duck{r.message.text ? `: “${r.message.text}”` : ''}</figcaption>
                      </figure>
                    )}
                    <figure>
                      <img src={r.photo} className="reply-photo" alt="reply" />
                      <figcaption>{owner}'s reaction</figcaption>
                    </figure>
                  </div>
                </>
              ) : r.kind === 'video' ? (
                <>
                  <video src={r.video} controls playsInline />
                  {r.transcript && <p className="caption">🗣 {r.transcript}</p>}
                </>
              ) : (
                <>
                  <p>{owner} sent you a <b>{r.label}</b>! 🎁</p>
                  <GiftDuck reply={r} />
                </>
              )}
              <time>{new Date(r.created * 1000).toLocaleString()}</time>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
