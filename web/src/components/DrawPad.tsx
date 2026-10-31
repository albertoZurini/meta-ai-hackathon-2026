import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Duck } from '../duck/Duck'
import type { BBox } from '../duck/types'

export const COLORS = ['#7C3AED', '#EC4899', '#E4572E', '#F28C28', '#3FA36B', '#4FA3D1', '#1F2430', '#FFFFFF']
export const SIZES = [4, 8, 14]

export type Stroke = { color: string; size: number; pts: [number, number][] } // duck units (0–200)

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number, clear = true) {
  if (clear) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.size * scale
    ctx.beginPath()
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)))
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * scale + 0.1, s.pts[0][1] * scale)
    ctx.stroke()
  }
}

export function strokesBBox(strokes: Stroke[]): BBox | null {
  if (!strokes.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of strokes) for (const [x, y] of s.pts) {
    x0 = Math.min(x0, x - s.size); y0 = Math.min(y0, y - s.size)
    x1 = Math.max(x1, x + s.size); y1 = Math.max(y1, y + s.size)
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0))
  x1 = Math.min(200, Math.ceil(x1)); y1 = Math.min(200, Math.ceil(y1))
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))

/** Full-frame drawing (transparent, 800×800) + its bbox in duck units + duck-with-drawing composite. */
export async function exportDrawing(strokes: Stroke[]): Promise<{ doodle: Blob; composite: Blob; bbox: BBox } | null> {
  const bbox = strokesBBox(strokes)
  if (!bbox) return null
  const S = 4
  const c = document.createElement('canvas')
  c.width = c.height = 200 * S
  drawStrokes(c.getContext('2d')!, strokes, S)
  const doodle = await toBlob(c)

  // Composite: the duck (rendered from the real component) + the drawing on top, on the porthole blue.
  const svg = renderToStaticMarkup(<Duck />).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"')
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const comp = document.createElement('canvas')
  comp.width = comp.height = 200 * S
  const ctx = comp.getContext('2d')!
  ctx.fillStyle = '#BFE6FF'
  ctx.fillRect(0, 0, comp.width, comp.height)
  ctx.drawImage(img, 0, 0, comp.width, comp.height)
  drawStrokes(ctx, strokes, S, false)
  return { doodle, composite: await toBlob(comp), bbox }
}

/** Duck with a drawing canvas on top. Controlled: the parent owns the strokes. */
export function DrawPad({ strokes, onChange, color, size, filter }: {
  strokes: Stroke[]; onChange: (s: Stroke[]) => void; color: string; size: number; filter?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)

  const redraw = useCallback((list: Stroke[]) => {
    const c = canvas.current
    if (c) drawStrokes(c.getContext('2d')!, list, c.width / 200)
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const fit = () => {
      c.width = c.height = Math.round(c.getBoundingClientRect().width * devicePixelRatio)
      redraw(strokes)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [redraw, strokes])

  const toDuck = (e: RPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 200]
  }

  return (
    <div className="draw-area">
      <Duck className="draw-duck" />
      <canvas ref={canvas} className="draw-canvas" style={filter ? { filter } : undefined}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = { color, size, pts: [toDuck(e)] }
          redraw([...strokes, drawing.current])
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          drawing.current.pts.push(toDuck(e))
          redraw([...strokes, drawing.current])
        }}
        onPointerUp={() => {
          const done = drawing.current
          drawing.current = null
          if (done) onChange([...strokes, done])
        }}
        onPointerCancel={() => (drawing.current = null)} />
    </div>
  )
}

/** Color / size / undo / clear toolbar. */
export function DrawTools({ color, setColor, size, setSize, strokes, onChange }: {
  color: string; setColor: (c: string) => void; size: number; setSize: (s: number) => void
  strokes: Stroke[]; onChange: (s: Stroke[]) => void
}) {
  return (
    <div className="tools">
      {COLORS.map((c) => (
        <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }}
          onClick={() => setColor(c)} aria-label={c} />
      ))}
      <span className="sep" />
      {SIZES.map((s) => (
        <button key={s} className={`size ${s === size ? 'on' : ''}`} onClick={() => setSize(s)}>
          <span style={{ width: s + 2, height: s + 2 }} />
        </button>
      ))}
      <span className="sep" />
      <button className="ghost small" onClick={() => onChange(strokes.slice(0, -1))}>↶ Undo</button>
      <button className="ghost small" onClick={() => onChange([])}>Clear</button>
    </div>
  )
}

/** "Drawn by a 5-year-old ↔ photo" labels (matches quality_style() in the backend). */
export const QUALITY = [
  { at: 0, icon: '🖍️', label: 'Drawn by a 5-year-old' },
  { at: 0.25, icon: '🖊️', label: 'Kid with markers' },
  { at: 0.5, icon: '🦆', label: 'Duck cartoon' },
  { at: 0.72, icon: '🎨', label: 'Fancy illustration' },
  { at: 0.92, icon: '📷', label: 'Basically a photo' },
]
export const qualityLabel = (q: number) => [...QUALITY].reverse().find((s) => q >= s.at - 0.08) ?? QUALITY[0]

export function QualitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const l = qualityLabel(value)
  return (
    <div className="quality">
      <div className="quality-head">
        <span>How good should the AI make it?</span>
        <b>{l.icon} {l.label}</b>
      </div>
      <input type="range" min={0} max={1} step={0.001} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label="Drawing quality" />
      <div className="quality-ends"><span>🖍️ 5-year-old</span><span>📷 photo</span></div>
    </div>
  )
}
