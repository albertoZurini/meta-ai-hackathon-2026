import { useEffect, useRef } from 'react'
import { drawCritter, newCritter, POPULATION, stepCritter } from './creatures'
import type { Critter, CritterKind } from './creatures'

const W = 600
const H = 800
const INK = '#1F2430'
const COLORS = ['#FF8A3D', '#F2B705', '#E84A7F', '#8B5CF6', '#3FA36B', '#4FA3D1', '#F28C28']
const SWIM_TOP = 110
const SWIM_BOTTOM = 680

type Fish = {
  x: number; y: number; vx: number; size: number; color: string
  phase: number; alive: boolean; respawnAt: number; turnAt: number; caught?: boolean
}
type Tongue = { state: 'idle' | 'out' | 'back'; len: number; prey: Fish | null }
type Shark = {
  x: number; y: number; vx: number; chomp: number; active: boolean; nextAt: number; phase: number
  eaten: number; tongue: Tongue
}

const TONGUE_REACH = 170
const sharkBob = (t: number) => Math.sin(t / 900) * 6
/** World position of the shark's mouth (matches drawShark's geometry at scale 1.5). */
const mouthOf = (s: Shark, t: number) => ({ x: s.x + Math.sign(s.vx) * 84, y: s.y + sharkBob(t) + 7 })

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function newFish(now: number, fromEdge = false): Fish {
  const vx = rand(25, 55) * (Math.random() < 0.5 ? -1 : 1)
  return {
    x: fromEdge ? (vx > 0 ? -60 : W + 60) : rand(0, W),
    y: rand(SWIM_TOP, SWIM_BOTTOM),
    vx, size: rand(0.9, 1.7), color: COLORS[Math.floor(Math.random() * COLORS.length)],
    phase: rand(0, Math.PI * 2), alive: true, respawnAt: 0, turnAt: now + rand(8000, 20000),
  }
}

/** Outline first (thick), fill on top → one outline around the whole silhouette, no seams. */
function silhouette(ctx: CanvasRenderingContext2D, shapes: Path2D[], fill: string, lw = 3) {
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = lw * 2
  for (const s of shapes) ctx.stroke(s)
  ctx.fillStyle = fill
  for (const s of shapes) ctx.fill(s)
}

function drawFish(ctx: CanvasRenderingContext2D, f: Fish, t: number) {
  ctx.save()
  ctx.translate(f.x, f.y + Math.sin(t / 600 + f.phase) * 5)
  ctx.scale(f.size * (f.vx > 0 ? -1 : 1), f.size) // drawn facing left
  const wag = Math.sin(t / 150 + f.phase) * 3
  const body = new Path2D()
  body.ellipse(0, 0, 16, 9.5, 0, 0, Math.PI * 2)
  const tail = new Path2D()
  tail.moveTo(10, 0)
  tail.lineTo(28, -10 + wag)
  tail.quadraticCurveTo(24, wag, 28, 10 + wag)
  tail.closePath()
  silhouette(ctx, [body, tail], f.color, 1.6)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(-8, -2.5, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawShark(ctx: CanvasRenderingContext2D, s: Shark, t: number) {
  ctx.save()
  ctx.translate(s.x, s.y + sharkBob(t))
  ctx.scale(s.vx > 0 ? -1.5 : 1.5, 1.5) // drawn facing left
  const wag = Math.sin(t / 220) * 4
  const open = s.tongue.state !== 'idle' ? 12 : Math.max(0, Math.sin(s.chomp * Math.PI)) * 10

  const body = new Path2D()
  body.moveTo(-58, 0)
  body.quadraticCurveTo(-40, -22, 10, -20)
  body.quadraticCurveTo(40, -16, 56, -4)
  body.lineTo(56, 4)
  body.quadraticCurveTo(30, 18, 0, 18)
  body.quadraticCurveTo(-40, 18, -58, 4)
  body.closePath()
  const fin = new Path2D()
  fin.moveTo(-6, -18)
  fin.lineTo(10, -46)
  fin.quadraticCurveTo(16, -30, 22, -18)
  fin.closePath()
  const tail = new Path2D()
  tail.moveTo(50, 0)
  tail.lineTo(84, -30 + wag)
  tail.quadraticCurveTo(72, 0, 84, 28 + wag)
  tail.closePath()
  const flipper = new Path2D()
  flipper.moveTo(-14, 12)
  flipper.lineTo(-2, 32)
  flipper.lineTo(8, 14)
  flipper.closePath()
  silhouette(ctx, [body, fin, tail, flipper], '#8FA3B8', 2)

  // belly
  ctx.fillStyle = '#E6EEF5'
  ctx.beginPath()
  ctx.moveTo(-50, 6)
  ctx.quadraticCurveTo(-10, 18, 36, 8)
  ctx.quadraticCurveTo(-10, 12, -50, 6)
  ctx.fill()
  // mouth (opens while chomping)
  ctx.fillStyle = '#7F1D1D'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-56, 3)
  ctx.lineTo(-30, 6)
  ctx.lineTo(-56, 6 + open)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // teeth
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-52 + i * 7, 4)
    ctx.lineTo(-49 + i * 7, 8)
    ctx.lineTo(-46 + i * 7, 4)
    ctx.fill()
  }
  // eye + gills
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(-38, -6, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-22 + i * 5, -6)
    ctx.quadraticCurveTo(-24 + i * 5, 0, -22 + i * 5, 6)
    ctx.stroke()
  }
  ctx.restore()
}

