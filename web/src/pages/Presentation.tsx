import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CssDuck } from '../components/CssDuck'
import { Duck } from '../duck/Duck'
import { NO, play } from '../duck/player'
import type { PlacedAccessory, Performance } from '../duck/types'
import { Aquarium } from '../scenes/Aquarium'
import './presentation.css'

/**
 * "How it works" slides for the demo video. → / Space / click = next block, ← = back.
 * Everything animated is a real component; data is a snapshot of a real run (web/public/presentation/data.json).
 */

type Snapshot = {
  draft: {
    message: string; label: string; css: string; bubble: string; duration_ms: number
    timings: { spark_ms: number; image_ms: number }
    doodle: string; composite: string; accessory_raw: string; accessory: PlacedAccessory
  }
  showtell: { label: string; performance: Performance; cutout: string }
  quality: { q: number; style: string; img: string }[]
}

const W = 1600
const H = 900
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- live pieces ---------- */

function PerfDuck({ perf, held, size = 220 }: { perf: Performance; held?: string; size?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      while (alive) {
        setBubble(null)
        if (ref.current) await play(ref.current, perf, { onBubble: (b) => alive && setBubble(b) })
        await sleep(900)
      }
    })()
    return () => {
      alive = false
    }
  }, [perf])
  return (
    <div className="p-duck" style={{ width: size, height: size }}>
      {bubble && <div className="p-bubble">{bubble}</div>}
      <Duck ref={ref} held={held ?? null} props={perf.props} />
    </div>
  )
}

function GenDuck({ snap, size = 220 }: { snap: Snapshot; size?: number }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setK((x) => x + 1), snap.draft.duration_ms + 900)
    return () => clearInterval(t)
  }, [snap])
  return (
    <div className="p-duck" style={{ width: size, height: size }}>
      <CssDuck css={snap.draft.css} placed={snap.draft.accessory} playKey={k} bubble={snap.draft.bubble} />
    </div>
  )
}

function MiniTank({ bottle, height = 300 }: { bottle: boolean; height?: number }) {
  return (
    <div className="p-tank" style={{ height, width: (height * 3) / 4 }}>
      <div className="stage p-stage"><Aquarium bottle={bottle} /></div>
    </div>
  )
}

function Phone({ height = 330 }: { height?: number }) {
  const scale = height / 844
  return (
    <div className="p-phone" style={{ width: 390 * scale + 16, height: height + 16 }}>
      <iframe src="/friend" title="friend page" style={{ transform: `scale(${scale})` }} tabIndex={-1} />
    </div>
  )
}

/** Index that advances every `ms`, driven by the wall clock so separate components stay in sync. */
function useCycle(n: number, ms = 2400) {
  const [i, setI] = useState(() => Math.floor(Date.now() / ms) % n)
  useEffect(() => {
    const t = setInterval(() => setI(Math.floor(Date.now() / ms) % n), 100)
    return () => clearInterval(t)
  }, [n, ms])
  return i
}

function QualitySlider({ snap }: { snap: Snapshot }) {
  const i = useCycle(Math.max(1, snap.quality.length))
  const q = snap.quality[i] ?? { q: 1 }
  return (
    <div className="p-slider">
      <div className="p-slider-track"><i style={{ left: `${q.q * 100}%` }}>🦆</i></div>
      <div className="p-slider-ends"><span>🖍 5-year-old</span><span>photo 📷</span></div>
    </div>
  )
}

function QualityOutput({ snap }: { snap: Snapshot }) {
  const i = useCycle(Math.max(1, snap.quality.length))
  return (
    <div className="p-qout">
      {snap.quality.map((q, k) => <img key={k} className={`p-thumb ${k === i ? 'on' : ''}`} src={q.img} alt="" />)}
    </div>
  )
}

/* ---------- layout primitives ---------- */

type Pt = [number, number]
const StepCtx = createContext(1)

function Node({ at, step, children, className = '', style }: {
  at: Pt; step: number; children: ReactNode; className?: string; style?: CSSProperties
}) {
  const on = useContext(StepCtx) >= step
  return (
    <div className={`p-node ${on ? 'on' : ''} ${className}`} style={{ left: at[0], top: at[1], ...style }}>
      {children}
    </div>
  )
}

function Box({ title, tag, children }: { title: string; tag?: 'meta' | 'local' | 'code'; children?: ReactNode }) {
  return (
    <div className="p-box">
      <div className="p-box-head">
        {tag === 'meta' && <span className="p-tag meta">Meta</span>}
        {tag === 'local' && <span className="p-tag meta">Meta · runs locally</span>}
        {tag === 'code' && <span className="p-tag code">our code</span>}
        <b>{title}</b>
      </div>
      {children}
    </div>
  )
}

function Diamond({ text }: { text: string }) {
  return <div className="p-diamond"><span>{text}</span></div>
}

