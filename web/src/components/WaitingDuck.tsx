import { useEffect, useRef, useState } from 'react'
import { Duck } from '../duck/Duck'
import { play } from '../duck/player'
import type { Accessory, Performance } from '../duck/types'

/** Fun waiting screen while Muse Spark + Muse Image work (~30–40 s). */

const svg = (inner: string, vb: string) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`)
const O = 'stroke="#1F2430" stroke-width="4" stroke-linejoin="round"'

// Outfits the duck "tries on" while waiting (same style as the gallery accessories).
const OUTFITS: Accessory[] = [
  { slot: 'hat', bbox: { x: 98, y: 0, w: 52, h: 44 }, url: svg(`<path d="M26 4 L48 40 L4 40 Z" fill="#EC4899" ${O}/><circle cx="26" cy="5" r="4" fill="#FFD23F" ${O}/>`, '0 0 52 44') },
  { slot: 'hat', bbox: { x: 92, y: 4, w: 64, h: 36 }, url: svg(`<rect x="14" y="2" width="36" height="26" rx="3" fill="#1F2430"/><rect x="2" y="26" width="60" height="8" rx="4" fill="#1F2430"/><rect x="14" y="20" width="36" height="5" fill="#E4572E"/>`, '0 0 64 36') },
  { slot: 'face', bbox: { x: 112, y: 46, w: 50, h: 22 }, url: svg(`<circle cx="12" cy="11" r="9" fill="#1F2430"/><circle cx="38" cy="11" r="9" fill="#1F2430"/><path d="M21 11 H29" ${O}/>`, '0 0 50 22') },
  { slot: 'neck', bbox: { x: 100, y: 98, w: 40, h: 22 }, url: svg(`<path d="M2 2 L20 11 L2 20 Z M38 2 L20 11 L38 20 Z" fill="#4FA3D1" ${O}/>`, '0 0 40 22') },
  { slot: 'hat', bbox: { x: 94, y: 2, w: 60, h: 40 }, url: svg(`<path d="M6 36 L10 8 L22 24 L30 4 L38 24 L50 8 L54 36 Z" fill="#F2B705" ${O}/>`, '0 0 60 40') },
  { slot: 'back', bbox: { x: 30, y: 100, w: 70, h: 70 }, url: svg(`<path d="M10 4 L90 4 L80 96 L20 96 Z" fill="#7C3AED" ${O}/>`, '0 0 100 100') },
]

const LINES = [
  'The duck is getting dressed… 🦆',
  'Muse Spark is studying your masterpiece 🧐',
  'Deciding where on the duck it goes…',
  'Ironing the feathers 🪶',
  'Muse Image is painting it ✨',
  'Rehearsing a dance move 💃',
  'Checking the CSS compiles (it usually does) 🤞',
  'Removing the green screen 🟩',
  'Almost there… polishing the beak',
]

const TRY_ON: Performance = {
  title: 'Try on', duration_ms: 1400, props: [], bubble: [],
  tracks: [
    { target: 'duck', keyframes: [{ t: 0, rotate: 0, scaleX: 1 }, { t: 0.25, scaleX: 0.1 }, { t: 0.5, scaleX: 1, rotate: 0 }, { t: 0.75, rotate: -6 }, { t: 1, rotate: 0 }] },
    { target: 'wing', keyframes: [{ t: 0, rotate: 0 }, { t: 0.6, rotate: -40 }, { t: 1, rotate: 0 }] },
  ],
}

export function WaitingDuck({ expectedMs = 37000 }: { expectedMs?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [outfit, setOutfit] = useState(0)
  const [line, setLine] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    let alive = true
    ;(async () => {
      while (alive) {
        if (ref.current) {
          const p = play(ref.current, TRY_ON)
          setTimeout(() => alive && setOutfit((o) => (o + 1 + Math.floor(Math.random() * (OUTFITS.length - 1))) % OUTFITS.length), 350)
          await p
        }
        await new Promise((r) => setTimeout(r, 600))
      }
    })()
    const lines = setInterval(() => setLine((l) => (l + 1) % LINES.length), 3500)
    const clock = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => {
      alive = false
      clearInterval(lines)
      clearInterval(clock)
    }
  }, [])

  // Eases toward 95% over the expected time, never "done" until the real answer arrives.
  const progress = 95 * (1 - Math.exp((-2.2 * elapsed) / expectedMs))

  return (
    <section className="panel waiting">
      <div className="booth">
        <div className="curtain left" />
        <div className="booth-duck"><Duck ref={ref} accessories={[OUTFITS[outfit]]} /></div>
        <div className="curtain right" />
      </div>
      <p className="waiting-line" key={line}>{LINES[line]}</p>
      <div className="waiting-bar"><span style={{ width: `${progress}%` }} /></div>
      <p className="hint">{Math.floor(elapsed / 1000)} s · AI ducks take about half a minute</p>
    </section>
  )
}