/** Canvas layer with schooling fish and an occasional hungry shark (600×800 world). */
export function FishCanvas({ fishCount = 9, critters: withCritters = true }: { fishCount?: number; critters?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    let now = performance.now()
    const fish = Array.from({ length: fishCount }, () => newFish(now))
    const critters: Critter[] = withCritters
      ? (Object.entries(POPULATION) as [CritterKind, number][]).flatMap(([k, n]) => Array.from({ length: n }, () => newCritter(k)))
      : []
    const shark: Shark = {
      x: -200, y: 300, vx: 0, chomp: 0, active: false, nextAt: now + rand(6000, 12000), phase: 0,
      eaten: 0, tongue: { state: 'idle', len: 0, prey: null },
    }
    let raf = 0
    let last = now

    const resize = () => {
      const r = c.getBoundingClientRect()
      c.width = Math.round(r.width * devicePixelRatio)
      c.height = Math.round(r.height * devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(c)

    // Fixed-step simulation so it stays correct even when frames are throttled.
    const frame = (t: number) => {
      const elapsed = Math.min((t - last) / 1000, 3)
      const steps = Math.max(1, Math.ceil(elapsed / 0.033))
      for (let i = 1; i <= steps; i++) step(last + ((t - last) * i) / steps, elapsed / steps)
      last = t
      draw(t)
      raf = requestAnimationFrame(frame)
    }

    const step = (t: number, dt: number) => {
      now = t

      // --- shark ---
      if (!shark.active && t > shark.nextAt) {
        const alive = fish.filter((f) => f.alive)
        if (alive.length) {
          // Always lock onto one fish so every visit eats at least one.
          const prey = alive[Math.floor(Math.random() * alive.length)]
          const dir = Math.random() < 0.5 ? 1 : -1
          Object.assign(shark, {
            active: true, vx: 150 * dir, x: dir > 0 ? -170 : W + 170, y: prey.y - 7, chomp: 0, eaten: 0,
            tongue: { state: 'idle', len: 0, prey: null },
          })
        } else {
          shark.nextAt = t + 5000
        }
      }
      if (shark.active) {
        const tg = shark.tongue
        // Slow down while using the tongue, then carry on.
        shark.x += shark.vx * dt * (tg.state === 'idle' ? 1 : 0.35)
        if (shark.chomp > 0) shark.chomp = Math.max(0, shark.chomp - dt * 3)
        const dir = Math.sign(shark.vx)
        const mouth = mouthOf(shark, t)
        const crossed = dir > 0 ? shark.x / W : 1 - shark.x / W

        if (tg.state === 'idle') {
          // Steer toward the nearest fish ahead; shoot the tongue when one is within reach.
          let target: Fish | null = null
          let best = Infinity
          for (const f of fish) {
            if (!f.alive || f.caught) continue
            const ahead = (f.x - mouth.x) * dir
            const d = Math.hypot(f.x - mouth.x, f.y - mouth.y)
            if (ahead > -20 && d < best) {
              best = d
              target = f
            }
          }
          if (target) shark.y += Math.max(-80, Math.min(80, (target.y - mouth.y) * 2)) * dt
          // Reach grows if nothing has been eaten yet and the shark is about to leave: always one fish.
          const reach = shark.eaten === 0 && crossed > 0.6 ? 2000 : TONGUE_REACH
          if (target && best < reach) {
            target.caught = true
            Object.assign(tg, { state: 'out', len: 0, prey: target })
          }
        } else if (tg.prey) {
          const prey = tg.prey
          const dist = Math.hypot(prey.x - mouth.x, prey.y - mouth.y)
          if (tg.state === 'out') {
            tg.len += 900 * dt
            if (tg.len >= dist) {
              tg.len = dist
              tg.state = 'back'
            }
          } else {
            tg.len = Math.max(0, tg.len - 520 * dt)
            // Reel the fish in along the tongue.
            const k = dist > 0 ? tg.len / dist : 0
            prey.x = mouth.x + (prey.x - mouth.x) * k
            prey.y = mouth.y + (prey.y - mouth.y) * k
            if (tg.len <= 2) {
              prey.alive = false
              prey.caught = false
              prey.respawnAt = t + rand(6000, 12000)
              shark.chomp = 1
              shark.eaten++
              Object.assign(tg, { state: 'idle', len: 0, prey: null })
            }
          }
        }
        if (shark.x < -240 || shark.x > W + 240) {
          shark.active = false
          shark.nextAt = t + rand(15000, 35000)
        }
      }

      for (const cr of critters) stepCritter(cr, dt, t)

      // --- fish ---
      for (const [i, f] of fish.entries()) {
        if (!f.alive) {
          if (t > f.respawnAt) fish[i] = newFish(t, true)
          continue
        }
        if (f.caught) continue // stuck on the tongue
        // Flee a bit when the shark is close and coming toward them.
        let speed = f.vx
        if (shark.active && Math.abs(f.y - shark.y) < 90 && Math.abs(f.x - shark.x) < 220) {
          f.y += Math.sign(f.y - shark.y || 1) * 40 * dt
          speed *= 1.8
        }
        f.x += speed * dt
        f.y = Math.min(Math.max(f.y, SWIM_TOP), SWIM_BOTTOM)
        if (t > f.turnAt && f.x > 40 && f.x < W - 40) {
          f.vx = -f.vx
          f.turnAt = t + rand(8000, 20000)
        }
        if (f.x < -80) f.x = W + 70
        if (f.x > W + 80) f.x = -70
      }

    }

    const draw = (t: number) => {
      ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // Jellyfish drift behind the fish; bottom dwellers and seahorses in front.
      for (const cr of critters) if (cr.kind === 'jellyfish') drawCritter(ctx, cr, t)
      for (const f of fish) if (f.alive && !f.caught) drawFish(ctx, f, t)
      for (const cr of critters) if (cr.kind !== 'jellyfish') drawCritter(ctx, cr, t)
      if (shark.active) {
        const tg = shark.tongue
        if (tg.state !== 'idle' && tg.prey) {
          // Frog tongue: pink line from the mouth toward the prey, sticky tip.
          const m = mouthOf(shark, t)
          const dx = tg.prey.x - m.x, dy = tg.prey.y - m.y
          const d = Math.hypot(dx, dy) || 1
          const tipX = m.x + (dx / d) * tg.len, tipY = m.y + (dy / d) * tg.len
          ctx.lineCap = 'round'
          ctx.strokeStyle = INK
          ctx.lineWidth = 11
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tipX, tipY); ctx.stroke()
          ctx.strokeStyle = '#F472B6'
          ctx.lineWidth = 6
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tipX, tipY); ctx.stroke()
          ctx.fillStyle = '#F472B6'
          ctx.strokeStyle = INK
          ctx.lineWidth = 2.5
          ctx.beginPath(); ctx.arc(tipX, tipY, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          drawFish(ctx, tg.prey, t)
        }
        drawShark(ctx, shark, t)
      }
    }
    raf = requestAnimationFrame(frame)
    // K summons the shark (handy for filming the demo).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && !shark.active) shark.nextAt = 0
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
    }
  }, [fishCount, withCritters])

  return <canvas ref={canvas} className="layer" />
}