type Edge = { step: number; d: Pt[]; label?: string; labelAt?: Pt; tone?: 'yes' | 'no' }

function Edges({ edges, step }: { edges: Edge[]; step: number }) {
  return (
    <svg className="p-edges" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <marker id="p-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#1f2430" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const path = 'M' + e.d.map((p) => p.join(' ')).join(' L')
        const on = step >= e.step
        const mid = e.labelAt ?? e.d[Math.floor(e.d.length / 2)]
        return (
          <g key={i} className={`p-edge ${on ? 'on' : ''} ${e.tone ?? ''}`}>
            <path d={path} pathLength={1} markerEnd="url(#p-head)" />
            {e.label && <text x={mid[0]} y={mid[1] - 12} textAnchor="middle">{e.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

/* ---------- slides ---------- */

type Slide = { title: string; steps: number; render: (step: number, snap: Snapshot) => ReactNode }

const slides: Slide[] = [
  {
    title: 'Two views, one duck',
    steps: 4,
    render: (step) => (
      <>
        <Edges step={step} edges={[
          { step: 4, d: [[470, 320], [1130, 320]], label: 'a friend sends a duck 🦆', labelAt: [800, 320] },
          { step: 4, d: [[1130, 680], [470, 680]], label: 'you reply with a selfie 📸', labelAt: [800, 680] },
        ]} />
        <Node at={[120, 150]} step={1} className="p-col">
          <h3>Friend view <code>/friend</code></h3>
          <Phone height={520} />
          <p>any phone, just a link</p>
        </Node>
        <Node at={[1150, 150]} step={2} className="p-col">
          <h3>Tank view <code>/</code></h3>
          <MiniTank bottle={false} height={520} />
          <p>always on, no buttons</p>
        </Node>
        <Node at={[600, 400]} step={3} className="p-models">
          <span className="p-tag meta">Muse Spark</span>
          <span className="p-tag meta">Muse Image</span>
          <span className="p-tag meta">Muse Voice Transcribe</span>
          <span className="p-tag meta">SAM 3.1</span>
        </Node>
      </>
    ),
  },
  {
    title: 'A friend sends a duck',
    steps: 7,
    render: (step, s) => (
      <>
        <Edges step={step} edges={[
          { step: 2, d: [[230, 230], [290, 230], [290, 400], [330, 400]] },
          { step: 2, d: [[230, 650], [290, 650], [290, 480], [330, 480]] },
          { step: 3, d: [[560, 440], [700, 440]] },
          { step: 4, d: [[980, 400], [1020, 400], [1020, 230], [1050, 230]] },
          { step: 5, d: [[980, 480], [1020, 480], [1020, 660], [1050, 660]] },
          { step: 6, d: [[610, 790], [1190, 790], [1190, 735]] },
          { step: 7, d: [[1340, 230], [1430, 230], [1430, 330]] },
          { step: 7, d: [[1340, 660], [1430, 660], [1430, 600]] },
        ]} />
        <Node at={[30, 70]} step={1} className="p-col sm">
          <h4>tank opens <code>/</code></h4>
          <MiniTank bottle={false} height={240} />
        </Node>
        <Node at={[30, 470]} step={1} className="p-col sm">
          <h4>friend opens <code>/friend</code></h4>
          <Phone height={340} />
        </Node>
        <Node at={[330, 300]} step={2}>
          <Box title="draws + writes">
            <img className="p-img" src={s.draft.composite} alt="" />
            <div className="p-quote">“{s.draft.message}”</div>
          </Box>
        </Node>
        <Node at={[585, 395]} step={3} className="p-onedge">
          <img src={s.draft.doodle} alt="" />
        </Node>
        <Node at={[700, 330]} step={3}>
          <Box title="Muse Spark" tag="meta">
            <ul>
              <li>looks at duck + drawing</li>
              <li><b>writes the animation</b> as CSS</li>
              <li>places the drawing, writes the bubble</li>
            </ul>
            <small>{(s.draft.timings.spark_ms / 1000).toFixed(1)} s</small>
          </Box>
        </Node>
        <Node at={[1050, 80]} step={4}>
          <Box title="CSS sanitizer" tag="code">
            <pre className="p-code">{s.draft.css.split('\n').filter((l) => l.startsWith('[')).slice(0, 3).join('\n')}</pre>
            <small>✓ no url() · no scripts · no infinite loops</small>
          </Box>
        </Node>
        <Node at={[1050, 540]} step={5}>
          <Box title="Muse Image" tag="meta">
            <div className="p-row">
              <img className="p-thumb" src={s.draft.doodle} alt="" />
              <span>→</span>
              <img className="p-thumb" src={s.draft.accessory_raw} alt="" />
              <span>→</span>
              <QualityOutput snap={s} />
            </div>
            <small>redraw · chroma key · {(s.draft.timings.image_ms / 1000).toFixed(1)} s</small>
          </Box>
        </Node>
        <Node at={[330, 700]} step={6}>
          <Box title="picks the quality">
            <QualitySlider snap={s} />
          </Box>
        </Node>
        <Node at={[1340, 340]} step={7} className="p-col sm">
          <GenDuck snap={s} size={200} />
          <h4>🍾 waits in the tank</h4>
        </Node>
      </>
    ),
  },
  {
    title: 'Somebody looks at the tank',
    steps: 7,
    render: (step, s) => (
      <>
        <Edges step={step} edges={[
          { step: 2, d: [[250, 450], [300, 450]] },
          { step: 3, d: [[400, 350], [400, 190], [480, 190]], label: 'yes', labelAt: [430, 270], tone: 'yes' },
          { step: 4, d: [[800, 190], [900, 190]] },
          { step: 5, d: [[500, 450], [600, 450]], label: 'no', labelAt: [550, 450], tone: 'no' },
          { step: 6, d: [[700, 550], [700, 760], [760, 760]], label: 'no', labelAt: [730, 660], tone: 'no' },
          { step: 7, d: [[800, 450], [880, 450]], label: 'yes', labelAt: [840, 450], tone: 'yes' },
          { step: 7, d: [[1130, 450], [1180, 450]] },
          { step: 7, d: [[1390, 450], [1420, 450], [1420, 560]] },
        ]} />
        <Node at={[40, 360]} step={1} className="p-col">
          <div className="p-eyes">👀</div>
          <h4>somebody looks<br />at the tank</h4>
        </Node>
        <Node at={[300, 350]} step={2}><Diamond text="holding something up?" /></Node>
        <Node at={[480, 60]} step={3}>
          <Box title="SAM 3.1 + Muse Spark" tag="local">
            <div className="p-row">
              <img className="p-thumb tall" src={s.showtell.cutout} alt="" />
              <ul>
                <li>SAM cuts the object out</li>
                <li>Spark names it + invents a gag</li>
              </ul>
            </div>
          </Box>
        </Node>
        <Node at={[900, 30]} step={4} className="p-col sm">
          <PerfDuck perf={s.showtell.performance} held={s.showtell.cutout} size={240} />
          <h4>the duck plays with it</h4>
        </Node>
        <Node at={[600, 350]} step={5}><Diamond text="message waiting?" /></Node>
        <Node at={[770, 680]} step={6} className="p-col sm p-side">
          <PerfDuck perf={NO} size={150} />
        </Node>
        <Node at={[890, 320]} step={7} className="p-col sm">
          <GenDuck snap={s} size={200} />
          <h4>performs the friend's duck</h4>
        </Node>
        <Node at={[1180, 360]} step={7}>
          <div className="p-card"><b>Hi:</b><p>“{s.draft.message}”</p></div>
        </Node>
        <Node at={[1300, 560]} step={7} className="p-col sm">
          <img className="p-selfie" src="/presentation/reply.jpg" alt="" />
          <h4>📸 selfie → back to <code>/friend</code></h4>
        </Node>
      </>
    ),
  },
]

export default function Presentation() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [pos, setPos] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    return { slide: Math.max(0, Number(q.get('s') ?? 1) - 1), step: Math.max(1, Number(q.get('k') ?? 1)) }
  })
  const [scale, setScale] = useState(1)

  useEffect(() => {
    fetch('/presentation/data.json', { cache: 'no-store' }).then((r) => r.json()).then((d: Snapshot) => setSnap({ ...d, quality: d.quality ?? [] }))
  }, [])

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const next = () => setPos((p) => p.step < slides[p.slide].steps ? { ...p, step: p.step + 1 }
      : p.slide < slides.length - 1 ? { slide: p.slide + 1, step: 1 } : p)
    const prev = () => setPos((p) => p.step > 1 ? { ...p, step: p.step - 1 }
      : p.slide > 0 ? { slide: p.slide - 1, step: slides[p.slide - 1].steps } : p)
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); next() }
      if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', next)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', next)
    }
  }, [])

  // iframes steal keyboard focus; pull it back
  useEffect(() => {
    const t = setInterval(() => { if (document.activeElement?.tagName === 'IFRAME') window.focus() }, 300)
    return () => clearInterval(t)
  }, [])

  if (!snap) return null
  const slide = slides[pos.slide]
  return (
    <div className="p-root">
      <div className="p-canvas" style={{ width: W, height: H, transform: `scale(${scale})` }}
        key={pos.slide}>
        <h2 className="p-title">{slide.title}</h2>
        <StepCtx.Provider value={pos.step}>
          <div className="p-layer">{slide.render(pos.step, snap)}</div>
        </StepCtx.Provider>
        <div className="p-dots">
          {slides.map((_, i) => <i key={i} className={i === pos.slide ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  )
}
