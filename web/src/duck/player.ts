import type { Keyframe, Performance } from './types'

function transform(k: Keyframe): string {
  const sx = k.scaleX ?? k.scale ?? 1
  const sy = k.scaleY ?? k.scale ?? 1
  return `translate(${k.translateX ?? 0}px, ${k.translateY ?? 0}px) rotate(${k.rotate ?? 0}deg) scale(${sx}, ${sy})`
}

export type PlayOptions = {
  onBubble?: (text: string | null) => void
  /** Keep the final pose (used for scene reactions like thumbs up). */
  hold?: boolean
}

/** Play a performance on a Duck SVG. Resolves when finished. */
export function play(svg: SVGSVGElement, perf: Performance, opts: PlayOptions = {}): Promise<void> {
  const total = Math.min(Math.max(perf.duration_ms || 3000, 1000), 12000)
  const animations: Animation[] = []
  for (const track of perf.tracks) {
    const el = svg.querySelector<SVGGElement>(`[data-part="${CSS.escape(track.target)}"]`)
    if (!el || !track.keyframes?.length) continue
    const iterations = Math.max(1, Math.min(track.iterations ?? 1, 20))
    const frames = [...track.keyframes]
      .sort((a, b) => a.t - b.t)
      .map((k) => {
        const f: Record<string, string | number> = { offset: Math.min(Math.max(k.t, 0), 1), transform: transform(k) }
        if (k.opacity !== undefined) f.opacity = k.opacity
        return f
      })
    try {
      animations.push(el.animate(frames, {
        duration: total / iterations,
        iterations,
        easing: track.easing || 'ease-in-out',
        fill: opts.hold ? 'forwards' : 'none',
      }))
    } catch (e) {
      console.warn('bad track', track, e)
    }
  }
  const timers = (perf.bubble ?? []).map((b) =>
    window.setTimeout(() => opts.onBubble?.(b.text), Math.max(0, Math.min(b.t, 1)) * total))
  return new Promise((resolve) => {
    window.setTimeout(() => {
      timers.forEach(clearTimeout)
      opts.onBubble?.(null)
      if (!opts.hold) animations.forEach((a) => a.cancel())
      resolve()
    }, total)
  })
}

export function reset(svg: SVGSVGElement) {
  svg.getAnimations({ subtree: true }).forEach((a) => a.cancel())
}

// ---------- built-in scene reactions ----------

export const NO: Performance = {
  title: 'No',
  duration_ms: 2600,
  props: [],
  tracks: [
    // Armless hand on the chest, finger up, wagging around its own center like "no no no".
    {
      target: 'hand-no',
      keyframes: [
        { t: 0, opacity: 1, rotate: 0 },
        { t: 0.125, opacity: 1, rotate: -18 },
        { t: 0.375, opacity: 1, rotate: 18 },
        { t: 0.625, opacity: 1, rotate: -18 },
        { t: 0.875, opacity: 1, rotate: 18 },
        { t: 1, opacity: 1, rotate: 0 },
      ],
      easing: 'ease-in-out',
    },
    { target: 'head', keyframes: [{ t: 0, rotate: -4 }, { t: 0.5, rotate: 4 }, { t: 1, rotate: -4 }], iterations: 2 },
  ],
  bubble: [{ t: 0, text: 'Nope, nothing new! ☝️' }],
}

export const THUMBS: Performance = {
  title: 'Thumbs up',
  duration_ms: 1200,
  props: [],
  tracks: [
    { target: 'thumbs', keyframes: [{ t: 0, opacity: 1, scale: 0.4 }, { t: 0.35, opacity: 1, scale: 1.15 }, { t: 0.6, opacity: 1, scale: 1 }, { t: 1, opacity: 1, scale: 1 }] },
    { target: 'duck', keyframes: [{ t: 0, translateY: 0 }, { t: 0.3, translateY: -10 }, { t: 1, translateY: 0 }] },
  ],
  bubble: [],
}

export const THINK: Performance = {
  title: 'Thinking',
  duration_ms: 2000,
  props: [{
    id: 'glass', slot: 'world', x: 150, y: 90,
    svg: '<circle cx="0" cy="0" r="16" fill="#BFE6FF" stroke="#1F2430" stroke-width="4"/><path d="M11 11 L28 28" stroke="#1F2430" stroke-width="7" stroke-linecap="round"/>',
  }],
  tracks: [
    { target: 'glass', keyframes: [{ t: 0, translateX: 0, translateY: 0 }, { t: 0.5, translateX: -20, translateY: -10 }, { t: 1, translateX: 0, translateY: 0 }] },
    { target: 'head', keyframes: [{ t: 0, rotate: 0 }, { t: 0.5, rotate: 8 }, { t: 1, rotate: 0 }] },
  ],
  bubble: [],
}

export const HELLO: Performance = {
  title: 'Hello',
  duration_ms: 1500,
  props: [],
  tracks: [
    { target: 'duck', keyframes: [{ t: 0, translateY: 0 }, { t: 0.3, translateY: -12 }, { t: 0.6, translateY: 0 }, { t: 1, translateY: 0 }] },
  ],
  bubble: [],
}
