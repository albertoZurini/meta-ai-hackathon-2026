/**
 * Extra marine life for the aquarium canvas (600×800 world): seahorses, jellyfish, shrimps, octopuses.
 * Same look as the fish: flat fills, one ink outline around the whole silhouette.
 */

const INK = '#1F2430'
const W = 600
const SAND_Y = 722

export type CritterKind = 'seahorse' | 'jellyfish' | 'shrimp' | 'octopus'

export type Critter = {
  kind: CritterKind
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  phase: number
  state: number // kind-specific timer/state
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Horizontal safety margin per creature (≈ half its drawn width + room for tentacles/antennae). */
const MARGIN: Record<CritterKind, number> = { seahorse: 45, jellyfish: 45, shrimp: 60, octopus: 60 }

/**
 * Keep a creature inside [margin, w - margin] and make it head back toward the middle.
 * (Flipping vx at the edge isn't enough: if it's already past the line it flips every frame and jitters.)
 */
function keepInside(c: Critter, w: number) {
  const m = Math.min(MARGIN[c.kind] * c.size, w / 2 - 1)
  if (c.x < m) {
    c.x = m
    c.vx = Math.abs(c.vx)
  } else if (c.x > w - m) {
    c.x = w - m
    c.vx = -Math.abs(c.vx)
  }
}
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** How many of each to spawn (fish stay the most common: see FishCanvas). */
export const POPULATION: Record<CritterKind, number> = { seahorse: 2, jellyfish: 2, shrimp: 2, octopus: 1 }

export function newCritter(kind: CritterKind, box = { w: W, sand: SAND_Y }): Critter {
  const base = { kind, phase: rand(0, Math.PI * 2), state: 0, vy: 0 }
  const m = Math.min(MARGIN[kind] + 20, box.w / 2 - 1)
  const x = rand(m, box.w - m)
  switch (kind) {
    case 'seahorse':
      return { ...base, x, y: rand(250, 600), vx: rand(6, 14) * pick([-1, 1]), size: rand(0.9, 1.2),
        color: pick(['#F2B705', '#FF8A3D', '#F472B6']) }
    case 'jellyfish':
      return { ...base, x, y: rand(150, 500), vx: rand(-6, 6), size: rand(0.9, 1.3),
        color: pick(['#F9A8D4', '#C4B5FD', '#A5F3FC']) }
    case 'shrimp':
      return { ...base, x, y: box.sand - 4, vx: rand(15, 30) * pick([-1, 1]), size: rand(0.8, 1.1),
        color: '#FB7185', state: rand(1, 4) }
    case 'octopus':
      return { ...base, x, y: box.sand - 26, vx: 10 * pick([-1, 1]), size: 1.1,
        color: pick(['#8B5CF6', '#E4572E']), state: rand(8, 16) }
  }
}

/** Advance one critter by dt seconds (t = ms clock). */
export function stepCritter(c: Critter, dt: number, t: number, box = { w: W, sand: SAND_Y }) {
  switch (c.kind) {
    case 'seahorse':
      // Slow upright drift, gentle bobbing, turns around at the edges.
      c.x += c.vx * dt
      c.y += Math.sin(t / 900 + c.phase) * 8 * dt
      break
    case 'jellyfish': {
      // Pulse: push up while the bell contracts, then sink slowly.
      const pulse = Math.sin(t / 700 + c.phase)
      c.y += (pulse > 0.6 ? -55 : 9) * dt
      c.x += c.vx * dt
      if (c.y < 120) c.y = 120
      if (c.y > box.sand - 120) c.y = box.sand - 120
      break
    }
    case 'shrimp':
      // Scuttle along the sand, stop, sometimes flick backwards.
      c.state -= dt
      if (c.state > 0.8) c.x += c.vx * dt
      else if (c.state > 0.6) c.x -= c.vx * 4 * dt // tail flick
      if (c.state <= 0) {
        c.state = rand(1.5, 4)
        if (Math.random() < 0.4) c.vx = -c.vx
      }
      c.y = box.sand - 4
      break
    case 'octopus':
      // Crawls on the sand; every so often jets up and floats back down.
      c.state -= dt
      if (c.vy === 0) {
        c.x += c.vx * dt
        if (c.state <= 0) c.vy = -150
      } else {
        c.vy += 60 * dt
        c.y += c.vy * dt
        c.x += c.vx * 3 * dt
        if (c.y >= box.sand - 26) {
          c.y = box.sand - 26
          c.vy = 0
          c.state = rand(10, 20)
        }
      }
      break
  }
  keepInside(c, box.w)
}

function outline(ctx: CanvasRenderingContext2D, shapes: Path2D[], fill: string, lw: number) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = lw * 2
  for (const s of shapes) ctx.stroke(s)
  ctx.fillStyle = fill
  for (const s of shapes) ctx.fill(s)
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.2) {
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function drawCritter(ctx: CanvasRenderingContext2D, c: Critter, t: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  const flip = c.vx > 0 ? -1 : 1 // all drawn facing left
  ctx.scale(c.size * flip, c.size)
  switch (c.kind) {
    case 'seahorse': drawSeahorse(ctx, c, t); break
    case 'jellyfish': ctx.scale(flip, 1); drawJellyfish(ctx, c, t); break
    case 'shrimp': drawShrimp(ctx, c, t); break
    case 'octopus': drawOctopus(ctx, c, t); break
  }
  ctx.restore()
}

function drawSeahorse(ctx: CanvasRenderingContext2D, c: Critter, t: number) {
  const fin = Math.sin(t / 90 + c.phase) * 3
  const body = new Path2D()
  // head + snout (left), belly, curly tail
  body.moveTo(-6, -30)
  body.quadraticCurveTo(-14, -34, -24, -30) // snout top
  body.lineTo(-24, -25)
  body.quadraticCurveTo(-14, -24, -10, -20) // snout bottom → chin
  body.quadraticCurveTo(-16, -6, -10, 8) // belly
  body.quadraticCurveTo(-6, 18, 2, 22)
  body.quadraticCurveTo(12, 26, 10, 34) // tail down
  body.quadraticCurveTo(6, 42, -2, 38) // curl
  body.quadraticCurveTo(-6, 34, -1, 32)
  body.quadraticCurveTo(4, 32, 4, 28)
  body.quadraticCurveTo(-2, 22, 6, 12) // back of tail
  body.quadraticCurveTo(12, -4, 6, -18) // back
  body.quadraticCurveTo(4, -28, -6, -30)
  body.closePath()
  const dorsal = new Path2D()
  dorsal.moveTo(8, -6)
  dorsal.quadraticCurveTo(18 + fin, -2, 10, 8)
  dorsal.closePath()
  const crown = new Path2D()
  crown.moveTo(-6, -30)
  crown.lineTo(-2, -38)
  crown.lineTo(2, -30)
  crown.closePath()
  outline(ctx, [dorsal, crown, body], c.color, 1.6)
  // belly ridges
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-12 + i, -4 + i * 6)
    ctx.lineTo(-6 + i, -4 + i * 6)
    ctx.stroke()
  }
  eye(ctx, -9, -26)
}

