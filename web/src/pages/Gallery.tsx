import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'
import { Duck, NO_HAND_STYLES } from '../duck/Duck'
import type { NoHandStyle } from '../duck/Duck'
import { HELLO, NO, THINK, THUMBS, play } from '../duck/player'
import type { Accessory, Performance } from '../duck/types'
import { Aquarium } from '../scenes/Aquarium'
import { FishCanvas } from '../scenes/FishCanvas'
import { Submarine } from '../scenes/Submarine'
import { WaitingDuck } from '../components/WaitingDuck'
import { CritterPreview } from '../scenes/CritterPreview'

/**
 * Design review page: every visual component in every style/state, rendered from the real components.
 * Vite hot-reloads it on every change. Refer to cards by their id (e.g. "duck.no.float").
 */

const svg = (inner: string, vb = '0 0 100 100') =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`)
const OUT = 'stroke="#1F2430" stroke-width="4" stroke-linejoin="round"'
const CROWN: Accessory = { slot: 'hat', bbox: { x: 92, y: 0, w: 68, h: 50 },
  url: svg(`<path d="M6 44 L10 8 L24 28 L34 4 L44 28 L58 8 L62 44 Z" fill="#7C3AED" ${OUT}/>`, '0 0 68 50') }
const BANANA = svg(`<path d="M14 70 Q50 96 86 40 Q92 30 84 28 Q60 72 18 58 Z" fill="#FACC15" ${OUT}/>`)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function Card({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) {
  return (
    <figure className="g-card" id={id}>
      <div className="g-view">{children}</div>
      <figcaption>
        <code>{id}</code>
        <b>{title}</b>
        {note && <small>{note}</small>}
      </figcaption>
    </figure>
  )
}

/** A duck that plays a performance on a loop. */
function LoopDuck({ perf, noHand, accessories, held, showHands }: {
  perf?: Performance; noHand?: NoHandStyle; accessories?: Accessory[]; held?: string; showHands?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  useEffect(() => {
    if (!perf) return
    let alive = true
    ;(async () => {
      while (alive) {
        if (ref.current) await play(ref.current, perf, { onBubble: (b) => alive && setBubble(b) })
        await sleep(700)
      }
    })()
    return () => {
      alive = false
    }
  }, [perf])
  return (
    <div className="g-duck">
      {bubble && <div className="g-bubble">{bubble}</div>}
      <Duck ref={ref} noHand={noHand} accessories={accessories} held={held ?? null} props={perf?.props} showHands={showHands} />
    </div>
  )
}

/** Mini 3:4 tank stage so container-relative (cqh) styles render like on the OLED. */
function MiniStage({ children }: { children: ReactNode }) {
  return <div className="stage g-stage">{children}</div>
}

function CardState({ kind }: { kind: 'card' | 'reply' | 'sent' }) {
  return (
    <MiniStage>
      <div className="porthole-view with-card">
        <div className="porthole-glass">
          <div className="big-duck"><Duck accessories={[CROWN]} showHands /></div>
        </div>
        <div className="card-wrap">
          <div className="glove left" />
          <div className="msg-card">
            {kind === 'card' && (<><div className="from">Marco:</div><p className="msg-text">“I got the job!! Drinks Friday? 🍻”</p></>)}
            {kind === 'reply' && (<><div className="from">Smile for Marco! 📸</div>
              <div className="live-wrap"><div className="live-cam waiting">📷 live camera here</div><div className="live-count">2</div></div></>)}
            {kind === 'sent' && (<><div className="live-wrap"><div className="live-cam waiting">📸 your photo</div></div>
              <p className="msg-text">Sent to Marco! 🦆✨</p></>)}
          </div>
          <div className="glove right" />
        </div>
      </div>
    </MiniStage>
  )
}

export default function Gallery() {
  const [library, setLibrary] = useState<Record<string, Performance>>({})
  useEffect(() => {
    api.performances().then(setLibrary).catch(() => {})
  }, [])

  return (
    <div className="gallery">
      <header>
        <h1>🦆 Design gallery</h1>
        <p>Every visual in every state, live from the real components. Auto-refreshes on every change.
          Refer to a card by its <code>id</code> when giving feedback.</p>
        <nav>
          <a href="#duck">Duck</a> <a href="#no">“No” hand</a> <a href="#reactions">Reactions</a>
          <a href="#performances">Performances</a>
          <a href="#scenes">Scenes</a> <a href="#cards">Cards</a> <a href="#friend">Friend page</a> <a href="#marine">Marine life</a> <a href="#aquarium">Aquarium</a>
        </nav>
      </header>

      <section id="duck">
        <h2>Duck: base states</h2>
        <div className="g-grid">
          <Card id="duck.base" title="Default"><LoopDuck /></Card>
          <Card id="duck.hands" title="Holding the card" note="Wing stretches forward while holding the message card"><LoopDuck showHands /></Card>
          <Card id="duck.held" title="Holding an object" note="Show & Tell cutout in the right hand"><LoopDuck held={BANANA} /></Card>
          <Card id="duck.crown" title="Wearing a friend's drawing"><LoopDuck accessories={[CROWN]} /></Card>
        </div>
      </section>

      <section id="no">
        <h2>“Nope, nothing new” hand</h2>
        <div className="g-grid">
          {NO_HAND_STYLES.map((s) => (
            <Card key={s} id={`duck.no.${s}`} title={s} note={{
              emoji: 'OpenMoji ☝️ on the chest (current default)',
              drawn: 'Drawn outlined pointing hand on the chest',
            }[s]}>
              <LoopDuck perf={NO} noHand={s} />
            </Card>
          ))}
        </div>
      </section>

      <section id="reactions">
        <h2>Scene reactions</h2>
        <div className="g-grid">
          <Card id="react.hello" title="Hello" note="When the sub arrives"><LoopDuck perf={HELLO} /></Card>
          <Card id="react.thumbs" title="Thumbs up" note="'Hey, there's a message from…'"><LoopDuck perf={THUMBS} /></Card>
          <Card id="react.think" title="Thinking" note="Show & Tell, waiting for SAM"><LoopDuck perf={THINK} /></Card>
        </div>
      </section>

      <section id="performances">
        <h2>Performances (keys 1–8 on the tank, also fed to Muse as CSS examples)</h2>
        <div className="g-grid">
          {Object.entries(library).map(([name, perf], i) => (
            <Card key={name} id={`perf.${name}`} title={`${i + 1}. ${perf.title}`}>
              <LoopDuck perf={perf} accessories={[CROWN]} />
            </Card>
          ))}
          {!Object.keys(library).length && <p>Backend not reachable: start ./scripts/dev-backend.sh</p>}
        </div>
      </section>

      <section id="scenes">
        <h2>Scenes</h2>
        <div className="g-grid">
          <Card id="scene.sub" title="Submarine + duck in porthole">
            <div className="g-sub"><Submarine><Duck accessories={[CROWN]} /></Submarine></div>
          </Card>
          <Card id="scene.sub.no" title="Submarine: no message">
            <div className="g-sub"><Submarine><LoopDuck perf={NO} /></Submarine></div>
          </Card>
          <Card id="scene.bubble" title="Speech bubble">
            <MiniStage><div className="bubble sub-bubble" style={{ top: '40%', left: '10%' }}>Hey, there's a message from Marco!</div></MiniStage>
          </Card>
          <Card id="scene.countdown" title="Show & Tell countdown">
            <MiniStage><div className="st-countdown"><div className="count">2</div><p>Ooh, what's that? Hold it still! 👀</p></div></MiniStage>
          </Card>
        </div>
      </section>

      <section id="cards">
        <h2>Message card states</h2>
        <div className="g-grid">
          <Card id="card.message" title="Message"><CardState kind="card" /></Card>
          <Card id="card.reply" title="Photo reply countdown"><CardState kind="reply" /></Card>
          <Card id="card.sent" title="Sent"><CardState kind="sent" /></Card>
        </div>
      </section>

      <section id="friend">
        <h2>Friend page</h2>
        <div className="g-grid">
          <Card id="friend.waiting" title="Waiting screen" note="While Muse Spark + Muse Image work (~30–40 s)">
            <div style={{ width: '100%', maxWidth: 420, padding: 10 }}><WaitingDuck /></div>
          </Card>
        </div>
      </section>

      <section id="marine">
        <h2>Marine life</h2>
        <div className="g-grid">
          <Card id="marine.seahorse" title="Seahorse" note="Drifts upright, bobs, fin flutters (2 in the tank)"><CritterPreview kind="seahorse" /></Card>
          <Card id="marine.jellyfish" title="Jellyfish" note="Pulses up, sinks slowly, tentacles wave (2)"><CritterPreview kind="jellyfish" /></Card>
          <Card id="marine.shrimp" title="Shrimp" note="Scuttles on the sand, stops, tail-flicks back (2)"><CritterPreview kind="shrimp" /></Card>
          <Card id="marine.octopus" title="Octopus" note="Crawls on the sand, sometimes jets up and floats down (1)"><CritterPreview kind="octopus" /></Card>
        </div>
      </section>

      <section id="aquarium">
        <h2>Aquarium</h2>
        <div className="g-grid">
          <Card id="aquarium.idle" title="Idle + bottle" note="Press K to summon the shark (frog tongue)">
            <MiniStage><Aquarium bottle /></MiniStage>
          </Card>
          <Card id="aquarium.fish" title="Fish only (canvas)" note="One outline around body + tail">
            <MiniStage><div className="layer" style={{ background: '#7CC4E8' }} /><FishCanvas fishCount={14} critters={false} /></MiniStage>
          </Card>
        </div>
      </section>
    </div>
  )
}
