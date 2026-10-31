import { useEffect, useRef } from 'react'
import { drawCritter, newCritter, stepCritter } from './creatures'
import { COLORS, drawFish, drawShark } from './FishCanvas'
import type { Fish, Shark } from './FishCanvas'
import type { CritterKind } from './creatures'

/** One creature alone on a small canvas (for the design gallery). */
export function CritterPreview({ kind, w = 240, h = 200 }: { kind: CritterKind; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    c.width = w * devicePixelRatio
    c.height = h * devicePixelRatio
    const box = { w, sand: h - 20 }
    const cr = newCritter(kind, box)
    cr.x = w / 2
    if (kind === 'seahorse' || kind === 'jellyfish') cr.y = h / 2
    cr.size *= 1.6
    let raf = 0
    let last = performance.now()
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      stepCritter(cr, dt, t, box)
      if (kind === 'jellyfish') cr.y = Math.min(Math.max(cr.y, h * 0.35), h * 0.6)
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#E8D3A2'
      ctx.fillRect(0, h - 20, w, 20)
      drawCritter(ctx, cr, t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [kind, w, h])
  return <canvas ref={ref} style={{ width: w, height: h, background: '#7CC4E8', borderRadius: 12 }} />
}

/** A few fish swimming back and forth (gallery). */
export function FishPreview({ w = 240, h = 200 }: { w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    c.width = w * devicePixelRatio
    c.height = h * devicePixelRatio
    const fish: Fish[] = COLORS.slice(0, 4).map((color, i) => ({
      x: 40 + i * 50, y: 40 + i * 35, vx: (i % 2 ? 1 : -1) * (20 + i * 6), size: 1.3 + (i % 2) * 0.4, color,
      phase: i, alive: true, respawnAt: 0, turnAt: 0,
    }))
    let raf = 0
    let last = performance.now()
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      for (const f of fish) {
        f.x += f.vx * dt
        if (f.x < 30 * f.size) { f.x = 30 * f.size; f.vx = Math.abs(f.vx) }
        if (f.x > w - 30 * f.size) { f.x = w - 30 * f.size; f.vx = -Math.abs(f.vx) }
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const f of fish) drawFish(ctx, f, t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [w, h])
  return <canvas ref={ref} style={{ width: w, height: h, background: '#7CC4E8', borderRadius: 12 }} />
}

/** The shark idling and chomping (gallery). Its world scale is 1.5, so it's drawn smaller here. */
export function SharkPreview({ w = 240, h = 200 }: { w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    c.width = w * devicePixelRatio
    c.height = h * devicePixelRatio
    const shark: Shark = {
      x: 0, y: 0, vx: -1, chomp: 0, active: true, nextAt: 0, phase: 0, eaten: 0,
      tongue: { state: 'idle', len: 0, prey: null },
    }
    let raf = 0
    let lastChomp = 0
    const frame = (t: number) => {
      if (t - lastChomp > 1600) {
        shark.chomp = 1
        lastChomp = t
      }
      shark.chomp = Math.max(0, shark.chomp - 0.03)
      shark.vx = Math.sin(t / 3000) > 0 ? -1 : 1 // turns around now and then
      ctx.setTransform(devicePixelRatio * 0.75, 0, 0, devicePixelRatio * 0.75, 0, 0)
      ctx.clearRect(0, 0, w / 0.75, h / 0.75)
      shark.x = w / 0.75 / 2
      shark.y = h / 0.75 / 2
      drawShark(ctx, shark, t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [w, h])
  return <canvas ref={ref} style={{ width: w, height: h, background: '#7CC4E8', borderRadius: 12 }} />
}