function drawJellyfish(ctx: CanvasRenderingContext2D, c: Critter, t: number) {
  const pulse = Math.sin(t / 700 + c.phase)
  const squeeze = pulse > 0.6 ? 0.82 : 1
  // tentacles first (behind the bell)
  ctx.strokeStyle = INK
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const x0 = -12 + i * 8
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x0, 4)
    for (let k = 1; k <= 4; k++) {
      ctx.lineTo(x0 + Math.sin(t / 300 + i + k + c.phase) * 4, 4 + k * 9)
    }
    ctx.stroke()
    ctx.lineWidth = 2.4
    ctx.strokeStyle = c.color
    ctx.stroke()
    ctx.strokeStyle = INK
  }
  ctx.save()
  ctx.scale(1 / squeeze, squeeze)
  const bell = new Path2D()
  bell.moveTo(-22, 6)
  bell.quadraticCurveTo(-24, -24, 0, -26)
  bell.quadraticCurveTo(24, -24, 22, 6)
  bell.quadraticCurveTo(16, 2, 11, 6)
  bell.quadraticCurveTo(5, 2, 0, 6)
  bell.quadraticCurveTo(-5, 2, -11, 6)
  bell.quadraticCurveTo(-16, 2, -22, 6)
  bell.closePath()
  ctx.globalAlpha = 0.92
  outline(ctx, [bell], c.color, 1.6)
  ctx.globalAlpha = 1
  // shine + face
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(-6, -12, 9, Math.PI * 1.1, Math.PI * 1.5)
  ctx.stroke()
  eye(ctx, -6, -6, 1.8)
  eye(ctx, 6, -6, 1.8)
  ctx.restore()
}

