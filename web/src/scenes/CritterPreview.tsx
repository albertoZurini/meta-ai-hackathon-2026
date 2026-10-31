import { useEffect, useRef } from 'react'
import { drawCritter, newCritter, stepCritter } from './creatures'
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