function drawShrimp(ctx: CanvasRenderingContext2D, c: Critter, t: number) {
  const walk = c.state > 0.8 ? Math.sin(t / 60) * 2 : 0
  const body = new Path2D()
  // curved segmented body, head left, tail fan right
  body.moveTo(-16, -6)
  body.quadraticCurveTo(-4, -16, 10, -10)
  body.quadraticCurveTo(18, -6, 18, 2)
  body.lineTo(26, -2)
  body.lineTo(26, 8)
  body.lineTo(18, 6)
  body.quadraticCurveTo(8, 4, 0, 2)
  body.quadraticCurveTo(-10, 2, -16, -6)
  body.closePath()
  outline(ctx, [body], c.color, 1.4)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  for (const x of [-2, 5, 12]) {
    ctx.beginPath()
    ctx.moveTo(x, -11 + Math.abs(x) / 6)
    ctx.lineTo(x - 1, 2)
    ctx.stroke()
  }
  // legs + antennae
  ctx.lineWidth = 1.6
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-8 + i * 5, 2)
    ctx.lineTo(-9 + i * 5 + (i % 2 ? walk : -walk), 8)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-15, -7)
  ctx.quadraticCurveTo(-26, -20, -34, -14 + Math.sin(t / 200) * 2)
  ctx.moveTo(-15, -6)
  ctx.quadraticCurveTo(-28, -12, -36, -4 + Math.sin(t / 240) * 2)
  ctx.stroke()
  eye(ctx, -11, -8, 1.8)
}

function drawOctopus(ctx: CanvasRenderingContext2D, c: Critter, t: number) {
  const shapes: Path2D[] = []
  // 6 visible tentacles (wiggle more while jetting)
  const amp = c.vy !== 0 ? 6 : 3
  for (let i = 0; i < 6; i++) {
    const x0 = -20 + i * 8
    const p = new Path2D()
    const w1 = Math.sin(t / 250 + i * 0.9 + c.phase) * amp
    const w2 = Math.sin(t / 250 + i * 0.9 + c.phase + 1.2) * amp
    p.moveTo(x0 - 3.5, 0)
    p.quadraticCurveTo(x0 - 3 + w1, 14, x0 + w2 - 6, 24)
    p.quadraticCurveTo(x0 + w2 - 1, 26, x0 + 3.5, 0)
    p.closePath()
    shapes.push(p)
  }
  const head = new Path2D()
  head.ellipse(0, -12, 22, 20, 0, 0, Math.PI * 2)
  outline(ctx, [...shapes, head], c.color, 1.6)
  // suckers + face
  ctx.fillStyle = '#FDE68A'
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.arc(-20 + i * 8, 12, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  eye(ctx, -8, -12, 3)
  eye(ctx, 6, -12, 3)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.arc(-1, -4, 4, 0.2 * Math.PI, 0.8 * Math.PI)
  ctx.stroke()
}
